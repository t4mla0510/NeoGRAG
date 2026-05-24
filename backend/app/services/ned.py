"""Named Entity Disambiguation (NED) service for query enhancement."""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from underthesea import ner

from app.config import config

logger = logging.getLogger(__name__)

NOUN_TAGS = {"N", "Np", "Nb"}


@dataclass
class NEDMatch:
    entity: str
    description: str


class NEDService:
    """Enhance user query by expanding abbreviations and disambiguating entities."""

    @classmethod
    def get_instance(cls) -> "NEDService":
        if not hasattr(cls, "_instance") or cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self) -> None:
        self._abbreviations = self._load_abbreviations(config.DATA_DIR / "abbreviations.csv")
        self._entities = self._load_entities(config.DATA_DIR / "specialized_words.csv")
        self._entity_by_lower = {
            item.entity.strip().lower(): item for item in self._entities if item.entity.strip()
        }
        self._sorted_entities = sorted(
            self._entities,
            key=lambda x: len(x.entity),
            reverse=True,
        )
        logger.info(
            "NED loaded: %s abbreviations, %s entities",
            len(self._abbreviations),
            len(self._entities),
        )

    def enhance_query(self, query: str) -> str:
        """Return a query enhanced by NED."""
        if not query or not query.strip():
            return query

        normalized_query = self._normalize_spaces(query)
        expanded_query = self._expand_abbreviations(normalized_query)
        matched = self._match_entities(expanded_query)

        if not matched:
            return expanded_query

        disambiguation_context = " ".join(
            f"{item.entity}: {item.description}" for item in matched[:3]
        )
        return f"{expanded_query}\n{disambiguation_context}"

    def _expand_abbreviations(self, text: str) -> str:
        expanded = text
        for abbr, full in sorted(self._abbreviations.items(), key=lambda x: len(x[0]), reverse=True):
            pattern = re.compile(rf"(?<!\w){re.escape(abbr)}(?!\w)", re.IGNORECASE)
            expanded = pattern.sub(full, expanded)
        return self._normalize_spaces(expanded)

    def _match_entities(self, text: str) -> list[NEDMatch]:
        lower_text = text.lower()
        matches: dict[str, NEDMatch] = {}

        # Prefer phrase-level matches from dictionary entities.
        for item in self._sorted_entities:
            entity = item.entity.strip()
            if not entity:
                continue
            if re.search(rf"(?<!\w){re.escape(entity.lower())}(?!\w)", lower_text):
                key = entity.lower()
                if key not in matches:
                    matches[key] = item

        # Add noun entities from NER when they map to known dictionary terms.
        try:
            for token, tag, *_ in ner(text):
                if tag not in NOUN_TAGS:
                    continue
                candidate = token.strip().lower()
                if not candidate or re.search(r"\d", candidate):
                    continue
                mapped = self._entity_by_lower.get(candidate)
                if mapped and mapped.entity.lower() not in matches:
                    matches[mapped.entity.lower()] = mapped
        except Exception as exc:
            logger.warning("NED NER failed, fallback to dictionary-only matching: %s", exc)

        return list(matches.values())

    @staticmethod
    def _normalize_spaces(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _load_abbreviations(path: Path) -> dict[str, str]:
        if not path.exists():
            logger.warning("Abbreviation file not found: %s", path)
            return {}
        abbreviations: dict[str, str] = {}
        with open(path, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                abbr = (row.get("abbreviation") or "").strip().lower()
                full = (row.get("full") or "").strip()
                if abbr and full:
                    abbreviations[abbr] = full
        return abbreviations

    @staticmethod
    def _load_entities(path: Path) -> list[NEDMatch]:
        if not path.exists():
            logger.warning("Entity dictionary file not found: %s", path)
            return []
        entities: list[NEDMatch] = []
        with open(path, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                entity = (row.get("Entity") or "").strip()
                description = (row.get("Text") or "").strip()
                if entity and description:
                    entities.append(NEDMatch(entity=entity, description=description))
        return entities
