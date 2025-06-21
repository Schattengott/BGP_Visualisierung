# 🌐 BGP-Visualisierung

Ein plattformunabhängiges Tool zur Verarbeitung und Visualisierung von BGP-Routing-Informationen, bestehend aus einem Python-Parser (inkl. `bgpdump`) und einem Node.js-Backend. Bereitgestellt über einen Docker-Container.

---

## 🚀 Features

- Verarbeitung von BGP-Update-Dateien mit `bgpdump`
- Python-Skripte zur automatisierten Datenaufbereitung
- Node.js-Backend zur Bereitstellung einer Webanwendung oder API
- Nutzung von `supervisord` zur gleichzeitigen Ausführung beider Komponenten
- Unterstützung für Linux, Windows (inkl. WSL) und Docker

---

## 📦 Voraussetzungen

- [Docker](https://www.docker.com/)

---

## ⚙️ Installation & Nutzung

### 🔨 Docker Image bauen

```bash
docker build -t bgp-visualisierung .
```

### ▶️ Container starten
```bash
docker run -p 3000:3000 bgp-visualisierung
```

Anschließend ist die Webanwendung erreichbar unter:
👉 http://localhost:3000
