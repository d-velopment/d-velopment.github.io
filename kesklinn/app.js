/**
 * Runs the Kesklinn parking map in the browser. It loads the local Tallinn GIS
 * snapshot, renders parking lines and resident boundaries with Leaflet, and
 * scales the current basemap tiles around the gesture point while browsing.
 * It opens Street View near selected points and keeps the latest device fix
 * centered with its accuracy circle while location tracking is enabled.
 */

const overviewCenter = [59.432, 24.757];
const overviewZoom = 14;
const followZoom = 17;
const tileZoomIdleMs = 180;
const locationButton = document.getElementById("location-button");
const locationLabel = document.getElementById("location-label");
const locationStatus = document.getElementById("location-status");
const dataStatus = document.getElementById("data-status");
const positionDot = document.getElementById("position-dot");
const mapError = document.getElementById("map-error");

const parkingStyle = {
  color: "#087946",
  weight: 5,
  opacity: 0.97,
  lineCap: "round",
  lineJoin: "round",
};

const zoneStyle = {
  color: "#6a7089",
  weight: 1.5,
  opacity: 0.9,
  dashArray: "6 5",
  fill: false,
};

let map;
let watchId = null;
let accuracyCircle = null;

// ----------------------------------------------------------------- Map and parking data

// Start the map with centered zoom and a readable overview before the data loads.
function initializeMap() {
  if (!window.L) {
    dataStatus.textContent = "Map unavailable";
    mapError.textContent = "The map could not start. Check your connection and reload.";
    mapError.hidden = false;
    return;
  }

  map = L.map("map", {
    zoomControl: false,
    zoomAnimation: false,
    zoomSnap: 0,
    zoomDelta: 0.25,
    scrollWheelZoom: true,
    wheelDebounceTime: 16,
    wheelPxPerZoomLevel: 30,
    doubleClickZoom: false,
    touchZoom: true,
  }).setView(overviewCenter, overviewZoom);

  addBasemap();
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.createPane("location-accuracy").style.zIndex = "350";
  map.on("dblclick", openPointInStreetView);

  if (window.isSecureContext && navigator.geolocation) {
    locationButton.disabled = false;
    locationButton.addEventListener("click", toggleTracking);
    window.addEventListener("pagehide", stopTracking);
  } else {
    locationStatus.textContent = "Location requires a secure browser session.";
  }

  loadParkingData();
}

// ----------------------------------------------------------------- Basemap tiles during zoom

