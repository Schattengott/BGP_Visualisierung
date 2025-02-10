import os
import requests
import shutil
from datetime import datetime
from zipfile import ZipFile
import gzip
import tarfile
from dotenv import load_dotenv

# .env Datei laden
load_dotenv()

# Lizenzschlüssel sicher aus Umgebungsvariable holen
LICENSE_KEY = os.getenv("MAXMIND_LICENSE_KEY")
if not LICENSE_KEY:
    raise ValueError("Lizenzschlüssel nicht gefunden! Setze MAXMIND_LICENSE_KEY in einer .env Datei.")

# URLs für GeoIP Daten
GEOIP_URL_CITY = f"https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key={LICENSE_KEY}&suffix=tar.gz"
GEOIP_URL_ASN_CSV = f"https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN-CSV&license_key={LICENSE_KEY}&suffix=zip"

# Lokales Verzeichnis zum Speichern
LOCAL_DIR = "../data/geolite_database/"
os.makedirs(LOCAL_DIR, exist_ok=True)

def download_and_extract(url, local_dir):
    """Lädt die Datei herunter und extrahiert sie basierend auf dem Dateityp (.tar.gz, .zip, .gz)"""

    # Bestimme den Dateinamen
    filename = os.path.join(local_dir, url.split("=")[1] + ".tar.gz" if url.endswith("tar.gz") else ".zip")

    print(f"Lade {url} herunter...")
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    # Entpacken basierend auf Dateityp
    if filename.endswith(".tar.gz"):
        print(f"Entpacke {filename} als tar.gz...")
        with tarfile.open(filename, "r:gz") as tar:
            tar.extractall(local_dir)
    elif filename.endswith(".zip"):
        print(f"Entpacke {filename} als zip...")
        with ZipFile(filename, "r") as zip_ref:
            zip_ref.extractall(local_dir)
    elif filename.endswith(".gz"):
        print(f"Entpacke {filename} als gz...")
        with gzip.open(filename, "rb") as f_in:
            extracted_file_path = filename[:-3]  # Entfernt das .gz Suffix
            with open(extracted_file_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

    # Lösche die heruntergeladene Datei nach dem Entpacken
    os.remove(filename)

    # Verschiebe alle .mmdb oder .csv-Dateien eine Ebene höher
    for root, dirs, files in os.walk(local_dir):
        for file in files:
            if file.endswith(".mmdb") or file.endswith(".csv"):
                extracted_file_path = os.path.join(root, file)
                print(f"Verschiebe {extracted_file_path} nach {os.path.dirname(local_dir)}")
                shutil.move(extracted_file_path, os.path.join(os.path.dirname(local_dir), file))

if __name__ == "__main__":
    download_and_extract(GEOIP_URL_CITY, LOCAL_DIR)
    download_and_extract(GEOIP_URL_ASN_CSV, LOCAL_DIR)
