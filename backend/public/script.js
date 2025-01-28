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

// Tile-Layer dunkel hinzufügen
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
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

// Funktion zur Generierung einer zufälligen Farbe basierend auf einem Index
function getRandomColor(index) {
  // Erzeuge eine zufällige Farbe mit einem festen "Seed" für jede Zahl
  const r = (index * 50 + 100) % 255;
  const g = (index * 30 + 150) % 255;
  const b = (index * 10 + 200) % 255;
  return `rgb(${r}, ${g}, ${b})`;
}

// Variable für die aktuell markierte Polyline speichern
let currentHighlightedPolyline = null;

// Funktion für das Erhöhen der Linienbreite bei Klick
function handleRouteClick(event) {
  const clickedPolyline = event.target;

  // Wenn eine andere Linie vorher markiert war, entferne die Markierung
  if (currentHighlightedPolyline && currentHighlightedPolyline !== clickedPolyline) {
    currentHighlightedPolyline.setStyle({
      weight: 2, // Originalbreite wiederherstellen
      color: currentHighlightedPolyline.options.color, // Ursprüngliche Farbe beibehalten
    });
  }

  // Setze eine größere Linienbreite für die angeklickte Route
  clickedPolyline.setStyle({
    weight: 10, // Größe der Linie erhöhen
    color: "yellow", // Optional: Farbe ändern, um die Route hervorzuheben
  });

  // Setze die aktuelle Polyline als die markierte Polyline
  currentHighlightedPolyline = clickedPolyline;
}

// Punkte und Verbindungen laden
fetch("/points")
  .then((response) => response.json())
  .then((points) => {
    // Punkte auf der Karte markieren
    points.forEach((point) => {
      L.marker(point.coordinates)
        .addTo(map)
        .bindPopup(`<b>${point.city}</b><br>${point.region}<br>IP: ${point.ip}<br>ASN: ${point.asn}`);
    });

    // Knotenliste anzeigen
    updateKnotenListe(points);

    // Verbindungen laden
    fetch("/routes")
      .then((response) => response.json())
      .then((routes) => {
        routes.forEach((route, index) => {

          if (route.as_path && route.as_path.length > 1) {
            const pathCoordinates = [];
            const routeColor = getRandomColor(index);

            route.as_path.forEach((asn) => {
              const point = points.find(p => p.asn === asn);

              if (point) {
                pathCoordinates.push(point.coordinates);
              } else {
                console.log(`AS ${asn} wurde nicht gefunden.`);
              }
            });

            if (pathCoordinates.length > 1) {
              // Polyline erstellen und Klick-Event hinzufügen
              const polyline = L.polyline(pathCoordinates, {
                color: routeColor,
                weight: 2,
              }).addTo(map);

              // Event Listener für Klick hinzufügen
              polyline.on("click", handleRouteClick);
            }
          }
        });
      });
  });
