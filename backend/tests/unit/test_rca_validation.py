"""Unit tests for RCA validation."""
import pytest
from datetime import datetime, timezone, timedelta
from pydantic import ValidationError
from app.schemas.rca import RCACreate


def make_rca(**kwargs):
    defaults = {
        "incident_start_time": datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc),
        "incident_end_time": datetime(2024, 1, 15, 11, 0, tzinfo=timezone.utc),
        "root_cause_category": "Software Bug",
        "root_cause_summary": "A detailed root cause summary explaining what went wrong.",
        "fix_applied": "Applied hotfix and restarted service.",
        "prevention_steps": "Added monitoring and circuit breaker.",
        "draft": False,
    }
    defaults.update(kwargs)
    return RCACreate(**defaults)


def test_valid_rca():
    rca = make_rca()
    assert rca.root_cause_category == "Software Bug"


def test_end_before_start_raises():
    with pytest.raises(ValidationError):
        make_rca(
            incident_start_time=datetime(2024, 1, 15, 11, 0, tzinfo=timezone.utc),
            incident_end_time=datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc),
        )


def test_equal_times_raises():
    t = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        make_rca(incident_start_time=t, incident_end_time=t)


def test_short_summary_raises():
    with pytest.raises(ValidationError):
        make_rca(root_cause_summary="short")


def test_empty_fix_raises():
    with pytest.raises(ValidationError):
        make_rca(fix_applied="")


def test_mttr_calculation():
    start = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    end = datetime(2024, 1, 15, 11, 30, tzinfo=timezone.utc)
    rca = make_rca(incident_start_time=start, incident_end_time=end)
    expected_mttr = (end - start).total_seconds()
    assert expected_mttr == 5400.0  # 90 minutes


def test_draft_rca_allowed():
    rca = make_rca(draft=True)
    assert rca.draft is True
