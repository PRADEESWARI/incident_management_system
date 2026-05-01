"""Unit tests for MTTR calculation."""
import pytest
from datetime import datetime, timezone, timedelta
from app.utils.mttr import calculate_mttr, format_mttr


def test_mttr_one_hour():
    start = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    end = datetime(2024, 1, 15, 11, 0, tzinfo=timezone.utc)
    assert calculate_mttr(start, end) == 3600.0


def test_mttr_30_minutes():
    start = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    end = datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)
    assert calculate_mttr(start, end) == 1800.0


def test_mttr_format_seconds():
    assert format_mttr(45) == "45s"


def test_mttr_format_minutes():
    assert format_mttr(300) == "5m"


def test_mttr_format_hours():
    assert format_mttr(7200) == "2h"


def test_mttr_format_hours_and_minutes():
    assert format_mttr(5400) == "1h 30m"


def test_mttr_none_returns_none():
    assert calculate_mttr(None, None) is None
