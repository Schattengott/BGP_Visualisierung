# BGP_Visualisierung
Visualisierung eines BGP-Hijacking-Angriffs

Struktur:

BGP_Visualisierung/
├── backend/
│   ├── server.js           # Node.js Backend
│   ├── package.json        # Node.js Abhängigkeiten
│   └── public/             # Statische Dateien
│       ├── index.html      # Deine Webseite
│       ├── script.js       # Deine Logik für die Karte
│       └── styles.css      # Optional: CSS für deine Webseite
├── data/
│   ├── points.json         # Punkte-Daten
│   └── connections.json    # Verbindungs-Daten
├── python-updater/
│   ├── updater.py          # Python-Skript, das die JSON-Dateien aktualisiert
│   ├── requirements.txt    # Python-Abhängigkeiten
├── .devcontainer/
│   ├── devcontainer.json   # Konfiguration für Codespaces
│   └── Dockerfile          # Optional: Dockerfile für deine Umgebung
└── README.md               # Beschreibung des Projekts