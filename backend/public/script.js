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
  //const routeAsPath = currentHighlightedPolyline.as_path;
  //console.log("Route Knoten (ASNs):", routeAsPath);
}

let currentPage = 0;
const routesPerPage = 20;

function updatePageCounter(totalRoutes) {
  const totalPages = Math.ceil(totalRoutes / routesPerPage);
  document.getElementById("page-counter").textContent = `Page ${currentPage + 1} of ${totalPages}`;

  // Buttons aktivieren oder deaktivieren
  document.getElementById("prevPage").disabled = currentPage === 0;
  document.getElementById("nextPage").disabled = currentPage >= totalPages - 1;
}

let tempVisibleMarkers = [];
// Funktion zum Laden der Routen für einen bestimmten ASN
function loadRoutesForPoint(startAsn) {
  clearRoutes(); // Vorherige Routen löschen
  // Temporär sichtbare Marker mit routes_count == 0 wieder entfernen
  tempVisibleMarkers.forEach(marker => {
    if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
  tempVisibleMarkers = [];

  fetch("/routes")
    .then((response) => response.json())
    .then((routes) => {
      let colorIndex = 0;
      uniqueEdges.clear();
      let asnCount = new Map();
      const routeMap = new Map();

      const relevantRoutes = routes.filter((route) => route.as_path && route.as_path[0] === startAsn);

      // Gesamtanzahl der Seiten aktualisieren
      updatePageCounter(relevantRoutes.length);

      // Paginierung
      const start = currentPage * routesPerPage;
      const end = start + routesPerPage;
      const paginatedRoutes = relevantRoutes.slice(start, end);

      if (relevantRoutes.length === 0) {
        console.log("Keine Routen gefunden.");
        updateDurchquerteKnotenListe(asnCount, globalPoints, startAsn, globalMarkerMap);
        updateDurchquerteRoutenListe(startAsn, paginatedRoutes, routeMap);
        return;
      }

      relevantRoutes.forEach((route) => {
        if (!route || !Array.isArray(route.as_path)) return;
        let pathCoordinates = [];

        route.as_path.forEach((asn) => {
          if (!asn) return;

          const point = globalPoints.find((p) => p.asn === asn);
          if (point?.coordinates) {
            pathCoordinates.push(point.coordinates);
            asnCount.set(asn, (asnCount.get(asn) || 0) + 1);

            // Marker sichtbar machen, falls er es nicht ist
            const marker = globalMarkerMap.get(asn);
            if (marker && !map.hasLayer(marker)) {
              marker.addTo(map);
              // Nur temporäre Marker mit routes_count === 0 merken
              if (point.routes_count === 0) {
                tempVisibleMarkers.push(marker);
              }
            }
          }
        });

          if (pathCoordinates.length > 1 && paginatedRoutes.includes(route)) {
            try {
              const polyline = L.polyline(pathCoordinates, {
                color: getRandomColor(colorIndex++),
                weight: 2,
              }).addTo(map);
              polyline.on("click", handleRouteClick);
              uniqueEdges.set(route.as_path.join('-'), polyline);
              currentRoutePolylines.push(polyline);

              routeMap.set(route.timestamp, polyline);
            } catch (error) {
              console.error("Fehler bei der Polyline:", error);
            }
          }
        });

      updateDurchquerteKnotenListe(asnCount, globalPoints, startAsn, globalMarkerMap);
      updateDurchquerteRoutenListe(startAsn, paginatedRoutes, routeMap);
    })
    .catch((error) => console.error("Fehler beim Laden der Routen:", error));
}

function showNextRoutes() {
  if (globalStartAsn) {
    currentPage++;
    loadRoutesForPoint(globalStartAsn);
  }
}

function showPreviousRoutes() {
  if (currentPage > 0 && globalStartAsn) {
    currentPage--;
    loadRoutesForPoint(globalStartAsn);
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

function updateDurchquerteRoutenListe(startAsn, paginatedRoutes, routeMap) {
  const listContainer = document.getElementById("routeList");
  listContainer.innerHTML = ""; // Setze den Inhalt der Liste zurück

  // Füge die Überschrift hinzu
  const header = document.createElement("h3");
  header.innerHTML = `List of displayed Routes for ASN <span style="color: red;">${startAsn}</span>:`;
  listContainer.appendChild(header);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Erstelle den Tabellenkopf
  thead.innerHTML = `
    <tr>
      <th>Target</th>
      <th>Route</th>
      <th>Hops</th>
    </tr>
  `;

  // Flag, um zu prüfen, ob mindestens ein Eintrag hinzugefügt wurde
  let hasEntries = false;

  // Gehe durch das sortierte Array von ASNs und ihrer Durchquerungsanzahl
  paginatedRoutes.forEach(route => {
    if (route) {
      hasEntries = true; // Es gibt mindestens einen Eintrag
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${route.target_system || "Unbekanntes AS"}</td>
        <td>${route.as_path}</td>
        <td>${route.as_path.length}</td>
      `;

      // Füge einen Klick-Eventlistener für jede Tabellenzeile hinzu
      row.addEventListener("click", () => {
        if (routeMap.has(route.timestamp)) {
          const marker = routeMap.get(route.timestamp);
          marker.fire('click'); // Simuliere Klick auf den Marker
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

let globalPoints = [];
let globalMarkerMap = new Map();
let globalStartAsn = null;

// Lade die Punkte und füge Marker hinzu
fetch("/points")
  .then((response) => response.json())
  .then((points) => {
    //globalPoints = points;  // Speichere global
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
        globalPoints.push(point)
        // Berechne die Markerfarbe basierend auf der Routenanzahl
        const markerColor = getMarkerColor(point.routes_count);

        // Erstelle den Marker
        const marker = L.circleMarker(point.coordinates, {
          radius: 6,
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.8,
        });

        if (point.routes_count > 0) {
          marker.addTo(map);
        }

        // Füge das Popup mit Punktinformationen hinzu
        marker.bindPopup(
          `<b>${point.city || "Unbekannte Stadt"}</b><br>
           ${point.region || "Unbekannte Region"}<br>
           IP: ${point.ip || "Nicht verfügbar"}<br>
           ASN: <a href="https://ipinfo.io/AS${point.asn}" target="_blank">${point.asn}</a><br>
           AS-Name: ${point.as_name || "Unbekannt"}`
        );

        // Klick-Event für den Marker
        marker.on("click", function () {
          if (point.routes_count > 0) {
            globalStartAsn = point.asn; // Setze globalen Start-ASN
            currentPage = 0;
            loadRoutesForPoint(globalStartAsn);
          }
        });

        markerMap.set(point.asn, marker);
      } else {
        console.log(`Punkt mit ASN ${point.asn} hat ungültige oder fehlende Koordinaten und wird übersprungen.`);
      }
    });

    globalMarkerMap = markerMap; // Speichere `markerMap` global
    updateKnotenListe(points, markerMap);
  })
  .catch((error) => {
    console.error("Fehler beim Laden der Punkte:", error);
  });
