"""LLM-based entity extraction that strictly adheres to ontology."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.lib.ontology_generator import to_pascal_case, to_upper_snake_case

logger = logging.getLogger(__name__)

RESERVED_ATTRS = {"name", "uuid", "group_id", "created_at", "summary"}


class OntologyEntityExtractor:
    """Extract entities from text using LLM, strictly following ontology constraints."""

    def __init__(self, llm_client: Any | None = None) -> None:
        self.llm = llm_client

    def _get_llm(self) -> Any:
        if self.llm is None:
            from app.utils.llm_client import LLMClient
            self.llm = LLMClient()
        return self.llm

    def extract(
        self,
        text: str,
        ontology: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Extract ontology-compliant entities from text."""
        entity_types = [e["name"] for e in ontology.get("entity_types", [])]
        if not entity_types:
            return []

        prompt = self._build_prompt(text, entity_types)
        try:
            raw = self._get_llm().generate(prompt)
            data = self._extract_json(raw)
        except Exception as exc:
            logger.warning("Entity extraction failed: %s", exc)
            return []

        return self._validate_and_clean(data.get("entities", []), entity_types)

    def _build_prompt(self, text: str, entity_types: list[str]) -> str:
        types_list = ", ".join(entity_types)
        return f"""You are a knowledge extraction expert for Vietnamese university regulations.

Task: Extract entities from the text that conform to the allowed ontology types.

ONTOLOGY CONSTRAINTS:
- Allowed entity types (MUST use exactly these types): {types_list}
- If text contains entity not matching any type, use one of: Person, Organization, AcademicEntity
- Entity names MUST be Vietnamese as they appear in the source text
- Entity type MUST be one of the allowed types above (English PascalCase)

OUTPUT FORMAT: Return ONLY valid JSON, no markdown or explanation.
Schema:
{{
  "entities": [
    {{
      "name": "exact Vietnamese text from source",
      "entity_type": "one of the allowed types",
      "canonical_name": "normalized lowercase Vietnamese (no extra spaces, no punctuation)",
      "confidence": 0.0
    }}
  ]
}}

Rules:
- name: Vietnamese text exactly as it appears (preserve diacritics)
- entity_type: MUST be one of [{types_list}]
- canonical_name: lowercase, trimmed, no special chars, spaces normalized to single space
- confidence: float between 0 and 1
- Extract only entities with clear grounding in the text
- Ignore decorative or irrelevant text

Text:
\"\"\"{text[:4000]}\"\"\"
"""

    @staticmethod
    def _extract_json(content: str) -> dict[str, Any]:
        content = content.strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if not match:
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}

    def _validate_and_clean(
        self,
        entities: list[Any],
        allowed_types: list[str],
    ) -> list[dict[str, Any]]:
        """Validate entities against ontology and clean them."""
        allowed_set = set(allowed_types)
        fallback_types = ["Person", "Organization", "AcademicEntity"]
        valid_fallbacks = [t for t in fallback_types if t in allowed_set]

        cleaned = []
        seen_names: dict[str, dict[str, Any]] = {}

        for item in entities:
            if not isinstance(item, dict):
                continue

            name = str(item.get("name", "")).strip()
            if not name or len(name) < 2:
                continue

            raw_type = str(item.get("entity_type", ""))
            entity_type = to_pascal_case(raw_type) if raw_type else "AcademicEntity"

            if entity_type not in allowed_set:
                entity_type = self._infer_type(name, valid_fallbacks)

            canonical = self._canonicalize(name)
            confidence = self._safe_confidence(item.get("confidence", 0.5))

            key = canonical
            existing = seen_names.get(key)
            if existing is None or confidence > existing["confidence"]:
                seen_names[key] = {
                    "name": name,
                    "entity_type": entity_type,
                    "canonical_name": canonical,
                    "confidence": confidence,
                }

        for payload in seen_names.values():
            cleaned.append(payload)

        return cleaned

    def _infer_type(self, name: str, fallback_types: list[str]) -> str:
        """Infer entity type from Vietnamese name heuristics."""
        lower = name.lower()

        person_indicators = ["sinh viên", "giảng viên", "cố vấn", "trưởng khoa",
                           "phó khoa", "thư ký", "giám đốc", "hiệu trưởng",
                           "phó hiệu trưởng", "chủ tịch", "phó chủ tịch"]
        for indicator in person_indicators:
            if indicator in lower:
                return "Person" if "Person" in fallback_types else fallback_types[0]

        org_indicators = ["trường", "khoa", "phòng", "ban", "bộ môn", "viện",
                         "trung tâm", "đơn vị", "sở", "cục", "vụ"]
        for indicator in org_indicators:
            if indicator in lower:
                return "Organization" if "Organization" in fallback_types else fallback_types[0]

        return "AcademicEntity" if "AcademicEntity" in fallback_types else fallback_types[0]

    @staticmethod
    def _canonicalize(value: str) -> str:
        normalized = re.sub(r"\s+", " ", value.strip().lower())
        normalized = re.sub(r"[^\w\s\u00C0-\u024F]", "", normalized)
        return normalized.strip()

    @staticmethod
    def _safe_confidence(value: Any, default: float = 0.5) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = default
        return max(0.0, min(1.0, number))


