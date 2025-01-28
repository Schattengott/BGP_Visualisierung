import geoip2.database
import requests
import json
from tqdm import tqdm

# Pfad zur entpackten GeoLite2-Datenbank
geo_db_path = "../data/geolite_database/GeoLite2-City_20250124/GeoLite2-City.mmdb"

# GeoIP2-Datenbank öffnen
#reader = geoip2.database.Reader(geo_db_path)

def extract_unique_as(file_path):
    """Findet alle uniquen AS in einem Update-Dump"""
    unique_as = set()  # Set für einzigartige AS-Nummern

    with open(file_path, 'r') as file:
        for line in file:
            parts = line.split('|')  # Teile die Zeile anhand von '|'
            if len(parts) > 6:  # Überprüfe, ob der AS-Pfad vorhanden ist
                as_path = parts[6]  # AS-Pfad (z.B. "3561 209 3356 ...")
                if as_path:  # Wenn der AS-Pfad nicht leer ist
                    as_list = as_path.split()  # Teile den AS-Pfad in einzelne AS
                    unique_as.update(as_list)  # Füge alle AS in die Menge ein

    return sorted(unique_as)  # Sortiere die AS-Nummern und gib sie zurück

def create_points(autonomous_systems):
    """Input AS, Output eine JSON mit weiteren Infos zu den AS(IP,Geolocation)"""
    result = []
    with geoip2.database.Reader(geo_db_path) as reader:
        for asn in tqdm(autonomous_systems, desc="Verarbeite AS-Nummern"):
            try:
                # Abruf der IP-Adresse von RIPEstat API
                ripe_url = f"https://stat.ripe.net/data/announced-prefixes/data.json?resource={asn}"
                ripe_response = requests.get(ripe_url).json()

                # IP-Adresse aus den Antwortdaten extrahieren
                prefixes = ripe_response.get('data', {}).get('prefixes', [])
                if not prefixes:
                    tqdm.write(f"Keine IPs für AS{asn} gefunden.")
                    continue

                # Erste verfügbare IP-Adresse auswählen
                ip = prefixes[0]['prefix'].split('/')[0]

                # Geodaten mit der GeoLite2-Datenbank abrufen
                geo_response = reader.city(ip)
                city = geo_response.city.name or "Unknown"
                region = geo_response.subdivisions.most_specific.name or "Unknown"
                coordinates = [geo_response.location.latitude, geo_response.location.longitude]

                # Daten hinzufügen
                result.append({
                    "asn": asn,
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

def create_routes(file_path):
    """Input: Update-Dump, Output eine JSON mit allen neuen Routen"""
    json_output = []
    with open(file_path, 'r') as file:
            lines = file.readlines()

            for line in tqdm(lines, desc="Erstelle Routen"):
                print(line)
                parts = line.strip().split("|")

                # Extrahieren der relevanten Daten
                timestamp = parts[1]
                status = parts[2]
                ip = parts[3]
                start_as = parts[4]
                prefix = parts[5]
                asns = parts[6].split()  if len(parts) > 6 else None# Liste von AS-Nummern
                target_as = None#asns[-1]  # Die letzte AS-Nummer im Pfad als Ziel-AS
                target_ip = parts[9] if len(parts) > 9 else None

                # Optional: Prüfen, ob es Startsysteme oder zusätzliche Informationen gibt
                additional_info = parts[11] if len(parts) > 11 else None

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

                # Die Route zur Liste hinzufügen
                json_output.append(route)

    # Die resultierende JSON-Ausgabe erstellen
    json_data = json.dumps(json_output, indent=4)

    # Optional: In eine Datei schreiben
    output_file = '../data/routes.json'
    with open(output_file, 'w') as out_file:
        out_file.write(json_data)

    print(f"JSON-Datei gespeichert: {output_file}")

if __name__ == "__main__":
    unique_autonomous_systems = extract_unique_as("../data/updates.20250101.0000.txt")
    create_points(unique_autonomous_systems)
    create_routes("../data/updates.20250101.0000.txt")
