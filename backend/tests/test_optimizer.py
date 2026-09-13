import pytest
from app.services.optimizer import RouteOptimizer


def test_haversine_distance_same_point():
    """Distance between identical coordinates should be 0.0."""
    dist = RouteOptimizer.haversine_distance(-23.5505, -46.6333, -23.5505, -46.6333)
    assert dist == pytest.approx(0.0, abs=1e-4)


def test_haversine_distance_known_points():
    """Test known distance between Praça da Sé and Av. Paulista in São Paulo (~3 km)."""
    praca_se = (-23.55052, -46.633309)
    av_paulista = (-23.561414, -46.655881)
    dist = RouteOptimizer.haversine_distance(
        praca_se[0], praca_se[1], av_paulista[0], av_paulista[1]
    )
    # Straight-line distance is ~2.6km
    assert 2.0 < dist < 3.2


def test_distance_matrix_generation():
    """Test integer distance matrix generation."""
    points = [
        (-23.55052, -46.633309),
        (-23.561414, -46.655881),
        (-23.567000, -46.649000),
    ]
    matrix = RouteOptimizer.build_distance_matrix(points)
    assert len(matrix) == 3
    assert len(matrix[0]) == 3
    assert matrix[0][0] == 0
    assert matrix[1][1] == 0
    assert matrix[0][1] > 0
    assert matrix[0][1] == matrix[1][0]


def test_solve_tsp_empty():
    """Empty destinations list should return zero metrics."""
    result = RouteOptimizer.solve_tsp(
        origin=(-23.5505, -46.6333),
        destinations=[],
    )
    assert result["ordered_stop_indices"] == []
    assert result["total_distance_km"] == 0.0


def test_solve_tsp_single_destination():
    """Single destination should be routed directly."""
    origin = (-23.5505, -46.6333)
    destinations = [(-23.5614, -46.6558)]

    result = RouteOptimizer.solve_tsp(origin=origin, destinations=destinations)
    assert result["ordered_stop_indices"] == [0]
    assert result["total_distance_km"] > 0
    assert result["estimated_time_minutes"] > 0


def test_solve_tsp_multiple_destinations():
    """Multiple delivery destinations in São Paulo should produce valid, non-repeating sequence."""
    origin = (-23.5505, -46.6333)  # Hub / Sé
    destinations = [
        (-23.5614, -46.6558),  # Paulista
        (-23.5874, -46.6576),  # Ibirapuera
        (-23.5670, -46.7020),  # Pinheiros
        (-23.5000, -46.6200),  # Santana (North)
        (-23.5900, -46.6800),  # Vila Olímpia
    ]

    result = RouteOptimizer.solve_tsp(
        origin=origin,
        destinations=destinations,
        return_to_origin=False,
        time_limit_seconds=3,
    )

    ordered = result["ordered_stop_indices"]
    # All destinations must be visited exactly once
    assert set(ordered) == {0, 1, 2, 3, 4}
    assert len(ordered) == 5
    assert result["total_distance_km"] > 0
    assert len(result["leg_distances_km"]) == 5