class OntologyRelationExtractor:
    """Extract relations between entities following ontology edge types."""

    def __init__(self, llm_client: Any | None = None) -> None:
        self.llm = llm_client

    def _get_llm(self) -> Any:
        if self.llm is None:
            from app.utils.llm_client import LLMClient
            self.llm = LLMClient()
        return self.llm

    def extract(
        self,
        text: str,
        ontology: dict[str, Any],
        entities: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Extract ontology-compliant relations from text."""
        edge_types = [e["name"] for e in ontology.get("edge_types", [])]
        if not edge_types:
            return []

        if "RELATED_TO" not in edge_types:
            edge_types.append("RELATED_TO")

        entity_hint = [e["canonical_name"] for e in entities[:20]]
        edge_list = ", ".join(edge_types)

        prompt = f"""You are a knowledge extraction expert for Vietnamese university regulations.

Task: Extract relationships between entities that conform to the allowed ontology edge types.

ONTOLOGY CONSTRAINTS:
- Allowed relation types (MUST use exactly these UPPER_SNAKE_CASE): {edge_list}
- Use RELATED_TO as fallback when no better type fits
- source/target MUST be canonical entity names from the provided list
- Relation label MUST be exactly one of: {edge_list}

OUTPUT FORMAT: Return ONLY valid JSON, no markdown or explanation.
Schema:
{{
  "relations": [
    {{
      "source": "canonical entity name (lowercase)",
      "target": "canonical entity name (lowercase)",
      "relation": "ONE_OF_THE_ALLOWED_TYPES",
      "confidence": 0.0,
      "evidence": "verbatim text span (max 200 chars)"
    }}
  ]
}}

Rules:
- source and target MUST be from the entity list provided
- relation MUST be one of [{edge_list}]
- evidence: verbatim Vietnamese text supporting the relation (max 200 chars)
- confidence: float between 0 and 1
- Ignore speculative or weak relations
- Return empty array if no reliable relations found

Entity canonical names (use these exact forms):
{', '.join(entity_hint) if entity_hint else '(none - use your judgment)'}

Text:
\"\"\"{text[:3000]}\"\"\"
"""
        try:
            raw = self._get_llm().generate(prompt)
            data = self._extract_json(raw)
        except Exception as exc:
            logger.warning("Relation extraction failed: %s", exc)
            return []

        return self._validate_and_clean(
            data.get("relations", []),
            entities,
            edge_types,
        )

    @staticmethod
    def _extract_json(content: str) -> dict[str, Any]:
        content = content.strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if not match:
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}

    def _validate_and_clean(
        self,
        relations: list[Any],
        entities: list[dict[str, Any]],
        allowed_edges: list[str],
    ) -> list[dict[str, Any]]:
        """Validate relations against ontology."""
        allowed_set = set(allowed_edges)
        entity_canonical_set = {e["canonical_name"] for e in entities}
        entity_canonical_set.add("")

        cleaned = []
        seen: set[tuple[str, str, str]] = set()

        for rel in relations:
            if not isinstance(rel, dict):
                continue

            src = self._canonicalize(str(rel.get("source", "")))
            dst = self._canonicalize(str(rel.get("target", "")))
            if not src or not dst or src == dst:
                continue

            if src not in entity_canonical_set or dst not in entity_canonical_set:
                continue

            rel_type = to_upper_snake_case(str(rel.get("relation", "RELATED_TO")))
            if rel_type not in allowed_set:
                rel_type = "RELATED_TO"

            key = (src, dst, rel_type)
            if key in seen:
                continue
            seen.add(key)

            cleaned.append({
                "source": src,
                "target": dst,
                "relation": rel_type,
                "confidence": max(0.0, min(1.0, float(rel.get("confidence", 0.5)))),
                "evidence": str(rel.get("evidence", ""))[:200],
            })

        return cleaned

    @staticmethod
    def _canonicalize(value: str) -> str:
        normalized = re.sub(r"\s+", " ", value.strip().lower())
        normalized = re.sub(r"[^\w\s\u00C0-\u024F]", "", normalized)
        return normalized.strip()