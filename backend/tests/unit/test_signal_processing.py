"""Unit tests for signal processing logic."""
import pytest
from datetime import datetime, timezone
from app.schemas.signal import SignalIngest, SignalType, SignalSeverity
from app.services.signal_service import (
    compute_fingerprint, get_severity, get_component_type
)
from app.models.postgres_models import IncidentSeverity, ComponentType


def make_signal(signal_type=SignalType.API_500_ERROR, severity=SignalSeverity.HIGH, component_id="test-api"):
    return SignalIngest(
        signal_type=signal_type,
        component_id=component_id,
        component_name="Test API",
        severity=severity,
        message="Test signal",
    )


def test_fingerprint_same_component_same_type():
    s1 = make_signal(component_id="payment-api")
    s2 = make_signal(component_id="payment-api")
    assert compute_fingerprint(s1) == compute_fingerprint(s2)


def test_fingerprint_different_component():
    s1 = make_signal(component_id="payment-api")
    s2 = make_signal(component_id="checkout-api")
    assert compute_fingerprint(s1) != compute_fingerprint(s2)


def test_fingerprint_different_type():
    s1 = make_signal(signal_type=SignalType.API_500_ERROR)
    s2 = make_signal(signal_type=SignalType.API_TIMEOUT)
    assert compute_fingerprint(s1) != compute_fingerprint(s2)


def test_severity_mapping_db_down():
    signal = make_signal(signal_type=SignalType.DB_DOWN, severity=SignalSeverity.MEDIUM)
    # DB_DOWN should always map to P0_CRITICAL regardless of signal severity
    assert get_severity(signal) == IncidentSeverity.P0_CRITICAL


def test_severity_mapping_api_500():
    signal = make_signal(signal_type=SignalType.API_500_ERROR)
    assert get_severity(signal) == IncidentSeverity.P1_HIGH


def test_severity_fallback():
    signal = make_signal(signal_type=SignalType.GENERIC_ALERT, severity=SignalSeverity.CRITICAL)
    assert get_severity(signal) == IncidentSeverity.P0_CRITICAL


def test_component_type_api():
    assert get_component_type("API_500_ERROR") == ComponentType.API
    assert get_component_type("API_TIMEOUT") == ComponentType.API


def test_component_type_db():
    assert get_component_type("DB_DOWN") == ComponentType.RDBMS
    assert get_component_type("DB_SLOW_QUERY") == ComponentType.RDBMS


def test_component_type_security():
    assert get_component_type("SECURITY_BRUTE_FORCE") == ComponentType.SECURITY


def test_component_type_unknown():
    assert get_component_type("UNKNOWN_TYPE") == ComponentType.UNKNOWN


def test_timestamp_normalization():
    signal = SignalIngest(
        signal_type=SignalType.API_500_ERROR,
        component_id="test",
        component_name="Test",
        severity=SignalSeverity.HIGH,
        message="Test",
        timestamp="2024-01-15T10:30:00Z",
    )
    assert signal.timestamp is not None
    assert signal.timestamp.tzinfo is not None


def test_component_id_sanitization():
    signal = SignalIngest(
        signal_type=SignalType.API_500_ERROR,
        component_id="Payment API Service",
        component_name="Payment API",
        severity=SignalSeverity.HIGH,
        message="Test",
    )
    assert signal.component_id == "payment_api_service"
