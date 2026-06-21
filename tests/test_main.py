import pytest
from fastapi.testclient import TestClient
from main import app, cached_full_sites, data_ready_event

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_cached_data():
    # Mock data directly in the global state of main.py
    global cached_full_sites
    
    mock_data = [
        {
            "slug": "test-plads",
            "name": "Test Plads",
            "latitude": 55.0,
            "longitude": 10.0,
            "occupiedDates": ["2026-06-25"]
        }
    ]
    
    # Overwrite the global cache for the test
    import main
    main.cached_full_sites = mock_data
    main.data_ready_event.set()
    
    yield
    
    # Reset
    main.cached_full_sites = []
    main.data_ready_event.clear()

def test_get_all_sites_full_returns_data():
    response = client.get("/api/sites_full")
    assert response.status_code == 200
    data = response.json()
    assert "sites" in data
    assert len(data["sites"]) == 1
    assert data["sites"][0]["slug"] == "test-plads"
