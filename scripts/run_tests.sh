#!/bin/bash
# Run all backend tests
set -e

echo "=== IMS Test Suite ==="
echo ""

cd backend

echo "--- Unit Tests ---"
python -m pytest tests/unit/ -v --tb=short

echo ""
echo "--- Integration Tests ---"
python -m pytest tests/integration/ -v --tb=short

echo ""
echo "=== All tests passed! ==="
