// app.js
// ---------------------------------------------------------------
// All the logic for the McGill fog-of-war map.
// BUILDINGS comes from data.js, which loads before this file.
// ---------------------------------------------------------------

// ===== Settings =====
const UNLOCK_RADIUS_METERS = 50;      // how close you must be to unlock
const NEAR_RADIUS_METERS = 120;       // closer than this = zone pulses "almost there"
const STORAGE_KEY = "mcgill-unlocked";
const FAVORITES_KEY = "mcgill-favorites";
const CAMPUS_CENTER = [45.5050, -73.5768];
const START_ZOOM = 17;
const MCGILL_RED = "#ED1B2F";
const PURPLE = "#8B6CF0";

// ===== State (everything that can change while the app runs) =====
// unlocked looks like: { mclennan: { unlockedAt: "2026-11-20T15:30:00.000Z", method: "location" } }
let unlocked = loadJSON(STORAGE_KEY);
let favorites = loadJSON(FAVORITES_KEY);   // { mclennan: true }
let testMode = false;
let filter = "all";          // "all" | "unlocked" | "locked"
let showZones = true;
let userLatLng = null;       // last known position [lat, lng]
let selectedId = null;       // building shown in the bottom sheet
let nearIds = new Set();     // locked buildings the user is close to

// Map layers for each building, looked up by id: { zone, badge, pin, iconState }
const layers = {};
let userMarker = null;
let userRange = null;

// Shortcut to grab an element by id
const $ = (id) => document.getElementById(id);
const app = $("app");
const sheet = $("sheet");


// =====================================================================
// 1. ICONS (small inline SVG drawings)
// =====================================================================
const ICON_PATHS = {
  gate:    '<path d="M4 21V10a8 8 0 0 1 16 0v11"/><path d="M8.5 21v-9a3.5 3.5 0 0 1 7 0v9"/>',
  columns: '<path d="M3 9.5h18L12 3.5z"/><path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8"/><path d="M3 20.5h18"/>',
  book:    '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
  chip:    '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5"/>',
  sigma:   '<path d="M18 4H6l6.5 8L6 20h12"/>',
  people:  '<circle cx="9" cy="8" r="3.2"/><path d="M3 20.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 6.3"/>',
  chart:   '<path d="M4 20V11M10 20V4M16 20v-6M2.5 20.5h19"/>',
  lock:    '<rect x="5" y="11" width="14" height="10" rx="2.2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
};

// A plain line icon, e.g. svgIcon("lock", 16)
function svgIcon(name, size) {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON_PATHS[name] + '</svg>';
}

// Red teardrop pin with a white circle and the building's icon inside
function unlockedPinSvg(building) {
  return '<svg viewBox="0 0 40 52" width="40" height="52" aria-hidden="true">' +
    '<path d="M20 50C20 50 4 32.5 4 19.5a16 16 0 0 1 32 0C36 32.5 20 50 20 50z" fill="' + MCGILL_RED + '"/>' +
    '<circle cx="20" cy="19.5" r="10.5" fill="#fff"/>' +
    '<svg x="13" y="12.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + MCGILL_RED + '" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + ICON_PATHS[building.icon] + '</svg>' +
    '</svg>';
}

// Navy circle with a white lock
function lockedPinSvg() {
  return '<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">' +
    '<circle cx="15" cy="15" r="13.5" fill="#0B1B3A" stroke="#fff" stroke-width="2"/>' +
    '<svg x="8" y="7.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + ICON_PATHS.lock + '</svg>' +
    '</svg>';
}

// Leaflet "divIcon" = a map marker made from our own HTML
function pinIcon(building, isUnlocked) {
  if (isUnlocked) {
    return L.divIcon({
      className: "pin-wrap",
      html: '<div class="pin pin-unlocked">' + unlockedPinSvg(building) + '</div>',
      iconSize: [40, 52],
      iconAnchor: [20, 50],      // the tip of the pin sits on the building
    });
  }
  return L.divIcon({
    className: "pin-wrap",
    html: '<div class="pin pin-locked">' + lockedPinSvg() + '</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],        // centre of the circle sits on the building
  });
}


