"""Unit tests for incident workflow engine."""
import pytest
from app.services.incident_service import is_valid_transition, VALID_TRANSITIONS
from app.models.postgres_models import IncidentStatus


def test_valid_open_to_acknowledged():
    assert is_valid_transition(IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED) is True


def test_valid_open_to_investigating():
    assert is_valid_transition(IncidentStatus.OPEN, IncidentStatus.INVESTIGATING) is True


def test_invalid_open_to_closed():
    """Cannot go directly from OPEN to CLOSED."""
    assert is_valid_transition(IncidentStatus.OPEN, IncidentStatus.CLOSED) is False


def test_invalid_open_to_resolved():
    """Cannot go directly from OPEN to RESOLVED without investigation."""
    assert is_valid_transition(IncidentStatus.OPEN, IncidentStatus.RESOLVED) is False


def test_valid_investigating_to_resolved():
    assert is_valid_transition(IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED) is True


def test_valid_resolved_to_closed():
    assert is_valid_transition(IncidentStatus.RESOLVED, IncidentStatus.CLOSED) is True


def test_valid_closed_to_reopened():
    assert is_valid_transition(IncidentStatus.CLOSED, IncidentStatus.REOPENED) is True


def test_invalid_cancelled_transitions():
    """Cancelled incidents cannot transition to anything."""
    for status in IncidentStatus:
        assert is_valid_transition(IncidentStatus.CANCELLED, status) is False


def test_all_statuses_have_transitions():
    """All statuses except CANCELLED should have at least one valid transition."""
    for status in IncidentStatus:
        if status != IncidentStatus.CANCELLED:
            assert len(VALID_TRANSITIONS.get(status, [])) > 0, f"{status} has no transitions"


def test_reopened_can_transition():
    assert is_valid_transition(IncidentStatus.REOPENED, IncidentStatus.INVESTIGATING) is True
    assert is_valid_transition(IncidentStatus.REOPENED, IncidentStatus.ACKNOWLEDGED) is True
