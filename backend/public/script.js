// Karte initialisieren
const map = L.map("map", {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 14,
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 0.5,
});

// Tile-Layer dunkel hinzufügen
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
}).addTo(map);

// Variable für die aktuell geladenen Routen-Polylinien
let currentRoutePolylines = [];

// Funktion zum Entfernen der aktuell geladenen Routen
function clearRoutes() {
  // Alle aktuellen Routen entfernen
  currentRoutePolylines.forEach(polyline => {
    map.removeLayer(polyline); // Entferne Polyline von der Karte
  });
  currentRoutePolylines = []; // Leere das Array
}

// Funktion zur Berechnung der Markerfarbe basierend auf routes_count
function getMarkerColor(routesCount) {
  const intensity = Math.min(255, 50 + routesCount * 20); // Helligkeit skalieren
  return `rgb(${intensity}, ${intensity}, 50)`; // Gelbtöne
}

// Generiert eine zufällige Farbe für jede Route
function getRandomColor(index) {
  const r = (index * 50 + 100) % 255;
  const g = (index * 30 + 150) % 255;
  const b = (index * 10 + 200) % 255;
  return `rgb(${r}, ${g}, ${b})`;
}

let currentHighlightedPolyline = null;

// Funktion zur Hervorhebung der Route beim Klick
function handleRouteClick(event) {
  const clickedPolyline = event.target;

  if (currentHighlightedPolyline && currentHighlightedPolyline !== clickedPolyline) {
    currentHighlightedPolyline.setStyle({
      weight: 2,
      color: currentHighlightedPolyline.options.color,
    });
  }

  clickedPolyline.setStyle({
    weight: 10,
  });

  currentHighlightedPolyline = clickedPolyline;
}

// ** Optimierung: Kanten speichern, um doppelte Linien zu vermeiden **
const uniqueEdges = new Map();
const edgeToRouteMap = new Map();

// Funktion zum Laden der Routen für einen bestimmten ASN
function loadRoutesForPoint(startAsn, points) {
  clearRoutes(); // Alle aktuellen Routen löschen, bevor neue Routen geladen werden

  fetch("/routes")
    .then((response) => response.json())
    .then((routes) => {
      let colorIndex = 0;
      uniqueEdges.clear();

      // Filtere Routen, die den aktuellen Punkt als Startpunkt haben (ASN an erster Stelle)
      const relevantRoutes = routes.filter((route) => route.as_path && route.as_path[0] === startAsn);

      if (relevantRoutes.length === 0) {
        console.log("Keine Routen gefunden, die mit diesem Knoten starten.");
        return; // Keine Routen gefunden, verlasse die Funktion
      }

      // Für jede relevante Route
      relevantRoutes.forEach((route) => {
        let pathCoordinates = [];
        let routeColor = getRandomColor(colorIndex++);

        route.as_path.forEach((asn) => {
          const point = points.find((p) => p.asn === asn);
          if (point) {
            pathCoordinates.push(point.coordinates);
          }
        });

        // Wenn die Route mehr als einen Punkt hat, erstelle die Polyline
        if (pathCoordinates.length > 1) {
          for (let i = 0; i < pathCoordinates.length - 1; i++) {
            const start = pathCoordinates[i];
            const end = pathCoordinates[i + 1];
            const edgeKey = JSON.stringify([start, end].sort());

            // Erstelle eine neue Kante, falls sie noch nicht existiert
            if (!uniqueEdges.has(edgeKey)) {
              const polyline = L.polyline([start, end], {
                color: routeColor,
                weight: 2,
              }).addTo(map);

              // Setze das Klick-Event für die Polyline
              polyline.on("click", handleRouteClick);
              uniqueEdges.set(edgeKey, polyline);
              currentRoutePolylines.push(polyline); // Polyline zu den aktuellen Routen hinzufügen
            }
          }
        }
      });
    })
    .catch((error) => {
      console.error("Fehler beim Laden der Routen:", error);
    });
}

// Funktion zum Aktualisieren der Knotenliste
function updateKnotenListe(points, markerMap) {
  const listContainer = document.getElementById("list");
  listContainer.innerHTML = ""; // Reset der Liste
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Tabellenkopf
  thead.innerHTML = `
    <tr>
      <th>ASN</th>
      <th>IP</th>
      <th>Stadt</th>
      <th>Region</th>
      <th>Routenanzahl</th>
    </tr>
  `;

  // Punkte durchgehen und nur Punkte mit routes_count > 0 anzeigen
  points.forEach((point) => {
    if (point.routes_count > 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${point.asn || "Keine ASN"}</td>
        <td>${point.ip || "Nicht verfügbar"}</td>
        <td>${point.city || "Unbekannte Stadt"}</td>
        <td>${point.region || "Unbekannte Region"}</td>
        <td>${point.routes_count}</td>
      `;

      // Klickereignis für den Listeneintrag hinzufügen
      row.addEventListener("click", () => {
        if (markerMap.has(point.asn)) {
          const marker = markerMap.get(point.asn);
          // map.setView(marker.getLatLng(), 10); // Zoom zu diesem Marker
          marker.fire('click'); // Simuliere Klick auf den Marker
        }
      });

      tbody.appendChild(row);
    }
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  listContainer.appendChild(table);
}

// Punkte laden und Marker hinzufügen
fetch("/points")
  .then((response) => response.json())
  .then((points) => {
    const markerMap = new Map();

    points.forEach((point) => {
      // Überprüfen, ob der Punkt eine gültige ASN und Koordinaten hat
      const hasValidCoordinates = Array.isArray(point.coordinates) && point.coordinates.length === 2;
      const hasValidAsn = point.asn !== undefined && point.asn !== null;

      // Weitere Validierung der Koordinaten
      const isValidCoordinates =
        hasValidCoordinates &&
        typeof point.coordinates[0] === "number" && point.coordinates[0] >= -90 && point.coordinates[0] <= 90 &&
        typeof point.coordinates[1] === "number" && point.coordinates[1] >= -180 && point.coordinates[1] <= 180;

      if (isValidCoordinates && hasValidAsn) {
        // Berechnung der Markerfarbe basierend auf der routes_count
        const markerColor = getMarkerColor(point.routes_count);

        // Marker erstellen
        const marker = L.circleMarker(point.coordinates, {
          radius: 6,
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.8,
        }).addTo(map);

        // Marker Popup mit Punktinformationen
        marker.bindPopup(
          `<b>${point.city || "Unbekannte Stadt"}</b><br>${point.region || "Unbekannte Region"}<br>IP: ${point.ip || "Nicht verfügbar"}<br>ASN: ${point.asn}<br>Routen: ${point.routes_count}`
        );

        // Klick-Event für den Marker
        marker.on("click", function () {
          loadRoutesForPoint(point.asn, points);
        });

        markerMap.set(point.asn, marker);
      } else {
        // Fehler in der Konsole ausgeben, wenn ASN oder Koordinaten fehlen oder ungültig sind
        console.log(`Punkt mit ASN ${point.asn} hat ungültige oder fehlende Koordinaten und wird übersprungen.`);
      }
    });

    updateKnotenListe(points, markerMap);
  })
  .catch((error) => {
    console.error("Fehler beim Laden der Punkte:", error);
  });