// =====================================================================
// 2. SAVING AND LOADING (localStorage)
// =====================================================================
// localStorage keeps text in the browser, so it's still there after a refresh.
// JSON.stringify turns an object into text; JSON.parse turns it back.

function loadJSON(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.warn("Could not load " + key, err);   // e.g. storage blocked
    return {};
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not save " + key, err);
  }
}


// =====================================================================
// 3. MAP SETUP
// =====================================================================
const map = L.map("map", {
  zoomControl: false,          // hide the + / - buttons (pinch to zoom instead)
  attributionControl: false,   // we re-add it bottom-left below
  zoomSnap: 0.25,              // allow in-between zoom levels for a snug fit
}).setView(CAMPUS_CENTER, START_ZOOM);

// Zoom so every building fits on the phone screen.
// The padding keeps pins clear of the chips at the top and the buttons at the bottom.
map.fitBounds(
  L.latLngBounds(BUILDINGS.map(function (b) { return [b.lat, b.lng]; })),
  { paddingTopLeft: [30, 80], paddingBottomRight: [40, 40] }
);

L.control.attribution({ position: "bottomleft" }).addTo(map);

// Map background: the clean, light "Positron" style from OpenFreeMap.
// Free, no API key. (CARTO's version of this style now requires a key.)
// It's drawn by MapLibre through a small Leaflet plugin (L.maplibreGL).
// If that fails (very old phone without WebGL), fall back to normal OSM tiles.
try {
  L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/positron",
    attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
      '&copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
      'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  }).addTo(map);
} catch (err) {
  console.warn("Vector map failed, using OSM tiles instead:", err);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}


// =====================================================================
// 4. BUILDING ZONES, BADGES AND PINS
// =====================================================================

// Create one diagonal gradient per building (+ a grey one for locked zones).
// The zone circles use them as their fill: fillColor "url(#zone-grad-arts)".
function addGradient(id, color, startOpacity) {
  const ns = "http://www.w3.org/2000/svg";
  const grad = document.createElementNS(ns, "linearGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1"); grad.setAttribute("y2", "1");
  [[0, startOpacity], [1, 0.03]].forEach(function (s) {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", s[0]);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", s[1]);
    grad.appendChild(stop);
  });
  $("zone-defs").appendChild(grad);
}
addGradient("zone-grad-locked", "#7D879A", 0.28);
BUILDINGS.forEach(function (b) { addGradient("zone-grad-" + b.id, b.color, 0.55); });

// A point on the edge of a zone, in a compass direction (0 = north, 315 = north-west)
function edgePoint(building, meters, bearingDeg) {
  const rad = bearingDeg * Math.PI / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(building.lat * Math.PI / 180);
  return [
    building.lat + (meters * Math.cos(rad)) / metersPerDegLat,
    building.lng + (meters * Math.sin(rad)) / metersPerDegLng,
  ];
}

