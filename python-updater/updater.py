import json
import random

def generate_random_points(num_points=5):
    points = []
    for i in range(num_points):
        ip = f"192.168.1.{i + 1}"
        city = f"City-{i + 1}"
        region = f"Region-{i + 1}"
        coordinates = [random.uniform(-90, 90), random.uniform(-180, 180)]
        points.append({
            "ip": ip,
            "city": city,
            "region": region,
            "coordinates": coordinates
        })
    return points

def generate_random_connections(points):
    connections = []
    for i in range(len(points) - 1):
        connections.append({
            "from": points[i]["ip"],
            "to": points[i + 1]["ip"]
        })
    return connections

if __name__ == "__main__":
    points = generate_random_points(10)
    connections = generate_random_connections(points)

    # Punkte speichern
    with open("../data/points.json", "w") as f:
        json.dump(points, f, indent=4)

    # Verbindungen speichern
    with open("../data/connections.json", "w") as f:
        json.dump(connections, f, indent=4)

    print("JSON-Dateien aktualisiert!")
