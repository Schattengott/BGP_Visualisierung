FROM ubuntu:22.04

# Vermeide interaktive Prompts
ENV DEBIAN_FRONTEND=noninteractive

# Installiere Systemtools inkl. bgpdump, Python, Node
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        nodejs \
        npm \
        bgpdump \
        build-essential \
        curl \
        git \
        ca-certificates && \
    apt-get clean

# Fix für Node unter Ubuntu
RUN [ -f /usr/bin/node ] || ln -s /usr/bin/nodejs /usr/bin/node

# Symlink für python3 -> python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Setze Arbeitsverzeichnis
WORKDIR /app

# Python-Abhängigkeiten
COPY python-updater/requirements.txt ./python-updater/
RUN pip3 install --no-cache-dir -r python-updater/requirements.txt

# Node-Abhängigkeiten
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# App-Code kopieren (Python & Node)
WORKDIR /app
COPY backend/ ./backend/
COPY python-updater/ ./python-updater/
COPY data/ ./data/

# Supervisor konfigurieren, um mehrere Prozesse zu starten
COPY .devcontainer/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Port öffnen (z. B. Express läuft auf 3000, Flask auf 5000, konfigurierbar)
EXPOSE 3000

# Startbefehl – Supervisor startet beide Prozesse
CMD ["/usr/bin/.devcontainer/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