BUILDINGS.forEach(function (building, index) {
  // The zone: a circle with the same size as the unlock radius
  const zone = L.circle([building.lat, building.lng], {
    radius: UNLOCK_RADIUS_METERS,
    className: "zone",
    interactive: false,
    fillOpacity: 1,           // the gradient itself is see-through
  });

  // Small black number badge on the north-west edge of the zone
  const badge = L.marker(edgePoint(building, UNLOCK_RADIUS_METERS, 315), {
    icon: L.divIcon({
      className: "badge-wrap",
      html: '<div class="zone-badge">' + (index + 1) + '</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: -1000,      // keep badges under the pins
  });

  // The pin itself. Tapping it opens the bottom sheet.
  const pin = L.marker([building.lat, building.lng], { icon: pinIcon(building, false) });
  pin.on("click", function () { openSheet(building.id); });

  layers[building.id] = { zone: zone, badge: badge, pin: pin, iconState: false };
});

// Update how one building looks (locked/unlocked, near, selected).
// popIn = true plays the little "pop" animation (used right after unlocking).
function renderBuilding(building, popIn) {
  const l = layers[building.id];
  const isUnlocked = Boolean(unlocked[building.id]);
  const isNear = !isUnlocked && nearIds.has(building.id);

  // --- Zone colour: building colour if unlocked, purple if near, grey if locked
  l.zone.setStyle({
    color: isUnlocked ? building.color : isNear ? PURPLE : "#9AA3B2",
    weight: isUnlocked ? 2 : 1.5,
    opacity: isUnlocked ? 0.9 : 0.6,
    fillColor: "url(#zone-grad-" + (isUnlocked ? building.id : "locked") + ")",
  });
  const zoneEl = l.zone.getElement();     // null when the zone is hidden
  if (zoneEl) {
    zoneEl.classList.toggle("zone-near", isNear);
    if (isUnlocked) zoneEl.setAttribute("filter", "url(#zone-glow)");
    else zoneEl.removeAttribute("filter");
  }

  const badgeEl = l.badge.getElement();
  if (badgeEl) badgeEl.firstChild.classList.toggle("unlocked", isUnlocked);

  // --- Pin: only swap the icon when locked/unlocked actually changed
  if (l.iconState !== isUnlocked) {
    l.pin.setIcon(pinIcon(building, isUnlocked));
    l.pin.setZIndexOffset(isUnlocked ? 500 : 0);
    l.iconState = isUnlocked;
  }
  const pinEl = pinInner(building.id);
  if (pinEl) {
    pinEl.classList.toggle("selected", selectedId === building.id);
    if (popIn) pinEl.classList.add("pop");
  }
}

function renderAllBuildings() {
  BUILDINGS.forEach(function (b) { renderBuilding(b, false); });
}

// The inner .pin element of a building's marker (null if hidden)
function pinInner(id) {
  const el = layers[id].pin.getElement();
  return el ? el.querySelector(".pin") : null;
}

// Add or remove a layer from the map
function setOnMap(layer, visible) {
  if (visible && !map.hasLayer(layer)) layer.addTo(map);
  if (!visible && map.hasLayer(layer)) layer.remove();
}

// Show/hide pins and zones based on the chip filter and the "Show zones" switch
function applyVisibility() {
  BUILDINGS.forEach(function (b) {
    const l = layers[b.id];
    const isUnlocked = Boolean(unlocked[b.id]);
    const visible = filter === "all" || (filter === "unlocked") === isUnlocked;
    setOnMap(l.pin, visible);
    setOnMap(l.zone, visible && showZones);
    setOnMap(l.badge, visible && showZones);
    if (!visible && selectedId === b.id) closeSheet();
  });
  // Leaflet rebuilds elements when they're re-added, so re-apply the styles
  renderAllBuildings();
}


// =====================================================================
// 5. UNLOCK LOGIC
// =====================================================================

// unlockBuilding is the ONLY function that unlocks anything.
// Every unlock condition (location, event, QR code...) calls it.
//   buildingId - the "id" from data.js, e.g. "mclennan"
//   method     - a word describing how it was unlocked, e.g. "location"
// Returns true if the building was newly unlocked, false otherwise.
function unlockBuilding(buildingId, method) {
  const building = findBuilding(buildingId);
  if (!building) return false;               // unknown id
  if (unlocked[buildingId]) return false;    // already unlocked

  unlocked[buildingId] = {
    unlockedAt: new Date().toISOString(),
    method: method,
  };
  saveJSON(STORAGE_KEY, unlocked);
  nearIds.delete(buildingId);

  applyVisibility();                 // e.g. hide it if the "Locked" chip is on
  renderBuilding(building, true);    // play the pop animation
  updateProgress();
  if (selectedId === buildingId) renderSheet();
  celebrate(building);
  return true;
}

// Unlock condition #1: being near a building.
function checkProximityUnlocks(lat, lng) {
  BUILDINGS.forEach(function (building) {
    // map.distance gives the real distance in meters between two points
    const meters = map.distance([lat, lng], [building.lat, building.lng]);
    if (meters <= UNLOCK_RADIUS_METERS) {
      unlockBuilding(building.id, "location");
    }
  });
}

// ---------------------------------------------------------------
// FUTURE UNLOCK CONDITIONS go here. Each just calls unlockBuilding.
//
//   // After the user checks in at an event held in a building:
//   function onEventAttended(event) {
//     unlockBuilding(event.buildingId, "event");
//   }
//
//   // After a QR code is scanned. The code could contain e.g. "trottier":
//   function onQrScanned(text) {
//     unlockBuilding(text, "qr");
//   }
// ---------------------------------------------------------------

// Find which locked buildings are "almost there" so their zones pulse
function updateNearZones(lat, lng) {
  const newNear = new Set();
  BUILDINGS.forEach(function (b) {
    if (unlocked[b.id]) return;
    if (map.distance([lat, lng], [b.lat, b.lng]) <= NEAR_RADIUS_METERS) newNear.add(b.id);
  });
  nearIds = newNear;
  renderAllBuildings();
}

function findBuilding(id) {
  return BUILDINGS.find(function (b) { return b.id === id; });
}


// =====================================================================
// 6. THE USER'S POSITION
// =====================================================================

// Called both by real GPS and by test-mode taps.
function handlePosition(lat, lng) {
  userLatLng = [lat, lng];

  if (!userMarker) {
    // Soft purple circle showing your 50 m unlock range
    userRange = L.circle(userLatLng, {
      radius: UNLOCK_RADIUS_METERS,
      color: PURPLE,
      weight: 1,
      opacity: 0.5,
      fillColor: PURPLE,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);
    // Purple ring dot with a pulse (see .user-dot in style.css)
    userMarker = L.marker(userLatLng, {
      icon: L.divIcon({
        className: "user-wrap",
        html: '<div class="user-dot"><span class="user-pulse"></span></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    userMarker.setLatLng(userLatLng);
    userRange.setLatLng(userLatLng);
  }

  checkProximityUnlocks(lat, lng);
  updateNearZones(lat, lng);
  if (selectedId) renderSheet();     // keep "distance from you" up to date
}

// Real GPS. watchPosition calls us every time the device's location changes.
let lastGeoError = null;
function startGeolocation() {
  if (!("geolocation" in navigator)) {
    showToast("No GPS in this browser. Use test mode.");
    return;
  }
  navigator.geolocation.watchPosition(
    function (position) {
      lastGeoError = null;
      // While test mode is on, ignore real GPS so it doesn't move your test dot
      if (testMode) return;
      handlePosition(position.coords.latitude, position.coords.longitude);
    },
    function (err) {
      // Only show each kind of error once, not on every retry
      if (testMode || lastGeoError === err.code) return;
      lastGeoError = err.code;
      if (err.code === err.PERMISSION_DENIED) {
        showToast("Location blocked. Use test mode to try it.");
      } else {
        showToast("Can't find your location yet.");
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
}


// =====================================================================
// 7. BOTTOM SHEET (building card)
// =====================================================================

function openSheet(id) {
  closeMenus();
  const previous = selectedId;
  selectedId = id;
  if (previous && previous !== id) {
    const prevEl = pinInner(previous);
    if (prevEl) prevEl.classList.remove("selected");
  }
  const el = pinInner(id);
  if (el) el.classList.add("selected");

  renderSheet();
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
  updateSheetHeight();
  keepPinVisible(findBuilding(id));
}

function closeSheet() {
  if (!selectedId) return;
  const el = pinInner(selectedId);
  if (el) el.classList.remove("selected");
  selectedId = null;
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
  app.style.setProperty("--sheet-h", "0px");
}

// Fill the sheet with the selected building's details
function renderSheet() {
  const b = findBuilding(selectedId);
  if (!b) return;
  const info = unlocked[b.id];

  sheet.classList.toggle("locked", !info);
  $("stat-dist").textContent = userLatLng
    ? formatDistance(map.distance(userLatLng, [b.lat, b.lng]))
    : "—";

  let tags;
  if (info) {
    $("sheet-title").textContent = b.name;
    $("sheet-sub").textContent = b.description;
    const date = new Date(info.unlockedAt);
    $("stat-date").textContent = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    $("stat-date-label").textContent = "unlocked " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    tags = b.tags.map(function (t) { return { text: t, cls: "" }; });
    tags.push({ text: "Unlocked", cls: "status-unlocked" });
  } else {
    $("sheet-title").textContent = "??? Locked Building";
    $("sheet-sub").textContent = "Get within " + UNLOCK_RADIUS_METERS + " m to unlock";
    $("stat-date").textContent = UNLOCK_RADIUS_METERS + " m";
    $("stat-date-label").textContent = "unlock range";
    tags = [{ text: "Locked", cls: "status-locked" }];
  }

  // Build the tag chips
  const tagBox = $("sheet-tags");
  tagBox.innerHTML = "";
  tags.forEach(function (t) {
    const span = document.createElement("span");
    span.className = "tag " + t.cls;
    span.textContent = t.text;
    tagBox.appendChild(span);
  });

  $("fav-btn").setAttribute("aria-pressed", String(Boolean(favorites[b.id])));
}

// Tell the CSS how tall the sheet is, so the round buttons move above it
function updateSheetHeight() {
  app.style.setProperty("--sheet-h", sheet.offsetHeight + "px");
}

// If the tapped pin would end up behind the sheet, slide the map up a bit
function keepPinVisible(b) {
  const point = map.latLngToContainerPoint([b.lat, b.lng]);
  const limit = map.getSize().y - sheet.offsetHeight - 70;
  if (point.y > limit) map.panBy([0, point.y - limit]);
}

function formatDistance(meters) {
  return meters < 1000 ? Math.round(meters) + " m" : (meters / 1000).toFixed(1) + " km";
}

// --- Sheet buttons ---
$("share-btn").addEventListener("click", function () {
  const b = findBuilding(selectedId);
  const text = unlocked[b.id]
    ? "I unlocked " + b.name + " on the McGill Map!"
    : "I'm exploring the McGill campus map!";
  if (navigator.share) {
    navigator.share({ title: "McGill Map", text: text }).catch(function () {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(
      function () { showToast("Copied to clipboard"); },
      function () { showToast(text); }
    );
  } else {
    showToast(text);
  }
});

$("dir-btn").addEventListener("click", function () {
  const b = findBuilding(selectedId);
  // Opens walking directions in Google Maps (app on phones, website on computers)
  const url = "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + b.lat + "," + b.lng;
  window.open(url, "_blank", "noopener");
});

$("fav-btn").addEventListener("click", function () {
  const id = selectedId;
  if (!unlocked[id]) {
    showToast("Unlock it first to add it to favorites");
    return;
  }
  if (favorites[id]) delete favorites[id];
  else favorites[id] = true;
  saveJSON(FAVORITES_KEY, favorites);
  $("fav-btn").setAttribute("aria-pressed", String(Boolean(favorites[id])));
  showToast(favorites[id] ? "Added to favorites" : "Removed from favorites");
});

// --- Swipe down to close ---
// We follow the finger (or mouse) and close if it moved down far enough.
let dragStartY = null;
let dragDistance = 0;

sheet.addEventListener("pointerdown", function (e) {
  if (e.target.closest("button")) return;     // let buttons work normally
  dragStartY = e.clientY;
  dragDistance = 0;
  sheet.setPointerCapture(e.pointerId);
  sheet.classList.add("dragging");
});

sheet.addEventListener("pointermove", function (e) {
  if (dragStartY === null) return;
  dragDistance = Math.max(0, e.clientY - dragStartY);   // only downwards
  sheet.style.transform = "translateY(" + dragDistance + "px)";
});

function endDrag() {
  if (dragStartY === null) return;
  sheet.classList.remove("dragging");
  sheet.style.transform = "";                 // go back to the CSS position
  if (dragDistance > 70) closeSheet();
  dragStartY = null;
}
sheet.addEventListener("pointerup", endDrag);
sheet.addEventListener("pointercancel", endDrag);


// =====================================================================
// 8. TAPPING THE MAP + TEST MODE
// =====================================================================
map.on("click", function (e) {
  closeMenus();
  if (testMode) {
    // Test mode: pretend you're standing where you tapped
    handlePosition(e.latlng.lat, e.latlng.lng);
  } else {
    closeSheet();
  }
});

$("test-btn").addEventListener("click", function () {
  testMode = !testMode;
  this.classList.toggle("active", testMode);
  this.setAttribute("aria-pressed", String(testMode));
  app.classList.toggle("testing", testMode);
  showToast(testMode ? "Test mode on" : "Test mode off · using real GPS");
});

$("recenter-btn").addEventListener("click", function () {
  if (userLatLng) {
    map.flyTo(userLatLng, Math.max(map.getZoom(), 17), { duration: 0.8 });
  } else {
    showToast(testMode ? "Tap the map to place yourself" : "No location yet. Try test mode.");
  }
});


// =====================================================================
// 9. FILTER CHIPS
// =====================================================================
document.querySelectorAll(".chip").forEach(function (chip) {
  chip.addEventListener("click", function () { setFilter(chip.dataset.filter); });
});

function setFilter(value) {
  filter = value;
  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.classList.toggle("active", chip.dataset.filter === value);
  });
  applyVisibility();
}


// =====================================================================
// 10. SEARCH
// =====================================================================
const searchInput = $("search-input");
const resultsBox = $("search-results");
let currentResults = [];

searchInput.addEventListener("focus", function () { closeMenu(); renderResults(); });
searchInput.addEventListener("input", renderResults);
searchInput.addEventListener("blur", function () { resultsBox.hidden = true; });

searchInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && currentResults.length) goToBuilding(currentResults[0].id);
  if (e.key === "Escape") searchInput.blur();
});

// Show buildings whose name contains what was typed
function renderResults() {
  const query = searchInput.value.trim().toLowerCase();
  currentResults = BUILDINGS.filter(function (b) {
    return b.name.toLowerCase().includes(query);
  });

  resultsBox.innerHTML = "";
  if (!currentResults.length) {
    resultsBox.innerHTML = '<div class="result-empty">No buildings match "' + escapeHtml(query) + '"</div>';
  }
  currentResults.forEach(function (b, i) {
    const info = unlocked[b.id];
    const row = document.createElement("button");
    row.className = "result" + (i === 0 && query ? " active" : "");
    row.innerHTML =
      '<span class="result-dot ' + (info ? "unlocked" : "") + '">' + svgIcon(info ? b.icon : "lock", 15) + '</span>' +
      '<span><span class="result-name">' + escapeHtml(b.name) + '</span>' +
      '<span class="result-meta">' + (info ? "Unlocked" : "Locked · go there to unlock") + '</span></span>';
    // mousedown + preventDefault keeps the input focused so the click lands
    row.addEventListener("mousedown", function (e) { e.preventDefault(); });
    row.addEventListener("click", function () { goToBuilding(b.id); });
    resultsBox.appendChild(row);
  });
  resultsBox.hidden = false;
}

// Fly the map to a building and open its card
function goToBuilding(id) {
  const b = findBuilding(id);
  searchInput.value = "";
  searchInput.blur();

  // If the current chip would hide it, switch back to "All"
  const isUnlocked = Boolean(unlocked[id]);
  if (filter !== "all" && (filter === "unlocked") !== isUnlocked) setFilter("all");

  openSheet(id);
  // Aim a bit below the building so it lands in the visible area above the sheet
  const zoom = 18;
  const target = map.project([b.lat, b.lng], zoom).add([0, sheet.offsetHeight / 2]);
  map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.9 });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


// =====================================================================
// 11. OPTIONS MENU (filter icon): show zones + reset
// =====================================================================
const menu = $("menu");
const menuBtn = $("menu-btn");

menuBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  menu.hidden ? openMenu() : closeMenu();
});
function openMenu() {
  menu.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  menu.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}
function closeMenus() {
  closeMenu();
  resultsBox.hidden = true;
}
// Close the menu when tapping anywhere else
document.addEventListener("click", function (e) {
  if (!menu.hidden && !menu.contains(e.target)) closeMenu();
});

$("zones-toggle").addEventListener("change", function () {
  showZones = this.checked;
  applyVisibility();
});

$("reset-btn").addEventListener("click", function () {
  closeMenu();
  if (!confirm("Lock all buildings again?")) return;
  unlocked = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear progress:", err);
  }
  celebrationQueue = [];
  if (userLatLng) updateNearZones(userLatLng[0], userLatLng[1]);
  applyVisibility();
  updateProgress();
  if (selectedId) renderSheet();
  showToast("Progress reset");
});


// =====================================================================
// 12. TAB BAR
// =====================================================================
document.querySelectorAll(".tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    if (tab.dataset.tab !== "map") showToast(tab.textContent.trim() + ": coming soon");
  });
});


