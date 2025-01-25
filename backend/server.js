const express = require("express");
const app = express();
const port = 3000;

// JSON-Endpunkte für Punkte und Verbindungen
app.get("/points", (req, res) => {
  res.sendFile(__dirname + "/../data/points.json");
});

app.get("/connections", (req, res) => {
  res.sendFile(__dirname + "/../data/connections.json");
});

// Statische Dateien bereitstellen (HTML, JS, CSS)
app.use(express.static(__dirname + "/public"));

// Server starten
app.listen(port, () => {
  console.log(`Server läuft unter http://localhost:${port}`);
});
