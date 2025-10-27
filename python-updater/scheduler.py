import subprocess
import schedule
import time
import argparse
import os

LOCAL_DIR = ""

def run_module(module_name, quiet):
    # Erstelle den vollständigen Pfad zum Modul
    module_path = os.path.join(LOCAL_DIR, module_name)

    if quiet:
        subprocess.run(["python", module_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.run(["python", module_path])

def job_a(quiet):
    print("[Scheduler] Starte Update_Geolite")
    run_module("update_geolite.py", quiet)

def job_b(quiet):
    print("[Scheduler] Starte Update_Routeviews")
    run_module("update_routeviews.py", quiet)
    print("[Scheduler] Starte Updater")
    run_module("updater.py", quiet)
    print("[Scheduler] Starte Eval_Attack")
    run_module("eval_attack.py", quiet)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", help="Unterdrückt die Ausgaben der Module")
    args = parser.parse_args()

    # Zeitpläne einrichten
    schedule.every().day.at("00:00").do(job_a, quiet=args.quiet)     # A einmal täglich
    schedule.every(15).minutes.do(job_b, quiet=args.quiet)         # B alle 15 Minuten

    # *** Direktstart beim Hochfahren ***
    print("[Scheduler] Initialer Direktstart aller Module")
    job_a(args.quiet)
    job_b(args.quiet)

    print("[Scheduler] Starte Zeitplan...")
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    main()
