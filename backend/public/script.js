// Karte initialisieren
const map = L.map("map").setView([20, 0], 2);

// Tile-Layer hinzufügen
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// Punkte und Verbindungen laden
fetch("/points")
  .then((response) => response.json())
  .then((points) => {
    // Punkte auf der Karte markieren
    points.forEach((point) => {
      L.marker(point.coordinates)
        .addTo(map)
        .bindPopup(`<b>${point.city}</b><br>${point.region}<br>IP: ${point.ip}`);
    });

    // Verbindungen laden
    fetch("/routes")
      .then((response) => response.json())
      .then((routes) => {
        routes.forEach((route) => {
          const fromPoint = points.find((p) => p.ip === route.from);
          const toPoint = points.find((p) => p.ip === route.to);

          if (fromPoint && toPoint) {
            // Linie zwischen den Punkten zeichnen
            L.polyline([fromPoint.coordinates, toPoint.coordinates], {
              color: "red",
              weight: 2,
            }).addTo(map);
          }
        });
      });
  });
