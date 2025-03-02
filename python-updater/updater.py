import geoip2.database
import requests
import json
from tqdm import tqdm
import csv

# Pfad zur entpackten GeoLite2-Datenbank
geo_db_path_geo = "../data/geolite_database/GeoLite2-City.mmdb"
geo_csv_path_ip = "../data/geolite_database/GeoLite2-ASN-Blocks-IPv4.csv"

update_routes_list = "../data/updates.txt"

# GeoIP2-Datenbank öffnen
#reader = geoip2.database.Reader(geo_db_path_geo)

def extract_unique_as(file_path):
    """Findet alle uniquen AS in einem Update-Dump und zählt, wie oft ein AS an Platz [0] steht"""
    unique_as = set()  # Set für einzigartige AS-Nummern
    first_as_count = {}  # Dictionary für die Häufigkeit des ersten AS

    with open(file_path, 'r') as file:
        for line in file:
            parts = line.split('|')  # Teile die Zeile anhand von '|'
            status = parts[2]
            if len(parts) > 6 and status == "A":  # Überprüfe, ob der AS-Pfad vorhanden ist
                as_path = parts[6]  # AS-Pfad (z.B. "3561 209 3356 ...")
                if as_path:  # Wenn der AS-Pfad nicht leer ist
                    as_list = as_path.split()  # Teile den AS-Pfad in einzelne AS
                    unique_as.update(as_list)  # Füge alle AS in die Menge ein

                    # Zähle, wie oft das erste AS im Pfad auftaucht
                    first_as = as_list[0]
                    if first_as in first_as_count:
                        first_as_count[first_as] += 1
                    else:
                        first_as_count[first_as] = 1

    # Gebe sowohl die einzigartigen AS als auch die Häufigkeit des ersten AS zurück
    return sorted(unique_as), first_as_count

def load_csv_data(csv_path):
    """
    Lädt die CSV-Datei und baut ein Dictionary auf, in dem der Schlüssel
    die ASN (als String) ist und der Wert eine Liste von IP-Ranges (hier wird
    z. B. die erste IP als Anhaltspunkt genutzt).
    """
    csv_data = {}
    with open(csv_path, newline='', encoding="utf-8") as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            # Annahme: Spalte 0 = start_ip, 1 = end_ip, 2 = ASN, 3 = Name
            asn = row[1].strip()
            entry = {
                "ip": row[0].strip().split("/")[0],
                "name": row[2].strip()
            }
            csv_data.setdefault(asn, []).append(entry)
    return csv_data

def create_points(autonomous_systems, unique_routes):
    """Für jede AS-Nummer: Versuche, zuerst die IP aus der CSV zu holen;
       wenn nicht vorhanden, benutze RIPEstat, um eine IP zu ermitteln.
       Anschließend werden Geodaten ermittelt und die Ergebnisse als JSON gespeichert."""
    result = []

    # CSV-Daten einmalig laden (effizienter als für jeden ASN die Datei zu öffnen)
    csv_data = load_csv_data(geo_csv_path_ip)

    with geoip2.database.Reader(geo_db_path_geo) as reader:
        for asn in tqdm(autonomous_systems, desc="Verarbeite AS-Nummern"):
            try:
                ip = None
                asn_str = str(asn)
                # Zuerst in der CSV nachsehen
                if asn_str in csv_data:
                    # Hier wird der erste Eintrag genutzt – du kannst die Logik bei Bedarf anpassen
                    csv_entry = csv_data[asn_str][0]
                    ip = csv_entry["ip"]
                    as_name = csv_entry["name"]
                else:
                    # Fallback: API-Abfrage über RIPEstat
                    ripe_url = f"https://stat.ripe.net/data/announced-prefixes/data.json?resource={asn}"
                    ripe_response = requests.get(ripe_url).json()
                    prefixes = ripe_response.get('data', {}).get('prefixes', [])
                    if not prefixes:
                        tqdm.write(f"Keine IPs für AS{asn} gefunden.")
                        continue
                    # Nimm die erste Prefix, entferne den CIDR-Part
                    ip = prefixes[0]['prefix'].split('/')[0]
                    as_name = "Unknown"  # Fallback, falls kein Name verfügbar ist

                # Geodaten mit der GeoLite2-Datenbank abrufen
                geo_response = reader.city(ip)
                city = geo_response.city.name or "Unknown"
                region = geo_response.subdivisions.most_specific.name or "Unknown"
                coordinates = [geo_response.location.latitude, geo_response.location.longitude]

                # Anzahl der ausgehenden Routes, sofern vorhanden
                routes_count = sum(1 for route in unique_routes if route[0] == asn)

                # Ergebnis hinzufügen
                result.append({
                    "asn": asn,
                    "as_name": as_name,
                    "routes_count": routes_count,
                    "ip": ip,
                    "city": city,
                    "region": region,
                    "coordinates": coordinates
                })
            except Exception as e:
                tqdm.write(f"Fehler bei AS{asn}: {e}")

    # Ergebnisse in eine JSON-Datei speichern
    output_file = "../data/points.json"
    with open(output_file, "w") as json_file:
        json.dump(result, json_file, indent=4)

    print(f"JSON-Datei gespeichert: {output_file}")

import json
from tqdm import tqdm

def create_routes(file_path):
    """Input: Update-Dump, Output eine JSON mit allen neuen Routen"""
    json_output = []
    seen_routes = set()  # Set zum Speichern bereits verarbeiteter Routen

    with open(file_path, 'r') as file:
        lines = file.readlines()
        i = 0

        for line in tqdm(lines, desc="Erstelle Routen"):
            parts = line.strip().split("|")

            # Extrahieren der relevanten Daten
            timestamp = parts[1]
            status = parts[2]
            ip = parts[3]
            start_as = parts[4]
            prefix = parts[5]
            asns = parts[6].split() if len(parts) > 6 else None  # Liste von AS-Nummern
            target_as = asns[-1] if asns else None  # Letzte AS-Nummer als Ziel-AS
            target_ip = parts[9] if len(parts) > 9 else None
            additional_info = parts[11] if len(parts) > 11 else None

            # Schlüssel zur Identifizierung eindeutiger Routen
            route_key = tuple(asns) if asns else None

            # Die JSON-Struktur für dieses Element
            route = {
                "timestamp": timestamp,
                "status": status,
                "ip": ip,
                "start_system": start_as,
                "target_system": target_as,  # Zielsystem ist nun die AS-Nummer
                "prefix": prefix,
                "as_path": asns,
                "additional_info": additional_info
            }

            # Die Route zur Liste hinzufügen, wenn Status "A" ist
            if status == "A" and route_key not in seen_routes:
                json_output.append(route)
                print(f"Route: {route} geaddet.")
                seen_routes.add(route_key)  # Neue Route speichern
            elif status == "A" and route_key in seen_routes:
                i = i+1
                #print(f"Folgende Route schon enthalten: {route_key}, insgesammt {i} Routen mehrfach.")

    # Die resultierende JSON-Ausgabe erstellen
    json_data = json.dumps(json_output, indent=4)

    # Optional: In eine Datei schreiben
    output_file = '../data/routes.json'
    with open(output_file, 'w') as out_file:
        out_file.write(json_data)

    print(f"JSON-Datei gespeichert: {output_file}")

    return seen_routes

if __name__ == "__main__":
    unique_autonomous_systems, first_as_count = extract_unique_as(update_routes_list)
    unique_routes = create_routes(update_routes_list)
    create_points(unique_autonomous_systems, unique_routes)
