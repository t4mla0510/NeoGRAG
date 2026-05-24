"""Dynamic ontology generation for academic-regulation knowledge graphs."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

RESERVED_ATTRIBUTE_NAMES = {
    "name",
    "uuid",
    "group_id",
    "created_at",
    "summary",
}


def to_pascal_case(name: str) -> str:
    parts = re.split(r"[^a-zA-Z0-9]+", name)
    words: list[str] = []
    for part in parts:
        words.extend(re.sub(r"([a-z])([A-Z])", r"\1_\2", part).split("_"))
    result = "".join(word.capitalize() for word in words if word)
    return result or "AcademicEntity"


def to_snake_case(name: str) -> str:
    text = re.sub(r"([a-z])([A-Z])", r"\1_\2", name)
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_").lower()
    return text or "description"


def to_upper_snake_case(name: str) -> str:
    return to_snake_case(name).upper() or "RELATED_TO"


class OntologyGenerator:
    """Generate and validate a compact ontology for academic regulation texts."""

    MAX_ENTITY_TYPES = 12
    MAX_EDGE_TYPES = 12

    def __init__(self, llm_client: Any | None = None) -> None:
        self.llm_client = llm_client

    def _get_llm_client(self) -> Any:
        if self.llm_client is None:
            from app.utils.llm_client import LLMClient

            self.llm_client = LLMClient()
        return self.llm_client

    def generate(
        self,
        document_texts: list[str],
        sample_chars: int = 50_000,
        additional_context: str | None = None,
    ) -> dict[str, Any]:
        combined_text = "\n\n---\n\n".join(document_texts)
        if len(combined_text) > sample_chars:
            combined_text = combined_text[:sample_chars]

        prompt = self._build_prompt(combined_text, additional_context)
        try:
            raw = self._get_llm_client().generate(prompt)
            ontology = self._extract_json(raw)
        except Exception as exc:
            logger.warning("Ontology generation failed, using static ontology: %s", exc)
            ontology = self.default_ontology()
        return self.validate_and_process(ontology)

    def validate_and_process(self, ontology: dict[str, Any]) -> dict[str, Any]:
        entity_types = ontology.get("entity_types", [])
        edge_types = ontology.get("edge_types", [])

        processed_entities: list[dict[str, Any]] = []
        name_map: dict[str, str] = {}
        seen_entities: set[str] = set()
        for entity in entity_types:
            if not isinstance(entity, dict):
                continue
            original = str(entity.get("name", "")).strip()
            name = to_pascal_case(original)
            if name in seen_entities:
                continue
            seen_entities.add(name)
            name_map[original] = name
            attrs = self._process_attributes(entity.get("attributes", []))
            processed_entities.append(
                {
                    "name": name,
                    "description": str(entity.get("description", ""))[:100],
                    "attributes": attrs,
                    "examples": entity.get("examples", [])[:5]
                    if isinstance(entity.get("examples", []), list)
                    else [],
                }
            )

        processed_entities = self._ensure_fallback_entities(processed_entities)
        valid_entity_names = {entity["name"] for entity in processed_entities}

        processed_edges: list[dict[str, Any]] = []
        seen_edges: set[str] = set()
        for edge in edge_types:
            if not isinstance(edge, dict):
                continue
            original = str(edge.get("name", "")).strip()
            name = to_upper_snake_case(original)
            if name in seen_edges:
                continue
            seen_edges.add(name)
            source_targets = self._process_source_targets(
                edge.get("source_targets", []),
                valid_entity_names,
                name_map,
            )
            processed_edges.append(
                {
                    "name": name,
                    "description": str(edge.get("description", ""))[:100],
                    "source_targets": source_targets,
                    "attributes": self._process_attributes(edge.get("attributes", [])),
                }
            )

        processed_edges = self._ensure_fallback_edges(processed_edges, valid_entity_names)

        return {
            "entity_types": processed_entities[: self.MAX_ENTITY_TYPES],
            "edge_types": processed_edges[: self.MAX_EDGE_TYPES],
            "analysis_summary": str(ontology.get("analysis_summary", "")),
        }

    @classmethod
    def default_ontology(cls) -> dict[str, Any]:
        return {
            "entity_types": [
                {"name": "Student", "description": "A learner subject to academic rules.", "attributes": [{"name": "role", "type": "text", "description": "Student role"}], "examples": ["sinh viên"]},
                {"name": "Instructor", "description": "A teacher, advisor, or academic staff member.", "attributes": [{"name": "position", "type": "text", "description": "Academic position"}], "examples": ["giảng viên", "cố vấn học tập"]},
                {"name": "AcademicUnit", "description": "A faculty, department, office, or training unit.", "attributes": [{"name": "unit_type", "type": "text", "description": "Unit type"}], "examples": ["khoa", "phòng đào tạo"]},
                {"name": "Program", "description": "An academic program or curriculum.", "attributes": [{"name": "program_level", "type": "text", "description": "Program level"}], "examples": ["chương trình đào tạo"]},
                {"name": "Course", "description": "A course, module, or credit-bearing subject.", "attributes": [{"name": "course_type", "type": "text", "description": "Course type"}], "examples": ["học phần"]},
                {"name": "RegulationDocument", "description": "A regulation, decision, circular, or official document.", "attributes": [{"name": "document_type", "type": "text", "description": "Document type"}], "examples": ["quy chế học vụ"]},
                {"name": "AcademicProcess", "description": "A procedure in academic administration.", "attributes": [{"name": "process_type", "type": "text", "description": "Process type"}], "examples": ["đăng ký học phần"]},
                {"name": "AcademicCondition", "description": "A condition or requirement in academic rules.", "attributes": [{"name": "condition_text", "type": "text", "description": "Condition text"}], "examples": ["điều kiện tốt nghiệp"]},
                {"name": "AssessmentMetric", "description": "A grade, credit, score, or academic metric.", "attributes": [{"name": "metric_type", "type": "text", "description": "Metric type"}], "examples": ["điểm trung bình"]},
                {"name": "TimePeriod", "description": "An academic time period or deadline.", "attributes": [{"name": "time_value", "type": "text", "description": "Time expression"}], "examples": ["học kỳ"]},
                {"name": "Person", "description": "Any individual person not fitting specific person types.", "attributes": [{"name": "full_name", "type": "text", "description": "Full name"}, {"name": "role", "type": "text", "description": "Role"}], "examples": ["người học"]},
                {"name": "Organization", "description": "Any organization not fitting specific organization types.", "attributes": [{"name": "org_name", "type": "text", "description": "Organization name"}, {"name": "org_type", "type": "text", "description": "Organization type"}], "examples": ["đơn vị"]},
                {"name": "AcademicEntity", "description": "Fallback academic entity for ambiguous domain terms.", "attributes": [{"name": "description", "type": "text", "description": "Entity description"}], "examples": ["thuật ngữ học vụ"]},
            ],
            "edge_types": [
                {"name": "REQUIRES", "description": "Source requires target.", "source_targets": [], "attributes": []},
                {"name": "APPLIES_TO", "description": "Rule or process applies to target.", "source_targets": [], "attributes": []},
                {"name": "REGULATES", "description": "Source regulates target.", "source_targets": [], "attributes": []},
                {"name": "DEFINES", "description": "Source defines target.", "source_targets": [], "attributes": []},
                {"name": "BELONGS_TO", "description": "Source belongs to target.", "source_targets": [], "attributes": []},
                {"name": "PART_OF", "description": "Source is part of target.", "source_targets": [], "attributes": []},
                {"name": "TRIGGERS", "description": "Source causes target process or state.", "source_targets": [], "attributes": []},
                {"name": "VIOLATES", "description": "Source violates target rule.", "source_targets": [], "attributes": []},
                {"name": "RESOLVES", "description": "Source resolves target issue.", "source_targets": [], "attributes": []},
                {"name": "EQUIVALENT_TO", "description": "Source is equivalent to target.", "source_targets": [], "attributes": []},
                {"name": "RELATED_TO", "description": "Generic fallback relation.", "source_targets": [], "attributes": []},
            ],
            "analysis_summary": "Static academic-regulation ontology.",
        }

    def _build_prompt(self, text: str, additional_context: str | None) -> str:
        context = additional_context or "Vietnamese university academic regulation knowledge graph."
        return f"""
