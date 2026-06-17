"""Named Entity Disambiguation (NED) service for query enhancement."""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from underthesea import ner, word_tokenize

from app.config import config

logger = logging.getLogger(__name__)

NOUN_TAGS = {"N", "Np", "Nb"}

# Abbreviations with the same token-boundary shape as their source word are unsafe
# to replace via a raw word-boundary regex.  For example "đa" is a substring of
# the regular Vietnamese word "tối đa".  Such short forms must only be expanded
# when they appear as a standalone token in the tokenized query.
_TOKEN_SAFETY_MIN_LEN = 3


@dataclass
class NEDMatch:
    entity: str
    description: str


@dataclass
class NEDEnhancement:
    """Container for the two forms of a query used downstream.

    - ``search_query`` should be passed to vector/keyword retrieval.  It keeps
      the user's original wording and only expands abbreviations that are safe
      token-wise, so retrieval is not poisoned by substitutions such as
      "tối đa" -> "tối đề án".
    - ``llm_context`` is optional disambiguation context (entity definitions)
      that can be appended to the LLM prompt without touching the search query.
    """

    search_query: str
    llm_context: str = ""

    @property
    def combined(self) -> str:
        """Original behavior: search query + context separated by a newline."""
        if not self.llm_context:
            return self.search_query
        return f"{self.search_query}\n{self.llm_context}"


class NEDService:
    """Enhance user query by expanding abbreviations and disambiguating entities.

    The service now returns a ``NEDEnhancement`` object that separates the
    retrieval query from the LLM disambiguation context.  This prevents
    abbreviation expansion from corrupting vector/BM25 retrieval while still
    providing useful entity definitions to the generation model.
    """

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
        """Return a query enhanced by NED (backward-compatible string output)."""
        return self.enhance(query).combined

    def enhance(self, query: str) -> NEDEnhancement:
        """Enhance a query and return separated search query + LLM context."""
        if not query or not query.strip():
            return NEDEnhancement(search_query=query)

        normalized_query = self._normalize_spaces(query)
        expanded_query = self._expand_abbreviations(normalized_query)
        matched = self._match_entities(expanded_query)

        if not matched:
            return NEDEnhancement(search_query=expanded_query)

        disambiguation_context = " ".join(
            f"{item.entity}: {item.description}" for item in matched[:3]
        )
        return NEDEnhancement(
            search_query=expanded_query,
            llm_context=disambiguation_context,
        )

    def _expand_abbreviations(self, text: str) -> str:
        """Expand abbreviations without breaking normal Vietnamese words.

        Long abbreviations (>= _TOKEN_SAFETY_MIN_LEN characters) are replaced
        via a word-boundary regex as before.  Short or token-shape-conflicting
        abbreviations are only replaced when they appear as a standalone token
        in the word-tokenized query.  This stops "đa" in "tối đa" from becoming
        "đề án" while still expanding "đa" when it stands alone.
        """
        expanded = text

        # Sort by length descending so longer abbreviations win (e.g. "ctđt"
        # before "ct").
        sorted_abbrs = sorted(
            self._abbreviations.items(),
            key=lambda x: len(x[0]),
            reverse=True,
        )

        tokens = [t.strip() for t in word_tokenize(text.lower()) if t.strip()]
        for abbr, full in sorted_abbrs:
            abbr_lower = abbr.lower()
            if len(abbr) >= _TOKEN_SAFETY_MIN_LEN:
                pattern = re.compile(rf"(?<!\w){re.escape(abbr)}(?!\w)", re.IGNORECASE)
                expanded = pattern.sub(full, expanded)
                continue

            # For short abbreviations, require an exact token match.
            if abbr_lower not in tokens:
                continue

            # Replace only whole-token occurrences.  We split on whitespace /
            # punctuation, rebuild, and keep punctuation around the token.
            token_pattern = re.compile(
                rf"(?<![\w-]){re.escape(abbr)}(?![\w-])",
                re.IGNORECASE,
            )
            expanded = token_pattern.sub(full, expanded)

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
