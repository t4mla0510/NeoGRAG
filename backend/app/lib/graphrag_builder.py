"""GraphRAG builder using NetworkX for academic regulation corpus."""

from __future__ import annotations

import json
import logging
import pickle
import re
import hashlib
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from tqdm import tqdm

import networkx as nx
from networkx.readwrite import json_graph

GraphT = nx.MultiDiGraph

from app.config import PROJECT_ROOT, config
from app.lib.ontology_generator import (
    OntologyGenerator,
    to_pascal_case,
    to_upper_snake_case,
)
from app.lib.entity_extractor import OntologyEntityExtractor, OntologyRelationExtractor
from app.utils.llm_client import LLMClient
from app.utils.text_utils import split_text_into_chunks

logger = logging.getLogger(__name__)

import igraph as ig
import leidenalg


class GraphRAGBuilder:
    """Build/update a directed multigraph for GraphRAG retrieval."""

    DOMAIN_COMMUNITIES = [
        "Dao_tao",
        "KTX",
        "Hoc_tap_ren_luyen",
        "Khen_thuong_ky_luat",
        "Chung",
    ]
    DOMAIN_COMMUNITY_IDS = {
        label: idx for idx, label in enumerate(DOMAIN_COMMUNITIES)
    }
    DOMAIN_KEYWORDS = {
        "Dao_tao": [
            "dao tao",
            "phong dao tao",
            "chuong trinh dao tao",
            "chuong trinh hoc",
            "hoc phan",
            "tin chi",
            "dang ky hoc phan",
            "lop hoc phan",
            "hoc ky",
            "nam hoc",
            "nganh hoc",
            "chuyen nganh",
            "xet tot nghiep",
            "tot nghiep",
            "bang tot nghiep",
            "diem trung binh",
            "diem chu",
            "diem so",
            "hoc vu",
            "quy che dao tao",
        ],
        "KTX": [
            "ktx",
            "ky tuc xa",
            "noi tru",
            "luu tru",
            "phong o",
            "cho o",
            "ban quan ly ky tuc xa",
            "dien nuoc",
            "tam tru",
            "cu tru",
            "noi quy ky tuc xa",
        ],
        "Hoc_tap_ren_luyen": [
            "hoc tap",
            "ren luyen",
            "diem ren luyen",
            "ket qua hoc tap",
            "canh bao hoc vu",
            "hoc lai",
            "hoc cai thien",
            "co van hoc tap",
            "sinh vien",
            "nguoi hoc",
            "bao luu",
            "nghi hoc",
            "tam nghi",
            "tien do hoc tap",
            "xep loai hoc tap",
            "xep loai ren luyen",
        ],
        "Khen_thuong_ky_luat": [
            "khen thuong",
            "ky luat",
            "khien trach",
            "canh cao",
            "dinh chi",
            "buoc thoi hoc",
            "vi pham",
            "xu ly vi pham",
            "hoi dong ky luat",
            "thi dua",
            "danh hieu",
            "hoc bong",
            "khen thuong ky luat",
        ],
        "Chung": [
            "quy dinh chung",
            "dieu khoan",
            "pham vi ap dung",
            "doi tuong ap dung",
            "can cu",
            "van ban",
            "quyet dinh",
            "hieu luc",
            "trach nhiem",
        ],
    }

    def __init__(
        self,
        data_dir: Path | str,
        collection_name: str = "academic_regulation",
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        workers: int = 1,
        ontology_mode: str = "auto",
        ontology_path: str | Path | None = None,
        ontology_sample_chars: int = 50_000,
    ) -> None:
        self.data_dir = Path(data_dir).resolve()
        self.collection_name = collection_name
        self.chunk_size = chunk_size or config.DEFAULT_CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or config.DEFAULT_CHUNK_OVERLAP
        self.workers = max(1, int(workers))
        self.ontology_mode = ontology_mode
        self.ontology_sample_chars = ontology_sample_chars
        self.llm = LLMClient()
        self.ontology_generator = OntologyGenerator(self.llm)
        self.entity_extractor = OntologyEntityExtractor(self.llm)
        self.relation_extractor = OntologyRelationExtractor(self.llm)
        self.output_dir = config.GRAPHRAG_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = config.GRAPHRAG_CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_path = self.cache_dir / f"{collection_name}.fingerprints.json"
        self.ontology_path = (
            Path(ontology_path)
            if ontology_path
            else self.output_dir / f"{collection_name}.ontology.json"
        )
        self.json_path = self.output_dir / f"{collection_name}.graph.json"
        self.gpickle_path = self.output_dir / f"{collection_name}.gpickle"

    def build(self, reset: bool = True, show_progress: bool = True) -> dict:
        if nx is None or json_graph is None:
            raise RuntimeError("networkx is required for GraphRAG build. Please install dependencies.")
        graph = nx.MultiDiGraph()
        if not reset and self.gpickle_path.exists():
            with open(self.gpickle_path, "rb") as handle:
                graph = pickle.load(handle)

        files = sorted(self.data_dir.rglob("*.md"))
        if not files:
            return {"files": 0, "chunks": 0, "nodes": graph.number_of_nodes(), "edges": graph.number_of_edges()}

        ontology = self._prepare_ontology(files, reset=reset)
        ontology_hash = self._hash_json(ontology)
        chunking_config = {
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
        }

        previous_cache = {} if reset else self._load_fingerprint_cache()
        new_cache: dict[str, dict] = {}
        processed_files = 0
        skipped_files = 0

        logger.info(
            "GraphRAG build started: collection=%s, data_dir=%s, files=%s",
            self.collection_name,
            self.data_dir,
            len(files),
        )
        total_chunks = 0
        processed_chunks = 0
        file_iter = tqdm(
            files,
            desc="GraphRAG files",
            unit="file",
            disable=not show_progress,
        )
        for file_path in file_iter:
            relative_file = self._safe_relative(file_path)
            file_hash = self._hash_file(file_path)
            previous_entry = previous_cache.get(relative_file)
            if (
                previous_entry
                and previous_entry.get("hash") == file_hash
                and previous_entry.get("ontology_hash") == ontology_hash
                and previous_entry.get("chunking_config") == chunking_config
            ):
                skipped_files += 1
                file_iter.set_postfix_str(f"skip:{file_path.name}")
                new_cache[relative_file] = previous_entry
                continue

            processed_files += 1
            text = file_path.read_text(encoding="utf-8")
            chunks = split_text_into_chunks(
                text=text,
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
            )
            total_chunks += len(chunks)
            logger.info("Processing file: %s (chunks=%s)", file_path.name, len(chunks))
            file_iter.set_postfix_str(file_path.name)
            chunk_iter = tqdm(
                total=len(chunks),
                desc=f"Chunks:{file_path.name}",
                unit="chunk",
                leave=False,
                disable=not show_progress,
            )
            if self.workers <= 1:
                for i, chunk in enumerate(chunks):
                    entities, relations = self._extract_chunk(chunk, ontology)
                    self._merge_chunk_result(graph, entities, relations, file_path, i)
                    processed_chunks += 1
                    if processed_chunks % 20 == 0:
                        logger.info(
                            "GraphRAG progress: %s chunks processed, nodes=%s, edges=%s",
                            processed_chunks,
                            graph.number_of_nodes(),
                            graph.number_of_edges(),
                        )
                    chunk_iter.update(1)
                    chunk_iter.set_postfix(
                        nodes=graph.number_of_nodes(),
                        edges=graph.number_of_edges(),
                    )
            else:
                with ThreadPoolExecutor(max_workers=self.workers) as executor:
                    futures = {
                        executor.submit(self._extract_chunk, chunk, ontology): (i, chunk)
                        for i, chunk in enumerate(chunks)
                    }
                    for future in as_completed(futures):
                        i, _ = futures[future]
                        try:
                            entities, relations = future.result()
                        except Exception as exc:
                            logger.warning("Chunk extraction failed (%s:%s): %s", file_path.name, i, exc)
                            entities, relations = [], []
                        self._merge_chunk_result(graph, entities, relations, file_path, i)
                        processed_chunks += 1
                        if processed_chunks % 20 == 0:
                            logger.info(
                                "GraphRAG progress: %s chunks processed, nodes=%s, edges=%s",
                                processed_chunks,
                                graph.number_of_nodes(),
                                graph.number_of_edges(),
                            )
                        chunk_iter.update(1)
                        chunk_iter.set_postfix(
                            nodes=graph.number_of_nodes(),
                            edges=graph.number_of_edges(),
                        )
            new_cache[relative_file] = {
                "hash": file_hash,
                "ontology_hash": ontology_hash,
                "chunking_config": chunking_config,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "chunks": len(chunks),
            }

        community_count = self._annotate_communities(graph)
        self._persist_graph(graph)
        self._save_fingerprint_cache(new_cache)
        logger.info(
            "GraphRAG build completed: chunks=%s, nodes=%s, edges=%s, communities=%s, processed_files=%s, skipped_files=%s",
            total_chunks,
            graph.number_of_nodes(),
            graph.number_of_edges(),
            community_count,
            processed_files,
            skipped_files,
        )
        return {
            "files": len(files),
            "chunks": total_chunks,
            "processed_files": processed_files,
            "skipped_files": skipped_files,
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "communities": community_count,
            "json_path": str(self.json_path),
            "gpickle_path": str(self.gpickle_path),
            "cache_path": str(self.cache_path),
            "ontology_path": str(self.ontology_path),
            "ontology_mode": self.ontology_mode,
        }

    def status(self) -> dict:
        if nx is None:
            return {
                "exists": False,
                "collection": self.collection_name,
                "error": "networkx is not installed",
            }
        if not self.gpickle_path.exists():
            return {"exists": False, "collection": self.collection_name}

        with open(self.gpickle_path, "rb") as handle:
            graph = pickle.load(handle)
        return {
            "exists": True,
            "collection": self.collection_name,
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "json_path": str(self.json_path),
            "gpickle_path": str(self.gpickle_path),
            "updated_at": datetime.fromtimestamp(
                self.gpickle_path.stat().st_mtime, tz=timezone.utc
            ).isoformat(),
        }

    def _prepare_ontology(self, files: list[Path], reset: bool) -> dict[str, Any]:
        mode = self.ontology_mode.lower()
        if mode not in {"auto", "reuse", "static"}:
            logger.warning("Unknown ontology mode '%s'; falling back to auto", mode)
            mode = "auto"

        if mode == "static":
            ontology = self.ontology_generator.validate_and_process(
                OntologyGenerator.default_ontology()
            )
            self._save_ontology(ontology)
            return ontology

        if mode == "reuse" or (mode == "auto" and not reset and self.ontology_path.exists()):
            existing = self._load_ontology()
            if existing:
                return existing
            if mode == "reuse":
                logger.warning("Ontology reuse requested but no ontology found; using static ontology")
                ontology = self.ontology_generator.validate_and_process(
                    OntologyGenerator.default_ontology()
                )
                self._save_ontology(ontology)
                return ontology

        samples = self._collect_ontology_samples(files)
        ontology = self.ontology_generator.generate(
            samples,
            sample_chars=self.ontology_sample_chars,
            additional_context="Academic regulation and university student affairs knowledge graph.",
        )
        self._save_ontology(ontology)
        return ontology

    def _collect_ontology_samples(self, files: list[Path]) -> list[str]:
        samples = []
        remaining = self.ontology_sample_chars
        for file_path in files:
            if remaining <= 0:
                break
            text = file_path.read_text(encoding="utf-8")
            samples.append(text[:remaining])
            remaining -= len(samples[-1])
        return samples

    def _load_ontology(self) -> dict[str, Any] | None:
        if not self.ontology_path.exists():
            return None
        try:
            with open(self.ontology_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if isinstance(payload, dict):
                return self.ontology_generator.validate_and_process(payload)
        except Exception as exc:
            logger.warning("Failed to load ontology at %s: %s", self.ontology_path, exc)
        return None

    def _save_ontology(self, ontology: dict[str, Any]) -> None:
        self.ontology_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.ontology_path, "w", encoding="utf-8") as handle:
            json.dump(ontology, handle, ensure_ascii=False, indent=2)

    def _merge_chunk_result(
        self,
        graph: GraphT,
        entities: list[dict],
        relations: list[dict],
        file_path: Path,
        chunk_index: int,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        source = self._safe_relative(file_path)

        for entity in entities:
            entity_payload = self._normalize_entity_payload(entity)
            entity_name = entity_payload["name"]
            node_id = entity_payload["canonical_name"]
            if not node_id:
                continue
            if node_id not in graph:
                graph.add_node(
                    node_id,
                    label=entity_name,
                    canonical_name=node_id,
                    entity_type=entity_payload["entity_type"],
                    confidence=entity_payload["confidence"],
                    aliases=[entity_name],
                    created_at=now,
                )
            else:
                aliases = set(graph.nodes[node_id].get("aliases", []))
                aliases.add(entity_name)
                graph.nodes[node_id]["aliases"] = sorted(aliases)
                graph.nodes[node_id]["confidence"] = max(
                    float(graph.nodes[node_id].get("confidence", 0.0)),
                    entity_payload["confidence"],
                )
                if graph.nodes[node_id].get("entity_type") in {"AcademicEntity", "GENERIC_ENTITY", None}:
                    graph.nodes[node_id]["entity_type"] = entity_payload["entity_type"]
                graph.nodes[node_id]["updated_at"] = now

        for rel in relations:
            src = self._canonicalize(rel.get("source", ""))
            dst = self._canonicalize(rel.get("target", ""))
            if not src or not dst:
                continue

            if src not in graph:
                graph.add_node(
                    src,
                    label=rel.get("source", src),
                    canonical_name=src,
                    entity_type=rel.get("source_entity_type", "AcademicEntity"),
                    confidence=0.5,
                    aliases=[rel.get("source", src)],
                    created_at=now,
                )
            if dst not in graph:
                graph.add_node(
                    dst,
                    label=rel.get("target", dst),
                    canonical_name=dst,
                    entity_type=rel.get("target_entity_type", "AcademicEntity"),
                    confidence=0.5,
                    aliases=[rel.get("target", dst)],
                    created_at=now,
                )

            edge_key = self._edge_key(
                src,
                dst,
                rel.get("relation", "RELATED_TO"),
                source,
                chunk_index,
                rel.get("evidence", ""),
            )
            if graph.has_edge(src, dst, key=edge_key):
                continue

            graph.add_edge(
                src,
                dst,
                key=edge_key,
                relation=rel.get("relation", "RELATED_TO"),
                confidence=float(rel.get("confidence", 0.5)),
                evidence=rel.get("evidence", "")[:500],
                source_file=source,
                chunk_id=chunk_index,
                extraction_type=rel.get("extraction_type", "INFERRED"),
                created_at=now,
            )

    def _normalize_entity_payload(self, entity: str | dict[str, Any]) -> dict[str, Any]:
        if isinstance(entity, dict):
            name = str(entity.get("name", "")).strip()
            canonical_name = str(entity.get("canonical_name") or self._canonicalize(name))
            entity_type = to_pascal_case(str(entity.get("entity_type") or "AcademicEntity"))
            confidence = self._safe_confidence(entity.get("confidence", 0.5))
        else:
            name = str(entity).strip()
            canonical_name = self._canonicalize(name)
            entity_type = "AcademicEntity"
            confidence = 0.5
        return {
            "name": name,
            "canonical_name": canonical_name,
            "entity_type": entity_type,
            "confidence": confidence,
        }

    def _fallback_entity_type(self, name: str, ontology: dict[str, Any]) -> str:
        allowed = {entity["name"] for entity in ontology.get("entity_types", [])}
        lower = name.lower()
        if "Student" in allowed and any(token in lower for token in ["sinh viên", "người học", "student"]):
            return "Student"
        if "Organization" in allowed and any(token in lower for token in ["trường", "khoa", "phòng", "bộ", "đơn vị"]):
            return "Organization"
        if "Person" in allowed and any(token in lower for token in ["giảng viên", "cố vấn", "người"]):
            return "Person"
        if "AcademicEntity" in allowed:
            return "AcademicEntity"
        return next(iter(allowed), "AcademicEntity")

    def _extract_chunk(self, chunk: str, ontology: dict[str, Any]) -> tuple[list[dict], list[dict]]:
        entities = self.entity_extractor.extract(chunk, ontology)
        relations = self.relation_extractor.extract(chunk, ontology, entities)
        return entities, relations

    def _persist_graph(self, graph: GraphT) -> None:
        data = json_graph.node_link_data(graph, edges="links")
        with open(self.json_path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        with open(self.gpickle_path, "wb") as handle:
            pickle.dump(graph, handle, protocol=pickle.HIGHEST_PROTOCOL)

    def _annotate_communities(self, graph: GraphT) -> int:
        """Assign domain community labels using Leiden structure as support."""
        if graph.number_of_nodes() == 0:
            return 0

        undirected = nx.Graph()
        for node, attrs in graph.nodes(data=True):
            undirected.add_node(node, **attrs)

        for u, v, data in graph.edges(data=True):
            weight = float(data.get("confidence", 1.0))
            if undirected.has_edge(u, v):
                undirected[u][v]["weight"] += weight
            else:
                undirected.add_edge(u, v, weight=weight)

        if undirected.number_of_edges() == 0:
            for node in graph.nodes():
                graph.nodes[node]["community_id"] = 0
            return 1

        memberships: dict[str, int] = {}

        if ig is not None and leidenalg is not None:
            ig_graph = ig.Graph()
            node_list = list(undirected.nodes())
            node_index = {node: i for i, node in enumerate(node_list)}
            ig_graph.add_vertices(len(node_list))
            edges = [(node_index[u], node_index[v]) for u, v in undirected.edges()]
            ig_graph.add_edges(edges)
            ig_graph.es["weight"] = [float(undirected[u][v].get("weight", 1.0)) for u, v in undirected.edges()]
            partition = leidenalg.find_partition(
                ig_graph,
                leidenalg.RBConfigurationVertexPartition,
                weights="weight",
            )
            for idx, community_id in enumerate(partition.membership):
                memberships[node_list[idx]] = int(community_id)
        else:
            # Fallback if Leiden dependencies are unavailable.
            communities = list(nx.algorithms.community.greedy_modularity_communities(undirected))
            for cid, community_nodes in enumerate(communities):
                for node in community_nodes:
                    memberships[node] = cid

        for node in graph.nodes():
            graph.nodes[node]["leiden_community_id"] = int(memberships.get(node, -1))

        return self._assign_domain_communities(graph, memberships)

    def _assign_domain_communities(self, graph: GraphT, memberships: dict[str, int]) -> int:
        """Map natural Leiden communities into the 5 fixed academic domains."""
        direct_labels: dict[str, str] = {}
        for node in graph.nodes():
            direct_labels[node] = self._classify_domain_text(
                self._node_domain_text(graph, node)
            )

        leiden_majorities: dict[int, str] = {}
        grouped: dict[int, list[str]] = {}
        for node, leiden_id in memberships.items():
            grouped.setdefault(leiden_id, []).append(node)

        for leiden_id, nodes in grouped.items():
            counts: dict[str, int] = {}
            for node in nodes:
                label = direct_labels.get(node, "Chung")
                if label == "Chung":
                    continue
                counts[label] = counts.get(label, 0) + 1
            if counts:
                leiden_majorities[leiden_id] = max(
                    counts.items(),
                    key=lambda item: item[1],
                )[0]

        used_labels = set()
        for node in graph.nodes():
            label = direct_labels.get(node, "Chung")
            if label == "Chung":
                leiden_id = int(memberships.get(node, -1))
                label = leiden_majorities.get(leiden_id, "Chung")

            graph.nodes[node]["community_label"] = label
            graph.nodes[node]["community_id"] = self.DOMAIN_COMMUNITY_IDS[label]
            used_labels.add(label)

        return len(used_labels)

    def _node_domain_text(self, graph: GraphT, node: str) -> str:
        attrs = graph.nodes.get(node, {})
        parts = [
            str(node),
            str(attrs.get("label", "")),
            str(attrs.get("canonical_name", "")),
            str(attrs.get("entity_type", "")),
            " ".join(map(str, attrs.get("aliases", []) or [])),
        ]

        for _, neighbor, data in graph.out_edges(node, data=True):
            neighbor_attrs = graph.nodes.get(neighbor, {})
            parts.extend(
                [
                    str(neighbor_attrs.get("label", neighbor)),
                    str(data.get("relation", "")),
                    str(data.get("evidence", "")),
                    str(data.get("source_file", "")),
                ]
            )
        for neighbor, _, data in graph.in_edges(node, data=True):
            neighbor_attrs = graph.nodes.get(neighbor, {})
            parts.extend(
                [
                    str(neighbor_attrs.get("label", neighbor)),
                    str(data.get("relation", "")),
                    str(data.get("evidence", "")),
                    str(data.get("source_file", "")),
                ]
            )
        return " ".join(parts)

    def _classify_domain_text(self, text: str) -> str:
        normalized = self._strip_accents(text).lower()
        scores: dict[str, int] = {}
        for label, keywords in self.DOMAIN_KEYWORDS.items():
            score = 0
            for keyword in keywords:
                count = normalized.count(keyword)
                if count:
                    score += count * max(1, len(keyword.split()))
            scores[label] = score

        best_label, best_score = max(scores.items(), key=lambda item: item[1])
        return best_label if best_score > 0 else "Chung"

    @staticmethod
    def _strip_accents(text: str) -> str:
        normalized = unicodedata.normalize("NFD", text)
        without_marks = "".join(
            char for char in normalized if unicodedata.category(char) != "Mn"
        )
        return without_marks.replace("đ", "d").replace("Đ", "D")

    def _load_fingerprint_cache(self) -> dict[str, dict]:
        if not self.cache_path.exists():
            return {}
        try:
            with open(self.cache_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                return data
            return {}
        except Exception:
            return {}

    def _save_fingerprint_cache(self, cache_data: dict[str, dict]) -> None:
        with open(self.cache_path, "w", encoding="utf-8") as handle:
            json.dump(cache_data, handle, ensure_ascii=False, indent=2)

    @staticmethod
    def _hash_file(file_path: Path) -> str:
        h = hashlib.sha256()
        with open(file_path, "rb") as handle:
            while True:
                chunk = handle.read(8192)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def _hash_json(payload: dict[str, Any]) -> str:
        content = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def _safe_confidence(value: Any, default: float = 0.5) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = default
        return max(0.0, min(1.0, number))

    @staticmethod
    def _canonicalize(value: str) -> str:
        return re.sub(r"\s+", " ", value.strip().lower())

    @staticmethod
    def _edge_key(
        source: str,
        target: str,
        relation: str,
        source_file: str,
        chunk_id: int,
        evidence: str,
    ) -> str:
        base = f"{source}|{relation}|{target}|{source_file}|{chunk_id}|{evidence[:120]}"
        return str(abs(hash(base)))

    @staticmethod
    def _safe_relative(file_path: Path) -> str:
        try:
            return str(file_path.resolve().relative_to(PROJECT_ROOT.resolve()))
        except ValueError:
            return str(file_path.resolve())