You are a knowledge graph ontology design expert.
Design an ontology for Vietnamese academic regulation documents.
Return ONLY valid JSON. No markdown.

Domain context:
{context}

Output schema:
{{
  "entity_types": [
    {{
      "name": "EnglishPascalCase",
      "description": "English description under 100 chars",
      "attributes": [
        {{"name": "english_snake_case", "type": "text", "description": "attribute description"}}
      ],
      "examples": ["Vietnamese example"]
    }}
  ],
  "edge_types": [
    {{
      "name": "UPPER_SNAKE_CASE",
      "description": "English description under 100 chars",
      "source_targets": [
        {{"source": "EntityType", "target": "EntityType"}}
      ],
      "attributes": []
    }}
  ],
  "analysis_summary": "short summary"
}}

Rules:
- Create 8-12 entity types for academic regulation.
- Always include fallback entity types: Person, Organization, AcademicEntity.
- Create 8-12 relation types.
- Always include fallback relation RELATED_TO.
- Prefer concrete academic entities: Student, Instructor, AcademicUnit, Program,
  Course, RegulationDocument, AcademicProcess, AcademicCondition,
  AssessmentMetric, TimePeriod when useful.
- Do not use abstract topic labels as entity types unless they are represented as AcademicEntity.
- Entity type names MUST be English PascalCase.
- Entity type examples MUST be Vietnamese terms copied or adapted from the document.
- Keep Vietnamese diacritics in examples. Do not translate Vietnamese examples into English.
- Relation type names MUST be English UPPER_SNAKE_CASE.
- Attribute names MUST be English snake_case and must not be reserved:
  name, uuid, group_id, created_at, summary.

