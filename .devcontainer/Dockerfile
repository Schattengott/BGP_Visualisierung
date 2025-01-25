# Codespaces Dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:0-20

# Python hinzufügen
RUN apt-get update && apt-get install -y python3 python3-pip

# Arbeitsverzeichnis setzen
WORKDIR /workspaces/BGP_Visualisierung

# Python-Abhängigkeiten installieren
# COPY python-updater/requirements.txt /tmp/requirements.txt
# RUN pip3 install -r /tmp/requirements.txt

# Installiere die Node.js-Abhängigkeiten
RUN cd /workspaces/BGP_Visualisierung/backend && npm install
# Starte den Server
CMD ["node", "/workspaces/BGP_Visualisierung/backend/server.js"]