// =====================================================================
// 13. PROGRESS PILL, TOAST, CELEBRATION
// =====================================================================
function updateProgress() {
  const count = Object.keys(unlocked).length;
  $("count").textContent = count;
  $("total").textContent = BUILDINGS.length;
  $("progress-fill").style.width = (count / BUILDINGS.length) * 100 + "%";
}

let toastTimer = null;
function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
}

// Unlocks can happen several at once, so we show the cards one after another
let celebrationQueue = [];
let celebrating = false;
let celebrateTimer = null;

function celebrate(building) {
  celebrationQueue.push(building);
  if (!celebrating) showNextCelebration();
}

function showNextCelebration() {
  const building = celebrationQueue.shift();
  if (!building) { celebrating = false; return; }
  celebrating = true;

  $("celebrate-icon").innerHTML = unlockedPinSvg(building);
  $("celebrate-name").textContent = building.name;
  $("celebrate-progress").textContent =
    Object.keys(unlocked).length + " / " + BUILDINGS.length + " buildings explored";
  launchConfetti();
  $("celebrate").classList.add("show");

  celebrateTimer = setTimeout(hideCelebration, 2600);
}

function hideCelebration() {
  clearTimeout(celebrateTimer);
  $("celebrate").classList.remove("show");
  setTimeout(showNextCelebration, 350);   // wait for the fade-out
}
// Tap the card to dismiss it early
$("celebrate").addEventListener("click", function () {
  if (celebrating) hideCelebration();
});

// Make ~40 coloured paper pieces that fly out in random directions
function launchConfetti() {
  const box = $("confetti");
  box.innerHTML = "";
  const colors = ["#ED1B2F", "#8B6CF0", "#2DD4BF", "#F59E0B", "#3B82F6", "#ffffff"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * 130;
    piece.style.setProperty("--x", Math.cos(angle) * distance + "px");
    piece.style.setProperty("--y", Math.sin(angle) * distance + 80 + "px");  // +80 = falls a little
    piece.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.15 + "s";
    if (i % 3 === 0) piece.style.borderRadius = "50%";
    box.appendChild(piece);
  }
}


// =====================================================================
// START
// =====================================================================
applyVisibility();
updateProgress();
startGeolocation();