Document sample:
\"\"\"{text}\"\"\"
"""

    @staticmethod
    def _extract_json(content: str) -> dict[str, Any]:
        try:
            return json.loads(content.strip())
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if not match:
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}

    def _process_attributes(self, attributes: Any) -> list[dict[str, str]]:
        if not isinstance(attributes, list):
            return []
        processed = []
        seen = set()
        for attr in attributes[:3]:
            if not isinstance(attr, dict):
                continue
            name = to_snake_case(str(attr.get("name", "")))
            if name in RESERVED_ATTRIBUTE_NAMES:
                name = f"entity_{name}"
            if name in seen:
                continue
            seen.add(name)
            processed.append(
                {
                    "name": name,
                    "type": "text",
                    "description": str(attr.get("description", name))[:120],
                }
            )
        return processed

    def _process_source_targets(
        self,
        source_targets: Any,
        valid_entity_names: set[str],
        name_map: dict[str, str],
    ) -> list[dict[str, str]]:
        if not isinstance(source_targets, list):
            return []
        processed = []
        for st in source_targets:
            if not isinstance(st, dict):
                continue
            source = name_map.get(str(st.get("source", "")), to_pascal_case(str(st.get("source", ""))))
            target = name_map.get(str(st.get("target", "")), to_pascal_case(str(st.get("target", ""))))
            if source in valid_entity_names and target in valid_entity_names:
                processed.append({"source": source, "target": target})
        return processed

    def _ensure_fallback_entities(self, entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
        defaults = {entity["name"]: entity for entity in self.default_ontology()["entity_types"]}
        fallback_names = ("Person", "Organization", "AcademicEntity")
        concrete = [entity for entity in entities if entity["name"] not in fallback_names]
        fallbacks = []
        entity_by_name = {entity["name"]: entity for entity in entities}
        for fallback_name in fallback_names:
            fallbacks.append(entity_by_name.get(fallback_name, defaults[fallback_name]))
        return concrete[: self.MAX_ENTITY_TYPES - len(fallbacks)] + fallbacks

    def _ensure_fallback_edges(
        self,
        edges: list[dict[str, Any]],
        valid_entity_names: set[str],
    ) -> list[dict[str, Any]]:
        if "RELATED_TO" not in {edge["name"] for edge in edges}:
            edges.append(
                {
                    "name": "RELATED_TO",
                    "description": "Generic fallback relation.",
                    "source_targets": [],
                    "attributes": [],
                }
            )
        if not valid_entity_names:
            return edges
        return edges
