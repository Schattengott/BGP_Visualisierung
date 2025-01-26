// Karte initialisieren
const map = L.map("map", {
  center: [20, 0], // Standardposition
  zoom: 2,         // Standardzoom
  minZoom: 2,      // Kein Herauszoomen unter Zoomstufe 2
  maxZoom: 10,     // Kein Hineinzoomen über Zoomstufe 10
  maxBounds: [
    [-90, -180],   // Südwest-Ecke (unterstes linkes Eck der Welt)
    [90, 180],     // Nordost-Ecke (oberstes rechtes Eck der Welt)
  ],
  maxBoundsViscosity: 0.5, // "Elastizität" der Begrenzung (1.0 = strikt)
});

// Tile-Layer hell hinzufügen
//L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//  maxZoom: 19,
//}).addTo(map);

// Tile-Layer dunkel hinzufügen
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
  //maxZoom: 19,
}).addTo(map);

// Funktion zur Darstellung der Knotenliste als Tabelle
function updateKnotenListe(points) {
  const listContainer = document.getElementById("list");
  listContainer.innerHTML = ""; // Liste zurücksetzen

  // Tabelle erstellen
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Tabellenkopf
  thead.innerHTML = `
    <tr>
      <th>Stadt</th>
      <th>Region</th>
      <th>IP</th>
      <th>Koordinaten</th>
    </tr>
  `;

  // Tabellendaten (Knoten)
  points.forEach((point) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${point.city}</td>
      <td>${point.region}</td>
      <td>${point.ip}</td>
      <td>[${point.coordinates.join(", ")}]</td>
    `;
    tbody.appendChild(row);
  });

  // Tabelle zusammenfügen
  table.appendChild(thead);
  table.appendChild(tbody);
  listContainer.appendChild(table);
}

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

    // Knotenliste anzeigen
    updateKnotenListe(points);

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
