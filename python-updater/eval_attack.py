import json
import csv
import ipaddress
import math

json_points = "../data/points.json"
json_routes = "../data/routes.json"

geo_db_path_geo = "../data/geolite_database/GeoLite2-City.mmdb"
geo_csv_path_ip = "../data/geolite_database/GeoLite2-ASN-Blocks-IPv4.csv"

def read_json(file_path):
    """Findet alle uniquen AS in einem Update-Dump und zählt, wie oft ein AS an Platz [0] steht"""
    with open(file_path, 'r', encoding='utf-8') as f:
        daten = json.load(f)
    return daten

def save_json(json_data, file_path):
    try:
        with open(file_path, 'w', encoding='utf-8') as json_file:
            json.dump(json_data, json_file, ensure_ascii=False, indent=4)
        print(f"Die JSON-Daten wurden erfolgreich in {file_path} gespeichert.")
    except Exception as e:
        print(f"Fehler beim Speichern der Datei: {e}")

def unique_ip_and_start_as_in_routes(daten):
    eintraege_set = set()
    einzigartige_objekte = []

    for eintrag in daten:
        kombi = (eintrag['ip'], eintrag['start_system'])
        if kombi not in eintraege_set:
            eintraege_set.add(kombi)
            einzigartige_objekte.append({
                'ip': eintrag['ip'],
                'start_system': eintrag['start_system']
            })

    return einzigartige_objekte

def haversine_distance(coord1, coord2):
    """Berechnet die Entfernung zwischen zwei Koordinatenpaaren in Kilometern."""
    try:
        if coord1 is None or coord2 is None:
            raise ValueError("Eine der Koordinaten ist None.")
        if len(coord1) != 2 or len(coord2) != 2:
            raise ValueError("Koordinaten müssen zwei Elemente haben (lat, lon).")

        lat1, lon1 = float(coord1[0]), float(coord1[1])
        lat2, lon2 = float(coord2[0]), float(coord2[1])
    except (TypeError, ValueError) as e:
        # Logmeldung für Debugging und None zurückgeben, damit Aufrufer entscheiden kann
        print(f"Ungültige Koordinaten für Distanzberechnung: {e} — coord1={coord1}, coord2={coord2}")
        return 1000000
    R = 6371  # Erdradius in km
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def filter_routes_by_geo_distance(routes, points, max_distance_km=3000):
    """
    Entfernt Routen aus 'routes', bei denen die geografische Entfernung zwischen
    start_system und target_system (aus 'points') größer als max_distance_km ist.

    Gibt eine gefilterte Routenliste zurück.
    """
    # Punkte in ein Dict umwandeln, damit wir schnell über ASN zugreifen können
    as_coords = {str(p["asn"]): p["coordinates"] for p in points if "coordinates" in p}

    neue_routes = []
    entfernte_routen = 0

    for route in routes:
        start_as = str(route.get("start_system"))
        target_as = str(route.get("target_system"))

        if start_as in as_coords and target_as in as_coords:
            coord1 = as_coords[start_as]
            coord2 = as_coords[target_as]

            distance = haversine_distance(coord1, coord2)

            if distance <= max_distance_km:
                neue_routes.append(route)
            else:
                entfernte_routen += 1
                print(f"Entferne Route: {start_as} → {target_as} ({distance:.1f} km)")
        else:
            # Wenn einer der AS keine Koordinaten hat, Route löschen oder loggen
            print(f"Keine Koordinaten für {start_as} oder {target_as}, Route wird entfernt.")
            entfernte_routen += 1
            #neue_routes.append(route)

    print(f"\n➡️ {entfernte_routen} Routen entfernt (max. Distanz {max_distance_km} km).")
    return neue_routes

def update_routes_count(points, routes):
    """
    Aktualisiert das Feld 'routes_count' in den AS-Punkten basierend auf der
    Anzahl der aktuell verbleibenden Routen, die von diesem AS starten.
    """
    # Zähle, wie oft jedes start_system in routes vorkommt
    route_counts = {}
    for route in routes:
        start_as = str(route.get("start_system"))
        route_counts[start_as] = route_counts.get(start_as, 0) + 1

    # Update in den points-Daten
    for point in points:
        asn = str(point.get("asn"))
        new_count = route_counts.get(asn, 0)
        old_count = point.get("routes_count", 0)
        if old_count != new_count:
            print(f"🔄 Aktualisiere routes_count für AS{asn}: {old_count} → {new_count}")
        point["routes_count"] = new_count

    return points

