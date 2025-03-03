// Karte initialisieren
const map = L.map("map", {
  center: [20, 0], // Startkoordinaten der Karte (Mittelpunkt)
  zoom: 2, // Anfangs-Zoomlevel
  minZoom: 2, // Minimales Zoomlevel
  maxZoom: 14, // Maximales Zoomlevel
  maxBounds: [[-90, -180], [90, 180]], // Maximale Kartenbegrenzungen
  maxBoundsViscosity: 0.5, // Verhindert das Verlassen der maximalen Karte
  // preferCanvas: true // Verwendet Canvas für bessere Performance bei vielen Elementen
});

// Füge den Dunkel-Mode Tile-Layer hinzu
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd", // Subdomains für die Karten
  // noWrap: true // Verhindert die Wiederholung der Kacheln bei horizontalem Scrollen
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
  const routeAsPath = currentHighlightedPolyline.as_path;
  console.log("Route Knoten (ASNs):", routeAsPath);
}

// Funktion zum Laden der Routen für einen bestimmten ASN
function loadRoutesForPoint(startAsn, points, markerMap) {
  clearRoutes(); // Lösche alle aktuellen Routen

  fetch("/routes")
    .then((response) => response.json())
    .then((routes) => {
      let colorIndex = 0;
      uniqueEdges.clear();
      let asnCount = new Map(); // Map zur Zählung der ASNs

      const relevantRoutes = routes.filter((route) => route.as_path && route.as_path[0] === startAsn);

      if (relevantRoutes.length === 0) {
        console.log("Keine Routen gefunden, die mit diesem Knoten starten.");
        updateDurchquerteKnotenListe(asnCount, points, startAsn, markerMap); // Aktiviere die Knotenliste (leer)
        return;
      }

      relevantRoutes.forEach((route) => {
        if (!route || !Array.isArray(route.as_path)) {
          console.warn("Ungültige Route oder fehlender as_path:", route);
          return;
        }
        let pathCoordinates = [];
        route.as_path.forEach((asn) => {
          if (asn == null) {
            console.warn("Null-Wert im as_path gefunden.");
            return; // Überspringe null-Werte
          }
          const point = points.find((p) => p.asn === asn);
          if (point && point.coordinates) {
            pathCoordinates.push(point.coordinates);
            asnCount.set(asn, (asnCount.get(asn) || 0) + 1); // Zähle, wie oft der ASN vorkommt
          } else {
            console.warn(`Kein Punkt oder keine Koordinaten für ASN ${asn} gefunden.`);
          }
        });

        if (pathCoordinates.length > 1) {
          try {
            const polyline = L.polyline(pathCoordinates, {
              color: getRandomColor(colorIndex++),
              weight: 2,
            }).addTo(map);
            polyline.on("click", handleRouteClick);
            uniqueEdges.set(route.as_path.join('-'), polyline);
            currentRoutePolylines.push(polyline);
          } catch (error) {
            console.error("Fehler beim Erstellen der Polyline:", error);
          }
        }
      });

      updateDurchquerteKnotenListe(asnCount, points, startAsn, markerMap); // Aktiviere die Liste der durchquerten Knoten
    })
    .catch((error) => {
      console.error("Fehler beim Laden der Routen:", error);
    });
}

function updateRouteList(asnCount) {
  const routeListContainer = document.getElementById("route-list");
  if (!routeListContainer) {
    console.error("Element 'route-list' nicht gefunden.");
    return;
  }
  routeListContainer.innerHTML = "";

  try {
    // Falls asnCount null oder leer ist, gib eine Nachricht aus
    if (!asnCount || asnCount.size === 0) {
      routeListContainer.innerHTML = "<p>Keine Routen gefunden.</p>";
      return;
    }

    const list = document.createElement("ul");

    // Filtere null/undefinierte ASNs heraus und sortiere nach Häufigkeit (höchste zuerst)
    const sortedAsns = [...asnCount.entries()]
      .filter(([asn, count]) => asn != null)
      .sort((a, b) => b[1] - a[1]);

    sortedAsns.forEach(([asn, count]) => {
      const listItem = document.createElement("li");
      listItem.textContent = `ASN ${asn}: ${count}x durchquert`;
      list.appendChild(listItem);
    });

    routeListContainer.appendChild(list);
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Routenliste:", error);
    routeListContainer.innerHTML = "<p>Fehler beim Laden der Routenliste.</p>";
  }
}

function updateDurchquerteKnotenListe(asnCount, points, startAsn, markerMap) {
  const listContainer = document.getElementById("route-list");
  listContainer.innerHTML = ""; // Setze den Inhalt der Liste zurück

  // Füge die Überschrift hinzu
  const header = document.createElement("h3");
  header.innerHTML = `List of traversed ASNs for ASN <span style="color: red;">${startAsn}</span>:`;
  listContainer.appendChild(header);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Erstelle den Tabellenkopf
  thead.innerHTML = `
    <tr>
      <th>ASN</th>
      <th>AS-Name</th>
      <th>Ø</th>
    </tr>
  `;

  // Konvertiere asnCount Map in ein Array und sortiere nach der Anzahl der Durchquerungen (absteigend)
  const sortedAsnCount = [...asnCount].sort((a, b) => b[1] - a[1]);

  // Flag, um zu prüfen, ob mindestens ein Eintrag hinzugefügt wurde
  let hasEntries = false;

  // Gehe durch das sortierte Array von ASNs und ihrer Durchquerungsanzahl
  sortedAsnCount.forEach(([asn, count]) => {
    // Suche den Punkt, um Stadt und Region zu bekommen
    const point = points.find(p => p.asn === asn);
    if (point) {
      hasEntries = true; // Es gibt mindestens einen Eintrag
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${asn}</td>
        <td>${point.as_name || "Unbekanntes AS"}</td>
        <td>${count}</td>
      `;

      // Klickereignis für den Listeneintrag hinzufügen
      row.addEventListener("click", () => {
        if (markerMap.has(point.asn)) {
          const marker = markerMap.get(point.asn);
          // Zoom zu diesem Marker (optional)
          // marker.fire('click'); // Simuliere Klick auf den Marker
          marker.openPopup(); // Popup des Markers öffnen, ohne den Marker zu klicken
        }
      });

      tbody.appendChild(row);
    }
  });

  // Falls keine Einträge vorhanden sind, eine Meldung hinzufügen
  if (!hasEntries) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="3">No outgoing routes found for this AS</td>`;
    tbody.appendChild(row);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  listContainer.appendChild(table);
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
      <th>ASN-Name</th>
      <th>IP</th>
      <th>City</th>
      <th>Region</th>
      <th>Routes</th>
    </tr>
  `;

  const sortedPoints = points
  .sort((a, b) => b.routes_count - a.routes_count);

  // Durchlaufe alle Punkte und zeige nur Punkte mit Routenanzahl > 0 an
  sortedPoints.forEach((point) => {
    if (point.routes_count > 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${point.asn || "Keine ASN"}</td>
        <td>${point.as_name || "Kein AS-Name"}</td>
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
          `<b>${point.city || "Unbekannte Stadt"}</b><br>${point.region || "Unbekannte Region"}<br>IP: ${point.ip || "Nicht verfügbar"}<br>ASN: ${point.asn}<br>AS-Name: ${point.as_name}`
        );

        // Klick-Event für den Marker
        marker.on("click", function () {
          loadRoutesForPoint(point.asn, points, markerMap);
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
