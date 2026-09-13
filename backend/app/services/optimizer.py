import math
from typing import Dict, List, Optional, Tuple
from ortools.constraint_solver import pywrapcp, routing_enums_pb2


class RouteOptimizer:
    """Solves the Traveling Salesperson Problem (TSP) using Google OR-Tools.

    Optimized for last-mile delivery:
    - Calculates distance matrix with Haversine formula + urban circuity factor
    - Formulates open or closed TSP
    - Employs Guided Local Search metaheuristics for high solution quality
    - Produces step-by-step itinerary with cumulative distance and ETA
    """

    EARTH_RADIUS_KM = 6371.0
    URBAN_CIRCUITY_FACTOR = 1.3  # Road network detour factor vs great-circle
    AVG_URBAN_SPEED_KMH = 25.0  # Estimated urban driving speed
    STOP_SERVICE_TIME_MIN = 3.0  # Average parking and parcel handover time

    @classmethod
    def haversine_distance(
        cls, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Compute great-circle distance between two points in kilometers."""
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2.0) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return cls.EARTH_RADIUS_KM * c

    @classmethod
    def build_distance_matrix(
        cls, locations: List[Tuple[float, float]]
    ) -> List[List[int]]:
        """Build distance matrix in integer meters for OR-Tools."""
        num_locations = len(locations)
        matrix: List[List[int]] = []

        for i in range(num_locations):
            row: List[int] = []
            lat1, lon1 = locations[i]
            for j in range(num_locations):
                if i == j:
                    row.append(0)
                else:
                    lat2, lon2 = locations[j]
                    dist_km = cls.haversine_distance(lat1, lon1, lat2, lon2)
                    road_km = dist_km * cls.URBAN_CIRCUITY_FACTOR
                    # Convert to integer meters
                    row.append(int(road_km * 1000))
            matrix.append(row)
        return matrix

    @classmethod
    def solve_tsp(
        cls,
        origin: Tuple[float, float],
        destinations: List[Tuple[float, float]],
        return_to_origin: bool = False,
        time_limit_seconds: int = 5,
    ) -> Dict:
        """Optimize delivery itinerary starting from origin.

        Args:
            origin: (latitude, longitude) of courier starting point / depot
            destinations: List of (latitude, longitude) for deliveries
            return_to_origin: If False (open TSP), route ends at last package drop
            time_limit_seconds: Search time cutoff for OR-Tools

        Returns:
            Dict containing:
                - ordered_stop_indices: list of destination indices in visit order (0-indexed into destinations)
                - total_distance_km: total road distance in kilometers
                - estimated_time_minutes: total estimated delivery duration
                - leg_distances_km: distance between consecutive points
        """
        if not destinations:
            return {
                "ordered_stop_indices": [],
                "total_distance_km": 0.0,
                "estimated_time_minutes": 0.0,
                "leg_distances_km": [],
            }

        if len(destinations) == 1:
            dist_km = (
                cls.haversine_distance(
                    origin[0], origin[1], destinations[0][0], destinations[0][1]
                )
                * cls.URBAN_CIRCUITY_FACTOR
            )
            drive_time = (dist_km / cls.AVG_URBAN_SPEED_KMH) * 60.0
            total_time = drive_time + cls.STOP_SERVICE_TIME_MIN
            return {
                "ordered_stop_indices": [0],
                "total_distance_km": round(dist_km, 2),
                "estimated_time_minutes": round(total_time, 1),
                "leg_distances_km": [round(dist_km, 2)],
            }

        # Node 0 is origin, nodes 1..N are destinations
        all_locations = [origin] + destinations
        num_nodes = len(all_locations)
        matrix = cls.build_distance_matrix(all_locations)

        if not return_to_origin:
            # Open TSP: add a virtual dummy depot (node index = num_nodes)
            # Distance from any real stop to dummy depot = 0
            # Distance from dummy depot to any real stop = 0
            # Start at node 0 (origin), end at dummy depot
            dummy_index = num_nodes
            extended_matrix = []
            for row in matrix:
                # Distance from real stop to dummy depot is 0
                extended_matrix.append(row + [0])
            # Dummy depot row
            extended_matrix.append([0] * (num_nodes + 1))

            manager = pywrapcp.RoutingIndexManager(
                num_nodes + 1, 1, [0], [dummy_index]
            )
            routing = pywrapcp.RoutingModel(manager)

            def distance_callback(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return extended_matrix[from_node][to_node]

        else:
            # Closed TSP: start and end at origin (node 0)
            manager = pywrapcp.RoutingIndexManager(num_nodes, 1, 0)
            routing = pywrapcp.RoutingModel(manager)

            def distance_callback(from_index: int, to_index: int) -> int:
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = time_limit_seconds

        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            # Fallback to natural order if solver fails to find a solution
            ordered_indices = list(range(len(destinations)))
            total_km = 0.0
            legs = []
            current = origin
            for dest in destinations:
                d = cls.haversine_distance(current[0], current[1], dest[0], dest[1]) * cls.URBAN_CIRCUITY_FACTOR
                legs.append(round(d, 2))
                total_km += d
                current = dest
            drive_min = (total_km / cls.AVG_URBAN_SPEED_KMH) * 60.0
            total_min = drive_min + (len(destinations) * cls.STOP_SERVICE_TIME_MIN)
            return {
                "ordered_stop_indices": ordered_indices,
                "total_distance_km": round(total_km, 2),
                "estimated_time_minutes": round(total_min, 1),
                "leg_distances_km": legs,
            }

        # Extract route
        index = routing.Start(0)
        route_nodes = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route_nodes.append(node)
            index = solution.Value(routing.NextVar(index))

        # Filter out origin (0) and virtual depot (>= num_nodes)
        # Note: nodes in route_nodes correspond to all_locations indices
        delivery_stop_indices: List[int] = []
        for node in route_nodes:
            if 0 < node < num_nodes:
                # Convert back to destinations array index (destination_idx = node - 1)
                delivery_stop_indices.append(node - 1)

        # Calculate exact distances and ETAs
        leg_distances_km: List[float] = []
        total_distance_km = 0.0
        prev_loc = origin

        for dest_idx in delivery_stop_indices:
            curr_loc = destinations[dest_idx]
            leg_km = (
                cls.haversine_distance(
                    prev_loc[0], prev_loc[1], curr_loc[0], curr_loc[1]
                )
                * cls.URBAN_CIRCUITY_FACTOR
            )
            leg_distances_km.append(round(leg_km, 2))
            total_distance_km += leg_km
            prev_loc = curr_loc

        drive_minutes = (total_distance_km / cls.AVG_URBAN_SPEED_KMH) * 60.0
        total_minutes = drive_minutes + (
            len(delivery_stop_indices) * cls.STOP_SERVICE_TIME_MIN
        )

        return {
            "ordered_stop_indices": delivery_stop_indices,
            "total_distance_km": round(total_distance_km, 2),
            "estimated_time_minutes": round(total_minutes, 1),
            "leg_distances_km": leg_distances_km,
        }
