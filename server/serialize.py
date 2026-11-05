"""Strict JSON: no NaN or Infinity, dates as ISO strings, numpy and pandas values as plain Python."""
from __future__ import annotations

import datetime as dt
import json
import math

import numpy as np
import pandas as pd
from fastapi.responses import Response

DECIMALS = 6


def clean(value):
    """Turn anything the engine returns into values json.dumps accepts with allow_nan=False."""
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, dict):
        return {str(key): clean(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [clean(item) for item in value]
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        if not math.isfinite(number):
            return None
        rounded = round(number, DECIMALS)
        return int(rounded) if rounded.is_integer() and abs(rounded) < 1e15 else rounded
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.strftime("%Y-%m-%d")
    if isinstance(value, (dt.datetime, dt.date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, np.ndarray):
        return [clean(item) for item in value.tolist()]
    if value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, pd.DataFrame):
        return records(value)
    if isinstance(value, pd.Series):
        return clean(value.to_dict())
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return str(value)


def records(frame: pd.DataFrame) -> list[dict]:
    """A frame as a list of clean dicts."""
    return [clean(row) for row in frame.to_dict(orient="records")]


def dumps(value) -> bytes:
    """Encode a payload. Raises if anything non-finite slipped through clean()."""
    return json.dumps(clean(value), allow_nan=False, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class StrictJSONResponse(Response):
    """The default response class: cleans the payload, and refuses NaN or Infinity."""

    media_type = "application/json"

    def render(self, content) -> bytes:
        if isinstance(content, (bytes, bytearray)):
            return bytes(content)
        return dumps(content)


def text_or_none(value) -> str | None:
    """A text cell, or None when it's blank or missing."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    text = str(value).strip()
    return text or None