def load_csv_data_asn(csv_path):
    """
    Lädt die CSV-Datei und baut ein Dictionary auf, in dem der Schlüssel
    die ASN (als String) ist und der Wert eine Liste von IP-Ranges (hier wird
    z. B. die erste IP als Anhaltspunkt genutzt).
    """
    csv_data = {}
    with open(csv_path, newline='', encoding="utf-8") as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            # Annahme: Spalte 0 = ip, 1 = as_number, 2 = as_name
            asn = row[1].strip()
            entry = {
                "ip": row[0].strip(),
                "name": row[2].strip()
            }
            csv_data.setdefault(asn, []).append(entry)
    return csv_data

def check_ip_in_asn(json_data, csv_data):
    """
    Überprüft, ob eine IP-Adresse aus der JSON zu einer der IPs in der CSV-Daten passt
    (basierend auf dem Start-System = ASN).
    """
    treffer = []

    for obj in json_data:
        ip = obj["ip"]
        asn = obj["start_system"]

        print(f"Überprüfe IP {ip} für ASN {asn}...")

        # Wenn der ASN in den CSV-Daten vorhanden ist
        if asn in csv_data:
            #print(f"ASN {asn} gefunden, durchsuche die CSV-Daten...")
            gefunden = False  # Flag für Treffer
            for eintrag in csv_data[asn]:
                #print(f"Vergleiche IP {ip} mit CSV-IP {eintrag['ip']} (aus AS {eintrag['name']})")
                try:
                    # Überprüfen, ob die IP in der CIDR-Range enthalten ist
                    network = ipaddress.ip_network(eintrag["ip"], strict=False)
                    if ipaddress.ip_address(ip) in network:
                        gefunden = True
                        break  # Wenn ein Treffer gefunden wurde, reicht das
                except ValueError as e:
                    print(f"Ungültige IP-Adresse in der CSV oder JSON: {e}")

            # Wenn kein Treffer gefunden wurde, füge die IP zur Liste hinzu
            if not gefunden:
                print(f"Kein Treffer gefunden für IP {ip} (ASN {asn})")
                treffer.append({
                    "ip": ip,
                    "start_system": asn,
                    "not_found": True  # Markiere als Nicht-Treffer
                })

    return treffer

def update_is_legit(json_data, csv_data, ammount):
    """
    Durchläuft die JSON-Daten und erhöht den 'is_legit' Zähler um 5,
    wenn für das start_system keine passende IP in den CSV-Daten gefunden wurde.
    """
    for obj in json_data:
        start_system = obj["start_system"]
        ip = obj["ip"]

        #print(f"Überprüfe IP {ip} für start_system {start_system}...")

        # Flag für Treffer
        gefunden = False

        # Durchsuche die CSV-Daten nach dem start_system
        for eintrag in csv_data:
            if eintrag["start_system"] == start_system:
                #print(f"Gefundenes CSV-Eintrag für {start_system}: IP {eintrag['ip']}")

                # Wenn die IP übereinstimmt, setzen wir gefunden auf True
                if ip == eintrag["ip"]:
                    #print(f"Treffer: IP {ip} passt zu CSV-IP {eintrag['ip']}")
                    gefunden = True
                    break

        # Wenn keine passende IP gefunden wurde, erhöhe 'is_legit' um 5
        if gefunden:
            #print(f"Kein Treffer gefunden für start_system {start_system}. Erhöhe 'is_legit' um 5.")
            obj["is_legit"] += ammount

    return json_data

if __name__ == "__main__":
    points = read_json(json_points)
    routes = read_json(json_routes)

    routes = filter_routes_by_geo_distance(routes, points, max_distance_km=100)
    points = update_routes_count(points, routes)

    einzigartige_objekte = unique_ip_and_start_as_in_routes(routes)

    csv_data = load_csv_data_asn(geo_csv_path_ip)
    treffer = check_ip_in_asn(einzigartige_objekte,csv_data)

    routes = update_is_legit(routes, treffer, 5)

    save_json(routes, json_routes)
    save_json(points, json_points)
