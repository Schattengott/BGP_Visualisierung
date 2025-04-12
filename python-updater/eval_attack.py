import json
import csv
import ipaddress

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

def update_is_legit(json_data, csv_data):
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
            obj["is_legit"] += 5

    return json_data

if __name__ == "__main__":
    points = read_json(json_points)
    routes = read_json(json_routes)

    einzigartige_objekte = unique_ip_and_start_as_in_routes(routes)

    csv_data = load_csv_data_asn(geo_csv_path_ip)
    treffer = check_ip_in_asn(einzigartige_objekte,csv_data)

    routes = update_is_legit(routes, treffer)

    save_json(routes, json_routes)