// Attach a tile layer that keeps its rendered tiles until the zoom gesture settles.
function addBasemap() {
  class SettledZoomTileLayer extends L.TileLayer {
    zoomInProgress = false;
    refreshTimer;

    // Keep Leaflet's pan handlers and bypass the reset that clears the tile grid.
    getEvents() {
      const events = super.getEvents();
      delete events.viewprereset;
      events.zoom = this.scaleExistingTiles;
      events.zoomend = this.scheduleTileRefresh;
      return events;
    }

    // Rescale the current tiles without asking the server for another zoom level.
    scaleExistingTiles() {
      this.zoomInProgress = true;
      clearTimeout(this.refreshTimer);
      this._setZoomTransforms(this._map.getCenter(), this._map.getZoom());
    }

    // Group consecutive zoom steps into a single tile refresh after the user stops.
    scheduleTileRefresh() {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(this.refreshTiles.bind(this), tileZoomIdleMs);
    }

    // Resume normal tile loading at the map's latest center and zoom level.
    refreshTiles() {
      this.zoomInProgress = false;
      super._resetView();
    }

    // Suppress the view reset that Leaflet emits after each fractional zoom step.
    _resetView() {
      if (!this.zoomInProgress) {
        super._resetView();
      }
    }

    // Let dragging request newly visible tiles once zooming has finished.
    _onMoveEnd() {
      if (!this.zoomInProgress) {
        super._onMoveEnd();
      }
    }

    // Keep old images underneath until the replacement tiles have loaded.
    _pruneTiles() {
      if (!this.zoomInProgress && !this.isLoading()) {
        super._pruneTiles();
      }
    }

    // Cancel the scheduled refresh before Leaflet detaches the layer.
    onRemove(leafletMap) {
      clearTimeout(this.refreshTimer);
      this.zoomInProgress = false;
      super.onRemove(leafletMap);
    }
  }

  new SettledZoomTileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

// ----------------------------------------------------------------- Street View and parking overlays

// Open the Street View panorama nearest the clicked coordinates in a separate tab.
function openPointInStreetView(event) {
  const { lat, lng } = event.latlng;
  const url = new URL("https://www.google.com/maps/@");
  url.searchParams.set("api", "1");
  url.searchParams.set("map_action", "pano");
  url.searchParams.set("viewpoint", `${lat},${lng}`);
  window.open(url.href, "_blank", "noopener,noreferrer");
}

// Render one snapshot and retain the base map if the parking data cannot load.
async function loadParkingData() {
  try {
    const response = await fetch("./data/kesklinn.geojson");

    if (!response.ok) {
      throw new Error("Parking data request failed.");
    }

    const snapshot = await response.json();
    const parking = [];
    const zones = [];

    for (const feature of snapshot.features) {
      const layer = feature.properties.layer;

      if (layer === "parking") {
        parking.push(feature);
      } else if (layer === "resident_zone") {
        zones.push(feature);
      }

    }

    if (parking.length === 0 || zones.length === 0) {
      throw new Error("Parking data is incomplete.");
    }

    L.geoJSON(zones, {
      style: zoneStyle,
      interactive: false,
      onEachFeature: addZoneLabel,
    }).addTo(map);

    const parkingLayer = L.geoJSON(parking, {
      style: parkingStyle,
      interactive: false,
    }).addTo(map);

    // Widen only the parking lines as the map moves from overview to street zoom.
    function updateParkingWeight() {
      const zoomOffset = map.getZoom() - overviewZoom;
      const weight = Math.max(3, Math.min(12, parkingStyle.weight + zoomOffset * 1.5));
      parkingLayer.setStyle({ weight });
    }

    if (watchId === null) {
      map.fitBounds(parkingLayer.getBounds(), { padding: [28, 28], maxZoom: 16 });
    }

    updateParkingWeight();
    map.on("zoomend", updateParkingWeight);

    map.attributionControl.addAttribution(
      '<a href="https://gis.tallinn.ee/arcgis/rest/services/parkimine/MapServer">Tallinn GIS</a>'
    );

    dataStatus.textContent = `${parking.length} parking segments`;
  } catch (error) {
    console.error("Unable to load Kesklinn parking data.", error);
    dataStatus.textContent = "Parking data unavailable. Reload to try again.";
  }
}

// Keep resident names visible as map labels without making the polygons clickable.
function addZoneLabel(feature, layer) {
  const label = document.createElement("span");
  label.textContent = feature.properties.nimetus;

  layer.bindTooltip(label, {
    permanent: true,
    direction: "center",
    className: "zone-label",
    opacity: 1,
    interactive: false,
  });
}

// ----------------------------------------------------------------- Device location

// Toggle the browser watch from a user gesture and let the user resume map browsing.
function toggleTracking() {
  if (watchId !== null) {
    stopTracking();
    return;
  }

  locationLabel.textContent = "Stop following";
  locationButton.setAttribute("aria-pressed", "true");
  locationStatus.textContent = "Waiting for your location…";

  watchId = navigator.geolocation.watchPosition(updatePosition, showLocationError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
}

// Center each fix, keep zoom centered, and show the reported radius in meters.
function updatePosition(position) {
  if (watchId === null) {
    return;
  }

  const { latitude, longitude, accuracy } = position.coords;
  const coordinates = [latitude, longitude];
  const firstFix = accuracyCircle === null;
  if (firstFix) {
    map.dragging.disable();
    map.keyboard.disable();
    map.boxZoom.disable();
    map.options.scrollWheelZoom = "center";
    map.options.touchZoom = "center";

    accuracyCircle = L.circle(coordinates, {
      pane: "location-accuracy",
      radius: accuracy,
      color: "#243b56",
      weight: 1,
      fillOpacity: 0.15,
      interactive: false,
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng(coordinates).setRadius(accuracy);
  }

  map.setView(coordinates, firstFix ? followZoom : map.getZoom(), { animate: false });
  positionDot.hidden = false;
  locationStatus.textContent = `Following · accuracy ±${Math.round(accuracy)} m`;
}

// End tracking on permission denial and show recoverable errors while waiting for a fix.
function showLocationError(error) {
  if (watchId === null) {
    return;
  }

  if (error.code === 1) {
    stopTracking();
    locationStatus.textContent = "Location blocked. Allow access in your browser settings.";
  } else if (accuracyCircle) {
    locationStatus.textContent = "Location signal lost. Showing the last fix.";
  } else {
    locationStatus.textContent = "Location unavailable. Waiting for a signal…";
  }
}

// Clear the watch and its overlays, then re-enable map navigation.
function stopTracking() {
  if (watchId === null) {
    return;
  }

  navigator.geolocation.clearWatch(watchId);
  watchId = null;

  if (accuracyCircle) {
    accuracyCircle.remove();
    accuracyCircle = null;
    map.dragging.enable();
    map.keyboard.enable();
    map.boxZoom.enable();
    map.options.scrollWheelZoom = true;
    map.options.touchZoom = true;
  }

  positionDot.hidden = true;
  locationLabel.textContent = "Follow my location";
  locationButton.setAttribute("aria-pressed", "false");
  locationStatus.textContent = "Explore the map";
}

initializeMap();
