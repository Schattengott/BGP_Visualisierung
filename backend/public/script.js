let allRoutes = null;
let activeStartSystem = null;
let activeRoutes = [];
let activeMarker = null;
let points = []; // Punkte global speichern

// Karte initialisieren
const map = L.map("map", {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 14,
  maxBounds: [
    [-90, -180],
    [90, 180],
  ],
  maxBoundsViscosity: 0.5,
});

// Tile-Layer dunkel hinzufügen
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
}).addTo(map);

function getRandomColor(index) {
  // Erzeuge eine zufällige Farbe mit einem festen "Seed" für jede Zahl
  const r = (index * 50 + 100) % 255;
  const g = (index * 30 + 150) % 255;
  const b = (index * 10 + 200) % 255;
  return `rgb(${r}, ${g}, ${b})`;
}

// Funktion zur Berechnung der Farbe basierend auf der routes_count
function getColorForRoutesCount(routesCount) {
  // Skalieren des routesCount (z.B. Werte zwischen 0 und 3000)
  const minCount = 0;
  const maxCount = 3000; // Beispiel für maximalen routes_count (anpassen nach Bedarf)

  // Berechne den Rotanteil basierend auf der routes_count
  const red = Math.min(255, Math.floor((routesCount / maxCount) * 255)); // Skaliere den Wert auf 0 bis 255

  // Der Marker wird von grün (für niedrige Werte) nach rot (für hohe Werte) skaliert
  return `rgb(${red}, 0, 0)`; // Rotanteil ändert sich je nach routes_count
}

// 🛠️ Funktion zum Laden aller Routen
async function loadAllRoutes() {
    if (allRoutes !== null) return; // Falls bereits geladen, nichts tun

    try {
        console.log("Lade Routen...");
        const response = await fetch('/routes');
        allRoutes = await response.json();
        console.log("Routen erfolgreich geladen:", allRoutes.length);
    } catch (error) {
        console.error('Fehler beim Laden der Routen:', error);
    }
}

// 🛠️ Funktion zum Filtern der Routen für ein bestimmtes Startsystem
function getRoutesForStartSystem(startSystem) {
    if (!allRoutes) return [];
    return allRoutes.filter(route => route.start_system === startSystem);
}

let currentHighlightedPolyline = null; // Aktuell hervorgehobene Route

// Klick-Handler für Routen
function handleRouteClick(event) {
    const clickedPolyline = event.target;

    // Falls eine andere Route markiert war, entferne die Markierung
    if (currentHighlightedPolyline && currentHighlightedPolyline !== clickedPolyline) {
        currentHighlightedPolyline.setStyle({
            weight: 2, // Standardbreite wiederherstellen
            color: currentHighlightedPolyline.options.color, // Ursprüngliche Farbe beibehalten
        });
    }

    // Markierung für die neue Route setzen
    clickedPolyline.setStyle({
        weight: 10, // Route hervorheben
        // color: "yellow", // Optional: Farbe ändern
    });

    currentHighlightedPolyline = clickedPolyline;
}

// Zeigt die Routen basierend auf dem ausgewählten Start-AS an
async function updateRoutesDisplay(selectedStartSystem, marker) {
    console.log(`Klick auf ASN: ${selectedStartSystem}`);

    // Falls das gleiche System erneut angeklickt wurde, alle Routen entfernen
    if (activeStartSystem === selectedStartSystem) {
        clearRoutesDisplay();
        activeStartSystem = null;
        if (activeMarker) activeMarker.closePopup();
        return;
    }

    clearRoutesDisplay();
    activeStartSystem = selectedStartSystem;
    activeMarker = marker;

    await loadAllRoutes(); // Sicherstellen, dass die Routen geladen sind
    const filteredRoutes = getRoutesForStartSystem(selectedStartSystem);

    console.log(`Gefundene Routen für ASN ${selectedStartSystem}:`, filteredRoutes.length);

    filteredRoutes.forEach((route, index) => {
        if (route.as_path && route.as_path.length > 1) {
            // console.log(`Route ${index + 1} ASN-Pfad: ${route.as_path.join(" → ")}`);

            const pathCoordinates = route.as_path.map(asn => {
                const point = points.find(p => p.asn === asn);
                return point ? point.coordinates : null;
            }).filter(coord => coord); // Nur gültige Koordinaten behalten

            // console.log(`Route ${index + 1} gefundene Koordinaten:`, pathCoordinates);

            if (pathCoordinates.length > 1) {
                const polyline = L.polyline(pathCoordinates, {
                    color: getRandomColor(index), // Jede Route erhält eine eigene Farbe
                    weight: 2, // Standardbreite
                }).addTo(map);

                polyline.on("click", handleRouteClick); // Klick-Event hinzufügen

                activeRoutes.push(polyline);
            }
            // else {
            //     console.warn(`Route ${index + 1} ignoriert (weniger als 2 Punkte)`);
            // }
        }
    });
}

// 🛠️ Funktion zum Entfernen der angezeigten Routen
function clearRoutesDisplay() {
    activeRoutes.forEach(route => map.removeLayer(route));
    activeRoutes = [];
}

// 🛠️ Punkte und Verbindungen laden
fetch("/points")
  .then((response) => response.json())
  .then((data) => {
    points = data; // Speichert die Punkte global
    console.log("Punkte erfolgreich geladen:", points.length);

    points.forEach((point) => {
      // Berechne die Farbe basierend auf der routes_count
      const color = getColorForRoutesCount(point.routes_count);

      // Erstelle einen farbigen Marker (z.B. als Kreis)
      const marker = L.circleMarker(point.coordinates, {
        radius: 8, // Beispielradius, du kannst ihn nach Bedarf anpassen
        color: color, // Dynamische Farbe
        fillColor: color, // Füllfarbe
        fillOpacity: 0.7 // Opazität der Füllfarbe
      }).addTo(map);

      marker.bindPopup(`<b>${point.city}</b><br>${point.region}<br>IP: ${point.ip}<br>ASN: ${point.asn}`);
      marker.on("click", () => updateRoutesDisplay(point.asn, marker));
    });
  })
  .catch(error => console.error("Fehler beim Laden der Punkte:", error));
