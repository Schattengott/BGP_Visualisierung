// Initialisiere die Karte
const map = L.map("map", {
  center: [20, 0], // Startkoordinaten der Karte (Mittelpunkt)
  zoom: 2, // Anfangs-Zoomlevel
  minZoom: 2, // Minimales Zoomlevel
  maxZoom: 14, // Maximales Zoomlevel
  maxBounds: [[-90, -180], [90, 180]], // Maximale Kartenbegrenzungen
  maxBoundsViscosity: 0.5, // Verhindert das Verlassen der maximalen Karte
});

// Füge den Dunkel-Mode Tile-Layer hinzu
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd", // Subdomains für die Karten
}).addTo(map);

let uniqueEdges = new Map(); // Speichert Kanten (Routen) in einer Map
let currentRoutePolylines = []; // Array für alle geladenen Routen (Polylinien)

// Funktion zum Entfernen aller aktuellen Routen
function clearRoutes() {
  currentRoutePolylines.forEach(polyline => {
    map.removeLayer(polyline); // Entferne jede Polyline von der Karte
  });
  currentRoutePolylines = []; // Leere das Array
}

// Funktion zur Berechnung der Markerfarbe basierend auf der Routenanzahl
function getMarkerColor(routesCount) {
  const intensity = Math.min(255, 50 + routesCount * 20); // Helligkeit basierend auf der Routenanzahl
  return `rgb(${intensity}, ${intensity}, 50)`; // Gelbe Farben
}

// Funktion zur Berechnung eines Rotschattens auf Grundlage der Routenanzahl
function getRedColor(routesCount) {
  const redIntensity = Math.min(255, Math.floor(routesCount / 40)); // Skaliere den Rotton je nach Routenanzahl
  return `rgb(${redIntensity}, ${Math.max(128, 255 - redIntensity)}, 50)`; // Rot-zu-Gelb Verlauf
}

// Funktion zur Generierung einer zufälligen Farbe für jede Route
function getRandomColor(index) {
  const r = (index * 50 + 100) % 255;
  const g = (index * 30 + 150) % 255;
  const b = (index * 10 + 200) % 255;
  return `rgb(${r}, ${g}, ${b})`; // RGB-Farben für jede Route
}

let currentHighlightedPolyline = null; // Die aktuell hervorgehobene Route

// Funktion zur Hervorhebung einer Route beim Klick
function handleRouteClick(event) {
  const clickedPolyline = event.target;

  // Wiederherstellen der Standardfarbe, wenn eine andere Route hervorgehoben ist
  if (currentHighlightedPolyline && currentHighlightedPolyline !== clickedPolyline) {
    currentHighlightedPolyline.setStyle({
      weight: 2,
      color: currentHighlightedPolyline.options.color,
    });
  }

  // Hervorhebung der geklickten Route
  clickedPolyline.setStyle({
    weight: 10, // Dickere Linie zur Hervorhebung
    // color: "red", // Optional: Setze eine andere Farbe für die Hervorhebung
  });

  currentHighlightedPolyline = clickedPolyline; // Setze die neue hervorgehobene Route

  // Ausgabe der Route (AS-Path) in der Konsole
  const routeAsPath = clickedPolyline.as_path;
  console.log("Route Knoten (ASNs):", routeAsPath);
}

