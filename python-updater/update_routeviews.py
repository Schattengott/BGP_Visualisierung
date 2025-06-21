import os
import requests
import subprocess
import platform
import shutil
import bz2
from datetime import datetime, timedelta

# Basis-URL für BGP-Updates
BASE_URL = "http://archive.routeviews.org/bgpdata/{year}.{month}/UPDATES/"
LOCAL_DIR = "../data/"
os.makedirs(LOCAL_DIR, exist_ok=True)
LOCAL_DIR_TMP = "../data/.tmp"

def windows_to_wsl_path(win_path):
    """Konvertiert einen Windows-Pfad in das WSL-Format."""
    win_path = os.path.abspath(win_path)
    win_path = win_path.replace("\\", "/")

    # Laufwerksbuchstaben ersetzen (z.B. C: -> /mnt/c, F: -> /mnt/f)
    if win_path[1] == ":":
        win_path = f"/mnt/{win_path[0].lower()}{win_path[2:]}"

    return win_path

def get_latest_update_url():
    """Erzeugt die URL für das aktuellste BGP-Update basierend auf UTC-Zeit mit korrektem 15-Minuten-Intervall"""
    now = datetime.utcnow() - timedelta(minutes=30)

    # Rundung auf das letzte 15-Minuten-Intervall
    minute_block = (now.minute // 15) * 15  # 00, 15, 30, 45
    rounded_time = now.replace(minute=minute_block, second=0, microsecond=0)

    year, month, day, hour, minute = rounded_time.strftime("%Y"), rounded_time.strftime("%m"), rounded_time.strftime("%d"), rounded_time.strftime("%H"), rounded_time.strftime("%M")
    filename = f"updates.{year}{month}{day}.{hour}{minute}.bz2"

    return BASE_URL.format(year=year, month=month) + filename

def download_update_dump(url, output_dir):
    os.makedirs(LOCAL_DIR_TMP, exist_ok=True)
    filename = os.path.join(LOCAL_DIR_TMP, url.split('/')[-1])

    # Prüfen, ob Datei schon existiert
    if os.path.exists(filename):
        print(f"{filename} existiert bereits.")
        return filename

    response = requests.get(url, stream=True)
    with open(filename, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"Gespeichert unter: {filename}")

    # Entpacke die .bz2 Datei und speichere sie als 'updates'
    updates_file = os.path.join(LOCAL_DIR_TMP, 'updates')
    with bz2.BZ2File(filename, 'rb') as f_in:
        with open(updates_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    # Lösche die ursprüngliche .bz2 Datei nach dem Entpacken
    os.remove(filename)
    print(f"Entpackt als {updates_file}")

    return updates_file

def parse_update_with_bgpdump(update_file, output_dir, output_filename):
    """Parst das Update mit bgpdump und speichert es als Textdatei."""
    output_file = os.path.join(output_dir, output_filename)

    system = platform.system()

    if system == "Windows":
        #Konvertiere Windows-Pfade zu WSL-Pfaden
        wsl_update_file = windows_to_wsl_path(update_file)
        wsl_output_file = windows_to_wsl_path(output_file)

        print(f"[Windows/WSL] Verarbeite mit bgpdump: {wsl_update_file} -> {wsl_output_file}")

        #Erstelle das Verzeichnis für die Ausgabe in WSL in Windows
        subprocess.run(["wsl", "mkdir", "-p", windows_to_wsl_path(output_dir)], check=True)
        #Führe bgpdump in WSL aus
        subprocess.run(["wsl", "bgpdump", "-m", wsl_update_file, "-O", wsl_output_file], check=True)

    else:
        #Unter Linux
        print(f"[Linux] Verarbeite mit bgpdump: {update_file} -> {output_file}")
        
        subprocess.run(["bgpdump", "-m", update_file, "-O", output_file],  check=True)

    return output_file

def clean_old_files(dir):
    """Löscht alte Update-Dateien, behält nur die neueste"""
    if os.path.exists(dir):
        shutil.rmtree(dir)
        print(f"Alte Dateien aus {dir} gelöscht.")

if __name__ == "__main__":
    update_url = get_latest_update_url()
    update_file = download_update_dump(update_url, LOCAL_DIR_TMP)

    if update_file:
        parsed_file = parse_update_with_bgpdump(update_file, LOCAL_DIR, "updates.txt")
    clean_old_files(LOCAL_DIR_TMP)