// Funktion zum Laden der Routen für einen bestimmten ASN
function loadRoutesForPoint(startAsn, points) {
  clearRoutes(); // Lösche alle aktuellen Routen, bevor neue geladen werden

  fetch("/routes")
    .then((response) => response.json())
    .then((routes) => {
      let colorIndex = 0;
      uniqueEdges.clear(); // Leere die Kanten-Map

      // Filtere nur die Routen, die mit dem aktuellen ASN als Startpunkt übereinstimmen
      const relevantRoutes = routes.filter((route) => route.as_path && route.as_path[0] === startAsn);

      if (relevantRoutes.length === 0) {
        console.log("Keine Routen gefunden, die mit diesem Knoten starten.");
        return; // Keine Routen gefunden, beende die Funktion
      }

      // Verarbeite jede relevante Route
      relevantRoutes.forEach((route) => {
        let pathCoordinates = [];
        let routeColor = getRandomColor(colorIndex++); // Zufällige Farbe für jede Route

        route.as_path.forEach((asn) => {
          const point = points.find((p) => p.asn === asn);
          if (point) {
            pathCoordinates.push(point.coordinates); // Füge Koordinaten der Route hinzu
          }
        });

        // Wenn die Route mehr als einen Punkt hat, erstelle die Polyline
        if (pathCoordinates.length > 1) {
          // Erstelle die Polyline für die gesamte Route
          const polyline = L.polyline(pathCoordinates, {
            color: routeColor,
            weight: 2,
          }).addTo(map);

          // Speichere den AS-Path als benutzerdefiniertes Attribut
          polyline.as_path = route.as_path;

          // Setze das Klick-Event für die Route
          polyline.on("click", handleRouteClick);

          uniqueEdges.set(route.as_path.join('-'), polyline); // Speichere die Kante
          currentRoutePolylines.push(polyline); // Füge die Polyline zu den geladenen Routen hinzu
        }
      });
    })
    .catch((error) => {
      console.error("Fehler beim Laden der Routen:", error);
    });
}

// Funktion zur Aktualisierung der Knotenliste
function updateKnotenListe(points, markerMap) {
  const listContainer = document.getElementById("list");
  listContainer.innerHTML = ""; // Setze den Inhalt der Liste zurück
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Erstelle den Tabellenkopf
  thead.innerHTML = `
    <tr>
      <th>ASN</th>
      <th>IP</th>
      <th>Stadt</th>
      <th>Region</th>
      <th>Routenanzahl</th>
    </tr>
  `;

  // Durchlaufe alle Punkte und zeige nur Punkte mit Routenanzahl > 0 an
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
          // Zoom zu diesem Marker (optional)
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

// Lade die Punkte und füge Marker hinzu
fetch("/points")
  .then((response) => response.json())
  .then((points) => {
    const markerMap = new Map();

    points.forEach((point) => {
      // Validierung der Koordinaten und ASN
      const hasValidCoordinates = Array.isArray(point.coordinates) && point.coordinates.length === 2;
      const hasValidAsn = point.asn !== undefined && point.asn !== null;

      // Weitere Validierung der Koordinaten
      const isValidCoordinates =
        hasValidCoordinates &&
        typeof point.coordinates[0] === "number" && point.coordinates[0] >= -90 && point.coordinates[0] <= 90 &&
        typeof point.coordinates[1] === "number" && point.coordinates[1] >= -180 && point.coordinates[1] <= 180;

      if (isValidCoordinates && hasValidAsn) {
        // Berechne die Markerfarbe basierend auf der Routenanzahl
        const markerColor = getMarkerColor(point.routes_count);

        // Erstelle den Marker
        const marker = L.circleMarker(point.coordinates, {
          radius: 6,
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.8,
        }).addTo(map);

        // Füge das Popup mit Punktinformationen hinzu
        marker.bindPopup(
          `<b>${point.city || "Unbekannte Stadt"}</b><br>${point.region || "Unbekannte Region"}<br>IP: ${point.ip || "Nicht verfügbar"}<br>ASN: ${point.asn}<br>Routen: ${point.routes_count}`
        );

        // Klick-Event für den Marker
        marker.on("click", function () {
          loadRoutesForPoint(point.asn, points);
        });

        markerMap.set(point.asn, marker);
      } else {
        console.log(`Punkt mit ASN ${point.asn} hat ungültige oder fehlende Koordinaten und wird übersprungen.`);
      }
    });

    updateKnotenListe(points, markerMap);
  })
  .catch((error) => {
    console.error("Fehler beim Laden der Punkte:", error);
  });
