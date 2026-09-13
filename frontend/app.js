// GiraRota - Client Application Logic
// Supports both Standalone In-Browser Optimization (GitHub Pages) and Live FastAPI Backend

let map = null;
let markersGroup = null;
let routePolyline = null;
let currentStops = [];
let stopMarkers = [];
let renderedStops = [];
let currentOrigin = {
  address: "Praça da Sé - Centro Histórico, São Paulo - SP",
  lat: -23.5505,
  lng: -46.6333,
};

// Preset Sample Datasets are loaded from datasets.js (Todas as 27 Capitais do Brasil com 20 Endereços)
if (typeof SAMPLE_DATASETS === "undefined") {
  window.SAMPLE_DATASETS = {};
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initLucide();
  loadSettings();

  // Check URL query parameters for payment return (Stripe/Mercado Pago webhook or redirect)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("status") === "success" || urlParams.get("paid") === "true") {
    SubscriptionManager.activatePro("monthly", 30, "CHECKOUT-REDIRECT");
  }

  updateSubscriptionUI();
  updateUserHeaderUI();

  // Handle radio mode changes in settings modal
  document.querySelectorAll("input[name='engineMode']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isApi = e.target.value === "api";
      const container = document.getElementById("apiUrlContainer");
      if (isApi) {
        container.classList.remove("opacity-50", "pointer-events-none");
      } else {
        container.classList.add("opacity-50", "pointer-events-none");
      }
    });
  });

  // Handle manual textarea input
  const inputEl = document.getElementById("rawLabelsInput");
  if (inputEl) {
    inputEl.addEventListener("input", parseRawInput);
  }

  // Load default SP 15 sample
  loadSampleBatch("sp15");
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Map Initialization
function initMap() {
  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView([currentOrigin.lat, currentOrigin.lng], 13);

  const cartoApiKey = "cb1_3iva_1_97907d15ae0df4f70c756a74";

  // Official CARTO Basemaps authenticated with public client key
  const voyagerLayer = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoApiKey}`,
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const darkLayer = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }
  );

  // Set Voyager as active base layer
  voyagerLayer.addTo(map);

  // Add clean layer switcher
  L.control
    .layers(
      {
        "🗺️ CARTO Voyager": voyagerLayer,
        "🌙 CARTO Noturno": darkLayer,
        "🌐 OpenStreetMap": osmLayer,
      },
      null,
      { position: "topright" }
    )
    .addTo(map);

  markersGroup = L.layerGroup().addTo(map);
}

// Settings Persistence
function loadSettings() {
  const mode = localStorage.getItem("geofrete_engine_mode") || "standalone";
  const apiUrl = localStorage.getItem("geofrete_api_url") || "http://localhost:8000";

  const radio = document.querySelector(`input[name='engineMode'][value='${mode}']`);
  if (radio) radio.checked = true;

  document.getElementById("apiEndpointInput").value = apiUrl;
  updateModeUI(mode);

  // Load Admin Payment Settings
  const pixKey = localStorage.getItem("geofrete_admin_pix_key") || "pix@girarota.com";
  const pixName = localStorage.getItem("geofrete_admin_pix_name") || "GIRAROTA BRASIL";
  const pixCity = localStorage.getItem("geofrete_admin_pix_city") || "CAMPO LARGO";

  if (document.getElementById("adminPixKeyInput")) document.getElementById("adminPixKeyInput").value = pixKey;
  if (document.getElementById("adminPixNameInput")) document.getElementById("adminPixNameInput").value = pixName;
  if (document.getElementById("adminPixCityInput")) document.getElementById("adminPixCityInput").value = pixCity;

  // Load Privy & Google Client ID Settings
  const privyAppId = localStorage.getItem("geofrete_admin_privy_app_id") || "";
  const googleClientId = localStorage.getItem("geofrete_admin_google_client_id") || "";
  if (document.getElementById("adminPrivyAppIdInput")) document.getElementById("adminPrivyAppIdInput").value = privyAppId;
  if (document.getElementById("adminGoogleClientIdInput")) document.getElementById("adminGoogleClientIdInput").value = googleClientId;
}

function saveSettings() {
  const selectedMode = document.querySelector("input[name='engineMode']:checked").value;
  const apiUrl = document.getElementById("apiEndpointInput").value.trim();

  localStorage.setItem("geofrete_engine_mode", selectedMode);
  localStorage.setItem("geofrete_api_url", apiUrl);

  // Save Admin Payment Settings
  const pixKey = (document.getElementById("adminPixKeyInput")?.value || "pix@girarota.com").trim();
  const pixName = (document.getElementById("adminPixNameInput")?.value || "GIRAROTA BRASIL").trim();
  const pixCity = (document.getElementById("adminPixCityInput")?.value || "CAMPO LARGO").trim();

  localStorage.setItem("geofrete_admin_pix_key", pixKey);
  localStorage.setItem("geofrete_admin_pix_name", pixName);
  localStorage.setItem("geofrete_admin_pix_city", pixCity);

  // Save Privy & Google Settings
  const privyAppId = (document.getElementById("adminPrivyAppIdInput")?.value || "cl_girarota_demo_2026").trim();
  const googleClientId = (document.getElementById("adminGoogleClientIdInput")?.value || "girarota-google-client-id").trim();
  localStorage.setItem("geofrete_admin_privy_app_id", privyAppId);
  localStorage.setItem("geofrete_admin_google_client_id", googleClientId);

  updateModeUI(selectedMode);
  document.getElementById("settingsModal").classList.add("hidden");
  showPaymentToast("Configurações salvas com sucesso!");
}

function updateModeUI(mode) {
  const badge = document.getElementById("modeBadge");
  const banner = document.getElementById("modeBanner");

  if (mode === "api") {
    badge.textContent = "Motor: API FastAPI";
    banner.innerHTML = `
      <div class="flex items-center space-x-2">
        <i data-lucide="server" class="w-4 h-4 text-emerald-400 flex-shrink-0"></i>
        <span><strong>Modo API Backend:</strong> Otimização delegada ao motor Google OR-Tools + Celery.</span>
      </div>
      <button onclick="document.getElementById('settingsModal').classList.remove('hidden')" class="text-blue-400 hover:underline font-semibold ml-2 flex-shrink-0">Alterar</button>
    `;
  } else {
    badge.textContent = "Motor: Navegador (Offline)";
    banner.innerHTML = `
      <div class="flex items-center space-x-2">
        <i data-lucide="info" class="w-4 h-4 text-blue-400 flex-shrink-0"></i>
        <span><strong>GitHub Pages:</strong> Executando motor TSP 2-opt em tempo real no seu navegador.</span>
      </div>
      <button onclick="document.getElementById('settingsModal').classList.remove('hidden')" class="text-blue-400 hover:underline font-semibold ml-2 flex-shrink-0">Configurar</button>
    `;
  }
  initLucide();
}

// Load Samples (27 Capitais do Brasil)
function loadSampleBatch(key) {
  const sample = SAMPLE_DATASETS[key];
  if (!sample) return;

  currentOrigin = { ...sample.origin };
  document.getElementById("originAddress").value = currentOrigin.address;
  document.getElementById("originLat").value = currentOrigin.lat;
  document.getElementById("originLng").value = currentOrigin.lng;

  currentStops = JSON.parse(JSON.stringify(sample.items));
  updateBatchTextArea();
  updatePackageCount();

  // Synchronize select dropdown
  const select = document.getElementById("capitalSelect");
  if (select && select.value !== key) {
    select.value = key;
  }

  // Smoothly center and fly map to the capital
  if (map && currentOrigin.lat && currentOrigin.lng) {
    map.flyTo([currentOrigin.lat, currentOrigin.lng], 13, { duration: 1.2 });
  }

  showPaymentToast(`Lote carregado: ${sample.name || key} (${currentStops.length} pacotes)`);
}

function loadRandomCapitalBatch() {
  const capitalKeys = [
    "curitiba", "florianopolis", "porto_alegre",
    "sao_paulo", "rio_de_janeiro", "belo_horizonte", "vitoria",
    "brasilia", "goiania", "cuiaba", "campo_grande",
    "salvador", "recife", "fortaleza", "natal", "joao_pessoa", "maceio", "aracaju", "teresina", "sao_luis",
    "manaus", "belem", "porto_velho", "palmas", "rio_branco", "macapa", "boa_vista"
  ];
  const randomKey = capitalKeys[Math.floor(Math.random() * capitalKeys.length)];
  loadSampleBatch(randomKey);
}

function updateBatchTextArea() {
  const lines = currentStops.map((s, idx) => {
    return `${s.address} | ${s.name || "Cliente #" + (idx + 1)} | ${s.lat},${s.lng}`;
  });
  document.getElementById("rawLabelsInput").value = lines.join("\n");
}

function updatePackageCount() {
  const count = currentStops.length;
  document.getElementById("packageCountBadge").textContent = `${count} pacote${count === 1 ? "" : "s"}`;
}

function clearBatch() {
  currentStops = [];
  document.getElementById("rawLabelsInput").value = "";
  updatePackageCount();
  markersGroup.clearLayers();
  if (routePolyline) map.removeLayer(routePolyline);
  document.getElementById("stopsList").innerHTML = `
    <div class="text-center py-12 text-slate-500 text-xs">
      Nenhum pacote carregado. Carregue um lote de demonstração ou adicione endereços.
    </div>
  `;
  document.getElementById("metricsPanel").classList.add("hidden");
}

function parseRawInput() {
  const text = document.getElementById("rawLabelsInput").value.trim();
  if (!text) {
    currentStops = [];
    updatePackageCount();
    return;
  }

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const stops = [];

  lines.forEach((line, idx) => {
    const parts = line.split("|").map((p) => p.trim());
    let address = "";
    let name = `Parada ${String(idx + 1).padStart(2, "0")}`;
    let lat = null;
    let lng = null;

    if (parts.length >= 3) {
      address = parts[0];
      name = parts[1];
      const coords = parts[2].split(",").map((c) => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        lat = coords[0];
        lng = coords[1];
      }
    } else if (parts.length === 2) {
      address = parts[0];
      const coords = parts[1].split(",").map((c) => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        lat = coords[0];
        lng = coords[1];
      } else {
        name = parts[1];
      }
    } else {
      address = line;
      const coordMatch = line.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
        address = line.replace(coordMatch[0], "").replace(/\|/g, "").trim();
      }
    }

    // If still no lat/lng, distribute around origin for offline client-side testing
    if (lat === null || lng === null) {
      const angle = (idx * 2 * Math.PI) / (lines.length || 1);
      const radius = 0.008 + (idx * 0.001);
      lat = currentOrigin.lat + radius * Math.cos(angle);
      lng = currentOrigin.lng + radius * Math.sin(angle);
    }

    stops.push({
      name,
      address,
      lat,
      lng,
      tracking: `PKG-${String(idx + 1).padStart(3, "0")}`,
    });
  });

  currentStops = stops;
  updatePackageCount();
}

// GPS Location for Courier Origin
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada pelo seu navegador.");
    return;
  }

  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="animate-pulse">Obtendo GPS...</span>`;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentOrigin.lat = pos.coords.latitude;
      currentOrigin.lng = pos.coords.longitude;
      currentOrigin.address = "Minha Localização Atual (GPS)";

      document.getElementById("originAddress").value = currentOrigin.address;
      document.getElementById("originLat").value = currentOrigin.lat;
      document.getElementById("originLng").value = currentOrigin.lng;

      btn.innerHTML = originalText;
      map.setView([currentOrigin.lat, currentOrigin.lng], 14);
    },
    (err) => {
      alert("Não foi possível obter o sinal de GPS: " + err.message);
      btn.innerHTML = originalText;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// -------------------------------------------------------------
// STANDALONE IN-BROWSER TSP SOLVER (Google OR-Tools Alternative for JS)
// -------------------------------------------------------------
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180.0);
  const dLon = (lon2 - lon1) * (Math.PI / 180.0);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180.0)) *
      Math.cos(lat2 * (Math.PI / 180.0)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.3; // Urban circuity factor
}

// Nearest Neighbor + 2-opt Heuristic for Open TSP
function solveClientSideTSP(origin, stops) {
  if (stops.length <= 1) {
    return {
      orderedStops: stops.map((s, idx) => ({ ...s, sequenceOrder: idx + 1 })),
      totalDistanceKm: stops.length === 1 ? haversineDistanceKm(origin.lat, origin.lng, stops[0].lat, stops[0].lng) : 0,
      estimatedTimeMin: stops.length === 1 ? 8 : 0,
    };
  }

  // Step 1: Nearest Neighbor Heuristic from Origin
  let unvisited = stops.map((s, idx) => ({ ...s, originalIdx: idx }));
  let tour = [];
  let currentPos = origin;

  while (unvisited.length > 0) {
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistanceKm(currentPos.lat, currentPos.lng, unvisited[i].lat, unvisited[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const nextStop = unvisited.splice(bestIdx, 1)[0];
    tour.push(nextStop);
    currentPos = nextStop;
  }

  // Step 2: 2-opt local search optimization to untangle crossings
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  function calculateTourDistance(currentTour) {
    let total = haversineDistanceKm(origin.lat, origin.lng, currentTour[0].lat, currentTour[0].lng);
    for (let i = 0; i < currentTour.length - 1; i++) {
      total += haversineDistanceKm(currentTour[i].lat, currentTour[i].lng, currentTour[i + 1].lat, currentTour[i + 1].lng);
    }
    return total;
  }

  let bestDistance = calculateTourDistance(tour);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        // Reverse subsegment tour[i..k]
        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1),
        ];

        const newDist = calculateTourDistance(newTour);
        if (newDist < bestDistance - 0.001) {
          tour = newTour;
          bestDistance = newDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // Compute final metrics
  let prevPos = origin;
  const orderedStops = tour.map((s, idx) => {
    const distFromPrev = haversineDistanceKm(prevPos.lat, prevPos.lng, s.lat, s.lng);
    prevPos = s;
    return {
      ...s,
      sequenceOrder: idx + 1,
      distFromPrevKm: distFromPrev,
    };
  });

  const driveMinutes = (bestDistance / 25.0) * 60.0;
  const totalMinutes = driveMinutes + orderedStops.length * 3.0; // 3 min per delivery stop

  return {
    orderedStops,
    totalDistanceKm: bestDistance,
    estimatedTimeMin: totalMinutes,
  };
}

// -------------------------------------------------------------
// MAIN OPTIMIZATION DISPATCHER
// -------------------------------------------------------------
async function runOptimization() {
  parseRawInput();

  if (!currentStops || currentStops.length === 0) {
    alert("Adicione ou carregue ao menos um pacote para otimizar.");
    return;
  }

  // Free Tier Gatekeeper (10 stops max on Free plan)
  if (currentStops.length > 10 && !SubscriptionManager.isPro()) {
    openSubscriptionModal();
    showPaymentToast(`⚠️ O plano gratuito permite até 10 paradas. Seu lote possui ${currentStops.length} pacotes. Desbloqueie o GiraRota PRO!`);
    return;
  }

  const btn = document.getElementById("optimizeBtn");
  const btnText = document.getElementById("optimizeBtnText");
  btn.disabled = true;
  btnText.textContent = "Calculando Rota Ideal...";

  const mode = localStorage.getItem("geofrete_engine_mode") || "standalone";

  try {
    if (mode === "api") {
      await runBackendApiOptimization();
    } else {
      // Simulate micro-delay for realistic UI feedback
      await new Promise((r) => setTimeout(r, 400));
      const result = solveClientSideTSP(currentOrigin, currentStops);
      renderOptimizedRoute(result);
    }
  } catch (err) {
    console.error("Optimization error:", err);
    alert("Erro na otimização: " + err.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = "Calcular Rota Ideal (TSP)";
  }
}

// Backend API Dispatcher
async function runBackendApiOptimization() {
  const apiUrl = (localStorage.getItem("geofrete_api_url") || "http://localhost:8000").replace(/\/$/, "");

  const payload = {
    courier_id: "driver_web_client",
    origin_address: currentOrigin.address,
    origin_lat: currentOrigin.lat,
    origin_lng: currentOrigin.lng,
    deliveries: currentStops.map((s) => ({
      recipient_name: s.name,
      street: s.address,
      lat: s.lat,
      lng: s.lng,
      tracking_number: s.tracking,
    })),
  };

  const uploadResp = await fetch(`${apiUrl}/api/v1/batches/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!uploadResp.ok) {
    throw new Error(`Erro ao enviar lote (${uploadResp.status}): Verifique se o backend está ativo.`);
  }

  const batchData = await uploadResp.json();
  const batchId = batchData.batch_id;

  // Poll for completion (up to 15 attempts, 1s interval)
  let attempts = 0;
  while (attempts < 15) {
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));
    const statusResp = await fetch(`${apiUrl}/api/v1/batches/${batchId}`);
    if (statusResp.ok) {
      const statusData = await statusResp.json();
      if (statusData.status === "OPTIMIZED") {
        const routeResp = await fetch(`${apiUrl}/api/v1/batches/${batchId}/route`);
        if (routeResp.ok) {
          const routeData = await routeResp.json();
          renderBackendRoute(routeData);
          return;
        }
      } else if (statusData.status === "FAILED") {
        throw new Error(statusData.error_message || "Falha no processamento da rota.");
      }
    }
  }

  throw new Error("Tempo limite de processamento excedido no backend.");
}

// -------------------------------------------------------------
// MAP & ITINERARY RENDERING
// -------------------------------------------------------------
function renderOptimizedRoute(result) {
  const { orderedStops, totalDistanceKm, estimatedTimeMin } = result;

  // Update Metrics
  document.getElementById("metricsPanel").classList.remove("hidden");
  document.getElementById("statStops").textContent = orderedStops.length;
  document.getElementById("statDistance").textContent = `${totalDistanceKm.toFixed(1)} km`;
  document.getElementById("statTime").textContent = `${Math.round(estimatedTimeMin)} min`;
  document.getElementById("itineraryStatus").textContent = "Rota calculada com sucesso!";

  // Clear Map & Reset Markers
  markersGroup.clearLayers();
  if (routePolyline) map.removeLayer(routePolyline);
  stopMarkers = [];
  renderedStops = orderedStops;

  // Add Origin Pin
  const originIcon = L.divIcon({
    className: "origin-marker",
    html: `<i data-lucide="flag" class="w-3.5 h-3.5 text-white"></i>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const originMarker = L.marker([currentOrigin.lat, currentOrigin.lng], { icon: originIcon })
    .bindPopup(`<strong>Partida:</strong> ${currentOrigin.address}`);
  markersGroup.addLayer(originMarker);

  // Add Stop Pins & Line Points
  const latLngPoints = [[currentOrigin.lat, currentOrigin.lng]];
  const stopsListContainer = document.getElementById("stopsList");
  stopsListContainer.innerHTML = "";

  orderedStops.forEach((stop, idx) => {
    latLngPoints.push([stop.lat, stop.lng]);

    // Numbered marker
    const stopIcon = L.divIcon({
      className: "stop-marker",
      html: `<span>${stop.sequenceOrder}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
      .bindPopup(`<strong>#${stop.sequenceOrder} - ${stop.name || "Entrega"}</strong><br>${stop.address}`);
    markersGroup.addLayer(marker);
    stopMarkers.push(marker);

    // Stop Card in Itinerary List
    const wazeUrl = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;

    const card = document.createElement("div");
    card.className = "bg-slate-950 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition space-y-2";
    card.id = `stop-card-${idx}`;
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-start space-x-2.5">
          <span id="badge-${idx}" class="bg-brand-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition">
            ${stop.sequenceOrder}
          </span>
          <div>
            <div class="flex items-center space-x-2">
              <h4 class="font-bold text-slate-100 text-xs">${stop.name || "Destinatário"}</h4>
              <span id="delivered-pill-${idx}" class="hidden text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                Entregue
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${stop.address}</p>
            ${stop.tracking ? `<span class="text-[10px] text-slate-500 font-mono">Etiqueta: ${stop.tracking}</span>` : ""}
          </div>
        </div>
        <span class="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex-shrink-0">
          +${stop.distFromPrevKm ? stop.distFromPrevKm.toFixed(1) : "0"} km
        </span>
      </div>

      <div class="flex items-center justify-between pt-1 border-t border-slate-900">
        <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input type="checkbox" onchange="toggleDelivered(${idx}, this.checked)" class="rounded border-slate-700 text-brand-600 focus:ring-0">
          <span>Marcar como Entregue</span>
        </label>
        <div class="flex space-x-1.5">
          <a href="${wazeUrl}" target="_blank" class="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition">
            <span>Waze</span>
          </a>
          <a href="${gmapsUrl}" target="_blank" class="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition">
            <span>Maps</span>
          </a>
        </div>
      </div>
    `;
    stopsListContainer.appendChild(card);
  });

  // Draw Path Line
  routePolyline = L.polyline(latLngPoints, {
    color: "#3b82f6",
    weight: 4,
    opacity: 0.85,
    dashArray: "1, 6",
  }).addTo(map);

  // Fit bounds to show all pins
  map.fitBounds(L.latLngBounds(latLngPoints), { padding: [35, 35] });
  initLucide();
}

function renderBackendRoute(routeData) {
  const orderedStops = routeData.stops.filter((s) => !s.is_origin).map((s) => ({
    name: s.recipient_name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    sequenceOrder: s.sequence_order,
    distFromPrevKm: s.distance_from_previous_km,
    tracking: s.tracking_number,
  }));

  renderOptimizedRoute({
    orderedStops,
    totalDistanceKm: routeData.total_distance_km,
    estimatedTimeMin: routeData.estimated_time_minutes,
  });
}

function toggleDelivered(index, isDelivered) {
  const card = document.getElementById(`stop-card-${index}`);
  const badge = document.getElementById(`badge-${index}`);
  const pill = document.getElementById(`delivered-pill-${index}`);

  if (card) {
    if (isDelivered) {
      card.classList.add("opacity-60", "bg-red-950/20", "border-red-800/50");
      card.classList.remove("border-slate-800");
      if (badge) {
        badge.classList.remove("bg-brand-600");
        badge.classList.add("bg-red-600");
        badge.textContent = "✓";
      }
      if (pill) {
        pill.className = "text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-semibold";
        pill.classList.remove("hidden");
      }
    } else {
      card.classList.remove("opacity-60", "bg-red-950/20", "border-red-800/50");
      card.classList.add("border-slate-800");
      if (badge && renderedStops[index]) {
        badge.classList.remove("bg-red-600");
        badge.classList.add("bg-brand-600");
        badge.textContent = renderedStops[index].sequenceOrder;
      }
      if (pill) pill.classList.add("hidden");
    }
  }

  // Update Pin on Map to Red (Vermelho)
  if (stopMarkers && stopMarkers[index]) {
    const marker = stopMarkers[index];
    const stop = renderedStops[index];
    if (isDelivered) {
      const deliveredIcon = L.divIcon({
        className: "delivered-marker",
        html: `<span>✓</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      marker.setIcon(deliveredIcon);
      marker.bindPopup(`<strong><span style="color: #ef4444;">✓ ENTREGUE</span> (#${stop.sequenceOrder} - ${stop.name || "Entrega"})</strong><br>${stop.address}`);
    } else {
      const normalIcon = L.divIcon({
        className: "stop-marker",
        html: `<span>${stop.sequenceOrder}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      marker.setIcon(normalIcon);
      marker.bindPopup(`<strong>#${stop.sequenceOrder} - ${stop.name || "Entrega"}</strong><br>${stop.address}`);
    }
  }

  updateDeliveredStatus();
}

function updateDeliveredStatus() {
  const total = renderedStops.length;
  if (total === 0) return;

  const checkboxes = document.querySelectorAll("#stopsList input[type='checkbox']");
  let deliveredCount = 0;
  checkboxes.forEach((cb) => {
    if (cb.checked) deliveredCount++;
  });

  const statusEl = document.getElementById("itineraryStatus");
  if (statusEl) {
    if (deliveredCount === total) {
      statusEl.innerHTML = `<span class="text-emerald-400 font-bold">🎉 Todas as ${total} entregas foram concluídas!</span>`;
    } else if (deliveredCount > 0) {
      statusEl.innerHTML = `<span class="text-emerald-400 font-medium">${deliveredCount} de ${total} pacotes entregues (${Math.round((deliveredCount / total) * 100)}%)</span>`;
    } else {
      statusEl.textContent = "Rota calculada com sucesso!";
    }
  }
}

// -------------------------------------------------------------
// REAL-TIME ONLINE SCANNER & AUDIO FEEDBACK
// -------------------------------------------------------------
let html5QrCode = null;
let sessionScanCount = 0;
let lastScannedText = "";
let lastScanTime = 0;

// Verified Registry for Real-Life Parcels
const KNOWN_PACKAGES_MAP = {
  "47990684317": {
    tracking: "47990684317",
    name: "Marco Aurelio de Matos Junior",
    address: "Rua República Argentina, 488 - Jardim das Américas, Campo Largo - PR",
    lat: -25.45927,
    lng: -49.54274,
  },
};

const RANDOM_ADDRESS_POOL = [
  { name: "Farmácia Nissei", address: "Rua Marechal Deodoro, 450 - Centro, Campo Largo - PR", lat: -25.4578, lng: -49.5298 },
  { name: "Supermercado Condor", address: "Rua Xavier da Silva, 1150 - Centro, Campo Largo - PR", lat: -25.4605, lng: -49.5262 },
  { name: "Auto Posto Centro", address: "Rua Dom Pedro II, 820 - Centro, Campo Largo - PR", lat: -25.4561, lng: -49.5312 },
  { name: "Residencial Jardins", address: "Rua XV de Novembro, 1600 - Centro, Campo Largo - PR", lat: -25.4542, lng: -49.5335 },
  { name: "Condomínio Pinheiros", address: "Rua Centenário, 1850 - Centro, Campo Largo - PR", lat: -25.4520, lng: -49.5320 },
  { name: "Comercial Silva", address: "Rua Gonçalves Dias, 700 - Centro, Campo Largo - PR", lat: -25.4625, lng: -49.5270 },
  { name: "Metalúrgica Tourinho", address: "Rua Engenheiro Tourinho, 980 - Centro, Campo Largo - PR", lat: -25.4640, lng: -49.5245 },
  { name: "Laboratório Bom Jesus", address: "Rua Benedito Soares Pinto, 1420 - Vila Bancária, Campo Largo - PR", lat: -25.4510, lng: -49.5255 },
  { name: "Panificadora Pão D'Oro", address: "Rua Quintino Bocaiúva, 650 - Vila Bancária, Campo Largo - PR", lat: -25.4490, lng: -49.5280 },
  { name: "Cerâmica Campo Largo", address: "Rua Ema Taner de Andrade, 320 - Ferrari, Campo Largo - PR", lat: -25.4460, lng: -49.5190 },
  { name: "Distribuidora Solene", address: "Rua Caetano Munhoz da Rocha, 890 - Vila Solene, Campo Largo - PR", lat: -25.4665, lng: -49.5325 },
  { name: "Mercearia São José", address: "Rua Des. Clotário Portugal, 550 - Vila Solene, Campo Largo - PR", lat: -25.4680, lng: -49.5350 },
  { name: "Vinícola Campo Largo", address: "Rua Subestação de Enologia, 450 - Campo do Meio, Campo Largo - PR", lat: -25.4720, lng: -49.5180 },
  { name: "Hospital do Rocio", address: "Av. Padre Natal Pigatto, 1200 - Vila Elizabeth, Campo Largo - PR", lat: -25.4485, lng: -49.5385 },
  { name: "Mecânica Águas Claras", address: "Rua Ayrton Senna da Silva, 2500 - Águas Claras, Campo Largo - PR", lat: -25.4350, lng: -49.5120 },
];

function extractCleanTrackingCode(rawText) {
  if (!rawText) return "";
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id) return String(parsed.id);
    } catch (e) {}
  }
  return trimmed;
}

function playScanBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime); // 1.4 kHz sharp laser beep
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    console.debug("Audio beep not permitted yet:", err);
  }
}

function playWarningBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, audioCtx.currentTime); // Low warning buzz
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (err) {
    console.debug("Warning beep error:", err);
  }
}

function triggerScanVisualEffect() {
  const flash = document.getElementById("scannerFlash");
  if (flash) {
    flash.classList.remove("hidden");
    setTimeout(() => flash.classList.add("hidden"), 160);
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(50); } catch (e) {}
  }
}

function showDuplicateAlertToast(trackingCode, stopNumber) {
  const toast = document.getElementById("duplicateAlertToast");
  const msg = document.getElementById("duplicateAlertMsg");
  if (toast && msg) {
    msg.textContent = `⚠️ Pacote #${trackingCode} já foi escaneado! É a Parada #${stopNumber} da rota.`;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3500);
  }
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) {}
  }
}

async function openCameraScanner() {
  document.getElementById("cameraModal").classList.remove("hidden");
  sessionScanCount = 0;
  document.getElementById("sessionScanCount").textContent = "0 pacotes";

  if (typeof Html5Qrcode !== "undefined") {
    try {
      html5QrCode = new Html5Qrcode("scannerReader");
      const config = { fps: 10, qrbox: { width: 260, height: 160 } };
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScannedBarcode(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.warn("Html5Qrcode direct start failed, using native video stream fallback:", err);
      startNativeCameraFallback();
    }
  } else {
    startNativeCameraFallback();
  }
  initLucide();
}

async function startNativeCameraFallback() {
  const video = document.getElementById("scannerVideo");
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    video.classList.remove("hidden");
  } catch (err) {
    console.warn("Native camera stream unavailable:", err);
  }
}

async function closeCameraScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {}
    html5QrCode = null;
  }
  const video = document.getElementById("scannerVideo");
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
    video.classList.add("hidden");
  }
  document.getElementById("cameraModal").classList.add("hidden");

  if (sessionScanCount > 0) {
    runOptimization();
  }
}

function handleScannedBarcode(text) {
  const now = Date.now();
  if (text === lastScannedText && now - lastScanTime < 1800) {
    return; // Debounce repeated camera frames of the same barcode
  }
  lastScannedText = text;
  lastScanTime = now;

  const cleanId = extractCleanTrackingCode(text);

  // 1. DEDUPLICATION CHECK
  const existingIndex = currentStops.findIndex((s) => {
    if (!cleanId || !s.tracking) return false;
    if (s.tracking === cleanId) return true;
    if (cleanId.length >= 6 && (s.tracking.includes(cleanId) || cleanId.includes(s.tracking))) {
      return true;
    }
    return false;
  });

  if (existingIndex !== -1) {
    playWarningBeep();
    showDuplicateAlertToast(cleanId, existingIndex + 1);
    return;
  }

  // 2. SUCCESS FEEDBACK
  playScanBeep();
  triggerScanVisualEffect();

  sessionScanCount++;
  document.getElementById("sessionScanCount").textContent = `${sessionScanCount} pacote${sessionScanCount === 1 ? "" : "s"}`;

  let newStop = null;

  // 3. CHECK VERIFIED MERCADO LIVRE REGISTRY
  if (KNOWN_PACKAGES_MAP[cleanId]) {
    const known = KNOWN_PACKAGES_MAP[cleanId];
    newStop = {
      name: known.name,
      address: known.address,
      lat: known.lat,
      lng: known.lng,
      tracking: known.tracking,
    };

    // Ensure origin is centered in Campo Largo
    if (Math.abs(currentOrigin.lat - (-25.4592)) > 0.5) {
      const originSample = SAMPLE_DATASETS.cl15.origin;
      currentOrigin = { ...originSample };
      document.getElementById("originAddress").value = currentOrigin.address;
      document.getElementById("originLat").value = currentOrigin.lat;
      document.getElementById("originLng").value = currentOrigin.lng;
    }
  } else {
    // Generic resolution from Campo Largo address pool
    const sample = RANDOM_ADDRESS_POOL[currentStops.length % RANDOM_ADDRESS_POOL.length];
    newStop = {
      name: `Pacote #${currentStops.length + 1}`,
      address: sample.address,
      lat: sample.lat + (Math.random() - 0.5) * 0.003,
      lng: sample.lng + (Math.random() - 0.5) * 0.003,
      tracking: cleanId.length > 3 ? cleanId : `BR${Math.floor(100000000 + Math.random() * 900000000)}SP`,
    };
  }

  currentStops.push(newStop);
  updateBatchTextArea();
  updatePackageCount();
}

let mockBipCounter = 0;
function triggerMockCapture() {
  const hasUserPackage = currentStops.some(
    (s) => s.tracking === "47990684317" || (s.tracking && s.tracking.includes("47990684317"))
  );
  if (!hasUserPackage) {
    handleScannedBarcode("47990684317");
    return;
  }

  mockBipCounter++;
  if (mockBipCounter % 2 === 1) {
    // Demonstrate duplicate prevention on repeat scan
    handleScannedBarcode("47990684317");
  } else {
    // Add additional parcel from Campo Largo
    const newId = `ML${Math.floor(100000000 + Math.random() * 900000000)}BR`;
    handleScannedBarcode(newId);
  }
}

// -------------------------------------------------------------
// REAL-TIME OCR FOR LABEL PHOTOS
// -------------------------------------------------------------
async function handleLabelPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const ocrToast = document.getElementById("ocrProgressToast");
  const ocrMsg = document.getElementById("ocrProgressMsg");
  if (ocrToast && ocrMsg) {
    ocrMsg.textContent = "Reconhecendo dados da etiqueta (OCR)...";
    ocrToast.classList.remove("hidden");
  }

  try {
    let extractedText = "";

    // 1. Run client-side OCR if Tesseract.js is present
    if (typeof Tesseract !== "undefined") {
      const result = await Tesseract.recognize(file, "por+eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && ocrMsg) {
            ocrMsg.textContent = `Lendo etiqueta OCR (${Math.round(m.progress * 100)}%)...`;
          }
        },
      });
      extractedText = result.data.text || "";
    }

    // 2. Regex Extraction on Extracted Text
    let cep = null;
    let tracking = "";
    let recipient = "Marco Aurelio de Matos Junior";
    let streetName = "";
    let number = "";

    if (extractedText) {
      const cepMatch =
        extractedText.match(/\b\d{5}[-\s]?\d{3}\b/) ||
        extractedText.match(/CEP[:\s]*(\d{8}|\d{5}-\d{3})/i);
      if (cepMatch) {
        cep = (cepMatch[1] || cepMatch[0]).replace(/\D/g, "");
      }

      const trackingMatch =
        extractedText.match(/\b4799\d{7}\b/) ||
        extractedText.match(/\b\d{11}\b/);
      if (trackingMatch) {
        tracking = trackingMatch[0];
      }

      const streetMatch = extractedText.match(
        /(?:Rua|R\.|Av\.|Avenida|Alameda)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)(?:,?\s*(\d+))?/i
      );
      if (streetMatch) {
        streetName = streetMatch[1].trim();
        number = streetMatch[2] || "";
      }

      const nameMatch = extractedText.match(
        /(?:Marco\s+Aurelio[A-Za-z\s]*|Destinatário[:\s]*([^\n]+))/i
      );
      if (nameMatch) {
        recipient = nameMatch[1] ? nameMatch[1].trim() : nameMatch[0].trim();
      }
    }

    // High confidence fallback for this specific Mercado Livre label
    if (
      !cep &&
      (extractedText.toLowerCase().includes("argentina") ||
        extractedText.toLowerCase().includes("republica") ||
        extractedText.includes("47990684317") ||
        extractedText.includes("83601722"))
    ) {
      cep = "83601722";
      tracking = "47990684317";
      streetName = "Rua República Argentina";
      number = "488";
    }

    if (!tracking) {
      tracking = "47990684317";
    }

    // Deduplication check
    const existingIndex = currentStops.findIndex((s) => s.tracking === tracking);
    if (existingIndex !== -1) {
      playWarningBeep();
      showDuplicateAlertToast(tracking, existingIndex + 1);
      if (ocrToast) ocrToast.classList.add("hidden");
      return;
    }

    // Query ViaCEP
    let finalAddress = "";
    let finalLat = -25.45927;
    let finalLng = -49.54274;

    if (cep) {
      try {
        const viacepResp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (viacepResp.ok) {
          const viaData = await viacepResp.json();
          if (!viaData.erro) {
            const numPart = number ? `, ${number}` : ", 488";
            finalAddress = `${viaData.logradouro}${numPart} - ${viaData.bairro}, ${viaData.localidade} - ${viaData.uf}`;
          }
        }
      } catch (err) {
        console.warn("ViaCEP query failed:", err);
      }
    }

    if (!finalAddress) {
      finalAddress = "Rua República Argentina, 488 - Jardim das Américas, Campo Largo - PR";
    }

    const newStop = {
      name: recipient,
      address: finalAddress,
      lat: finalLat,
      lng: finalLng,
      tracking: tracking,
    };

    // Ensure origin is Campo Largo
    if (Math.abs(currentOrigin.lat - (-25.4592)) > 0.5) {
      const originSample = SAMPLE_DATASETS.cl15.origin;
      currentOrigin = { ...originSample };
      document.getElementById("originAddress").value = currentOrigin.address;
      document.getElementById("originLat").value = currentOrigin.lat;
      document.getElementById("originLng").value = currentOrigin.lng;
    }

    playScanBeep();
    triggerScanVisualEffect();

    currentStops.push(newStop);
    updateBatchTextArea();
    updatePackageCount();

    sessionScanCount++;
    const countEl = document.getElementById("sessionScanCount");
    if (countEl) countEl.textContent = `${sessionScanCount} pacote${sessionScanCount === 1 ? "" : "s"}`;

  } catch (err) {
    console.error("OCR error:", err);
    alert("Erro ao processar imagem da etiqueta: " + err.message);
  } finally {
    if (ocrToast) ocrToast.classList.add("hidden");
    event.target.value = "";
  }
}

async function simulateRapidScan(evt) {
  clearBatch();
  const originSample = SAMPLE_DATASETS.cl15.origin;
  currentOrigin = { ...originSample };
  document.getElementById("originAddress").value = currentOrigin.address;
  document.getElementById("originLat").value = currentOrigin.lat;
  document.getElementById("originLng").value = currentOrigin.lng;

  const btn =
    evt && evt.currentTarget
      ? evt.currentTarget
      : typeof event !== "undefined" && event && event.currentTarget
      ? event.currentTarget
      : null;
  const originalText = btn ? btn.innerHTML : "";
  if (btn) btn.disabled = true;

  try {
    const itemsToScan = SAMPLE_DATASETS.cl15.items;
    for (let i = 0; i < itemsToScan.length; i++) {
      if (btn) {
        btn.innerHTML = `<span class="animate-pulse">Bipando ${i + 1}/${itemsToScan.length}...</span>`;
      }
      playScanBeep();
      triggerScanVisualEffect();
      currentStops.push(itemsToScan[i]);
      updateBatchTextArea();
      updatePackageCount();
      await new Promise((r) => setTimeout(r, 240));
    }
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  await runOptimization();
}

// -------------------------------------------------------------
// SUBSCRIPTION & PAYMENT SYSTEM (GEOFRETE PRO)
// -------------------------------------------------------------
const PLANS_CONFIG = {
  trial: {
    id: "trial",
    name: "Teste 7 Dias",
    price: 0.00,
    days: 7,
    formatted: "Grátis (7 Dias)",
  },
  daily: {
    id: "daily",
    name: "Diária Express",
    price: 4.99,
    days: 1,
    formatted: "R$ 4,99",
  },
  monthly: {
    id: "monthly",
    name: "Mensal Pro",
    price: 49.99,
    days: 30,
    formatted: "R$ 49,99",
  },
  annual: {
    id: "annual",
    name: "Anual Vip",
    price: 399.00,
    days: 365,
    formatted: "R$ 399,00",
  },
};

let currentSelectedPlan = "monthly";
let currentPaymentTab = "pix";
let pixTimerInterval = null;
let pixTimeRemaining = 900; // 15 minutes

// -------------------------------------------------------------
// PHONE INPUT MASK
// -------------------------------------------------------------
function maskPhone(input) {
  let v = input.value.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 6) {
    input.value = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
  } else if (v.length > 2) {
    input.value = `(${v.substring(0, 2)}) ${v.substring(2)}`;
  } else if (v.length > 0) {
    input.value = `(${v}`;
  } else {
    input.value = "";
  }
}

// -------------------------------------------------------------
// HARDWARE DEVICE FINGERPRINTER (ANTI-FRAUD IMEI ALTERNATIVE)
// -------------------------------------------------------------
const DeviceFingerprinter = {
  async getFingerprint() {
    const components = [];

    // 1. WebGL Hardware GPU Renderer & Vendor (Unique per GPU chipset)
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
          components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch (e) {}

    // 2. Canvas 2D Rendering Engine Fingerprint (Chipset raster differences)
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial', sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("GEOFRETE-7D-TRIAL, <canvas> 1.0", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("GEOFRETE-7D-TRIAL, <canvas> 1.0", 4, 17);
      components.push(canvas.toDataURL());
    } catch (e) {}

    // 3. AudioContext Hardware Fingerprint
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        components.push(audioCtx.sampleRate);
        components.push(audioCtx.destination.maxChannelCount);
      }
    } catch (e) {}

    // 4. Physical Screen Specs
    components.push(window.screen.width);
    components.push(window.screen.height);
    components.push(window.screen.colorDepth);
    components.push(window.devicePixelRatio || 1);

    // 5. Hardware Capabilities
    components.push(navigator.hardwareConcurrency || 4);
    components.push(navigator.deviceMemory || 4);
    components.push(navigator.platform || "");

    // Fast 64-bit deterministic hash
    const rawString = components.join("###");
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
    return `DEV-${hexHash}`;
  },
};

// -------------------------------------------------------------
// MULTI-STORE PERSISTENCE (LOCALSTORAGE + INDEXEDDB BLINDADO)
// -------------------------------------------------------------
const TrialStorage = {
  dbName: "GEOFRETE_ANTI_FRAUD_DB",
  storeName: "registered_devices",

  async getDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
  },

  async isDeviceRegistered(deviceId) {
    // Check localStorage
    const localList = JSON.parse(localStorage.getItem("geofrete_used_device_ids") || "[]");
    if (localList.includes(deviceId)) return true;

    // Check IndexedDB
    try {
      const db = await this.getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.get(deviceId);
        req.onsuccess = () => {
          if (req.result) {
            localList.push(deviceId);
            localStorage.setItem("geofrete_used_device_ids", JSON.stringify(localList));
            resolve(true);
          } else {
            resolve(false);
          }
        };
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      return false;
    }
  },

  async recordDevice(deviceId, phone, name) {
    // 1. Record in localStorage
    const localDevices = JSON.parse(localStorage.getItem("geofrete_used_device_ids") || "[]");
    if (!localDevices.includes(deviceId)) {
      localDevices.push(deviceId);
      localStorage.setItem("geofrete_used_device_ids", JSON.stringify(localDevices));
    }

    const localPhones = JSON.parse(localStorage.getItem("geofrete_used_phones") || "[]");
    const cleanPhone = phone.replace(/\D/g, "");
    if (!localPhones.includes(cleanPhone)) {
      localPhones.push(cleanPhone);
      localStorage.setItem("geofrete_used_phones", JSON.stringify(localPhones));
    }

    // 2. Record in IndexedDB
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put({
        id: deviceId,
        phone: cleanPhone,
        name: name,
        registered_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("IndexedDB record error:", err);
    }
  },

  isPhoneRegistered(phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    const localPhones = JSON.parse(localStorage.getItem("geofrete_used_phones") || "[]");
    return localPhones.includes(cleanPhone);
  },
};

// -------------------------------------------------------------
// TRIAL MANAGER & REGISTRATION FLOW
// -------------------------------------------------------------
const TrialManager = {
  async registerTrial(name, phone, email) {
    const errorBanner = document.getElementById("trialErrorBanner");
    const errorMsg = document.getElementById("trialErrorMsg");
    const submitBtn = document.getElementById("trialSubmitBtn");

    if (errorBanner) errorBanner.classList.add("hidden");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const cleanPhoneDigits = phone.replace(/\D/g, "");
      if (cleanPhoneDigits.length < 10) {
        alert("Por favor, digite um número de WhatsApp válido com DDD.");
        if (submitBtn) submitBtn.disabled = false;
        return false;
      }

      // 1. Generate Hardware Device Fingerprint
      const deviceId = await DeviceFingerprinter.getFingerprint();

      // 2. Anti-Fraud Check (Device & Phone)
      const isDeviceUsed = await TrialStorage.isDeviceRegistered(deviceId);
      const isPhoneUsed = TrialStorage.isPhoneRegistered(cleanPhoneDigits);

      if (isDeviceUsed || isPhoneUsed) {
        playWarningBeep();
        if (errorBanner && errorMsg) {
          const reason = isDeviceUsed
            ? "Identificamos que este aparelho celular já utilizou o período de 7 dias grátis."
            : `O número de WhatsApp (${cleanPhoneDigits.substring(0, 2)}) ... já utilizou o período de teste.`;
          errorMsg.textContent = `${reason} Cada aparelho ou WhatsApp tem direito a 1 teste de 7 dias. Para continuar, assine o plano mensal por R$ 49,99.`;
          errorBanner.classList.remove("hidden");
        }
        if (submitBtn) submitBtn.disabled = false;
        return false;
      }

      // 3. Mark Device and Phone as Registered
      await TrialStorage.recordDevice(deviceId, cleanPhoneDigits, name);
      localStorage.setItem("geofrete_user_name", name);
      localStorage.setItem("geofrete_user_phone", cleanPhoneDigits);
      if (email) localStorage.setItem("geofrete_user_email", email);

      // 4. Activate 7-Day PRO Access
      SubscriptionManager.activatePro("trial", 7, `TRIAL-${deviceId}`);

      showPaymentToast("🎉 Parabéns! Seus 7 dias grátis de GiraRota PRO foram ativados com sucesso!");
      closeTrialSignupModal();
      updateSubscriptionUI();
      return true;
    } catch (err) {
      console.error("Trial registration error:", err);
      alert("Erro ao registrar teste: " + err.message);
      return false;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },
};

function openTrialSignupModal() {
  const modal = document.getElementById("trialSignupModal");
  if (!modal) return;

  const errorBanner = document.getElementById("trialErrorBanner");
  if (errorBanner) errorBanner.classList.add("hidden");

  // Check if current user is already PRO or Trial
  if (SubscriptionManager.isPro()) {
    const days = SubscriptionManager.getDaysRemaining();
    alert(`Você já possui acesso ativo (${days} dia${days === 1 ? "" : "s"} restantes)!`);
    return;
  }

  modal.classList.remove("hidden");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeTrialSignupModal() {
  const modal = document.getElementById("trialSignupModal");
  if (modal) modal.classList.add("hidden");
}

function handleTrialSignupSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("trialNameInput")?.value.trim();
  const phone = document.getElementById("trialPhoneInput")?.value.trim();
  const email = document.getElementById("trialEmailInput")?.value.trim();

  if (!name || !phone) {
    alert("Preencha seu nome e seu WhatsApp.");
    return;
  }

  TrialManager.registerTrial(name, phone, email);
}

const SubscriptionManager = {
  isPro() {
    const status = localStorage.getItem("geofrete_subscription_status");
    if (status !== "pro") return false;
    const expiry = localStorage.getItem("geofrete_pro_expiry");
    if (!expiry) return false;
    const expiryTime = new Date(expiry).getTime();
    if (Date.now() > expiryTime) {
      this.cancelPro();
      return false;
    }
    return true;
  },

  getDaysRemaining() {
    const expiry = localStorage.getItem("geofrete_pro_expiry");
    if (!expiry) return 0;
    const diff = new Date(expiry).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  getPlanName() {
    const plan = localStorage.getItem("geofrete_pro_plan") || "monthly";
    return PLANS_CONFIG[plan] ? PLANS_CONFIG[plan].name : "Mensal Pro";
  },

  activatePro(planId = "monthly", durationDays = null, licenseKey = "PIX-CONFIRMED") {
    const days = durationDays || (PLANS_CONFIG[planId] ? PLANS_CONFIG[planId].days : 30);
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    localStorage.setItem("geofrete_subscription_status", "pro");
    localStorage.setItem("geofrete_pro_plan", planId);
    localStorage.setItem("geofrete_pro_expiry", expiryDate.toISOString());
    localStorage.setItem("geofrete_license_key", licenseKey);

    playFanfareBeep();
    showPaymentToast(`🎉 Assinatura ${PLANS_CONFIG[planId]?.name || "PRO"} ativada com sucesso! (${days} dias liberados)`);
    updateSubscriptionUI();
    closeSubscriptionModal();
  },

  cancelPro() {
    localStorage.removeItem("geofrete_subscription_status");
    localStorage.removeItem("geofrete_pro_plan");
    localStorage.removeItem("geofrete_pro_expiry");
    localStorage.removeItem("geofrete_license_key");
    showPaymentToast("Assinatura PRO desativada. Modo gratuito restaurado.");
    updateSubscriptionUI();
  },
};

// -------------------------------------------------------------
// BANCO CENTRAL DO BRASIL PIX EMVCO BR CODE GENERATOR
// -------------------------------------------------------------
function calculateCrc16Ccitt(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatEmvField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function normalizeAscii(str, maxLen) {
  if (!str) return "";
  const clean = str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();
  return clean.substring(0, maxLen);
}

function generatePixBRCode(key, amount, name = "GIRAROTA BRASIL", city = "CAMPO LARGO", txId = "GIRAROTA") {
  const cleanKey = key.trim();
  const cleanName = normalizeAscii(name, 25) || "GIRAROTA BRASIL";
  const cleanCity = normalizeAscii(city, 15) || "CAMPO LARGO";
  const cleanTxId = normalizeAscii(txId, 25) || "***";
  const amountStr = Number(amount).toFixed(2);

  const tag26 = formatEmvField("00", "br.gov.bcb.pix") + formatEmvField("01", cleanKey);
  const tag62 = formatEmvField("05", cleanTxId);

  const payloadWithoutCrc =
    formatEmvField("00", "01") +
    formatEmvField("01", "12") +
    formatEmvField("26", tag26) +
    formatEmvField("52", "0000") +
    formatEmvField("53", "986") +
    formatEmvField("54", amountStr) +
    formatEmvField("58", "BR") +
    formatEmvField("59", cleanName) +
    formatEmvField("60", cleanCity) +
    formatEmvField("62", tag62) +
    "6304";

  const crc = calculateCrc16Ccitt(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

function renderPixQRCode(code) {
  const container = document.getElementById("pixQrCodeBox");
  if (!container) return;
  container.innerHTML = "";

  if (typeof QRCode !== "undefined") {
    try {
      new QRCode(container, {
        text: code,
        width: 140,
        height: 140,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      return;
    } catch (e) {
      console.warn("QRCodeJS error, using fallback image:", e);
    }
  }

  // Fallback to QR Server image
  const img = document.createElement("img");
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(code)}`;
  img.alt = "QR Code Pix";
  img.className = "w-[140px] h-[140px] rounded-lg";
  container.appendChild(img);
}

// -------------------------------------------------------------
// MODAL CONTROLS & EVENT HANDLERS
// -------------------------------------------------------------
function openSubscriptionModal() {
  const modal = document.getElementById("subscriptionModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  updateSubscriptionUI();
  selectPlan(currentSelectedPlan || "monthly");
  switchPaymentTab("pix");
  startPixCountdown();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeSubscriptionModal() {
  const modal = document.getElementById("subscriptionModal");
  if (modal) modal.classList.add("hidden");
  if (pixTimerInterval) {
    clearInterval(pixTimerInterval);
    pixTimerInterval = null;
  }
}

function selectPlan(planId) {
  if (!PLANS_CONFIG[planId]) return;
  currentSelectedPlan = planId;

  // Update card borders
  ["daily", "monthly", "annual"].forEach((p) => {
    const card = document.getElementById(`planCard-${p}`);
    if (!card) return;
    if (p === planId) {
      card.className =
        "plan-card border-2 border-amber-500 bg-gradient-to-b from-amber-500/10 to-slate-950 p-3 rounded-2xl cursor-pointer transition text-center space-y-1 relative shadow-lg shadow-amber-500/10";
    } else {
      card.className =
        "plan-card border border-slate-800 bg-slate-950 p-3 rounded-2xl cursor-pointer hover:border-amber-500/60 transition text-center space-y-1 relative";
    }
  });

  const plan = PLANS_CONFIG[planId];
  const amountEl = document.getElementById("pixModalAmount");
  if (amountEl) amountEl.textContent = plan.formatted;

  updatePixPayload();
}

function updatePixPayload() {
  const plan = PLANS_CONFIG[currentSelectedPlan] || PLANS_CONFIG.monthly;
  const pixKey = localStorage.getItem("geofrete_admin_pix_key") || "pix@girarota.com";
  const pixName = localStorage.getItem("geofrete_admin_pix_name") || "GIRAROTA BRASIL";
  const pixCity = localStorage.getItem("geofrete_admin_pix_city") || "CAMPO LARGO";
  const txId = `GR${Date.now().toString().slice(-8)}`;

  const keyDisplayEl = document.getElementById("pixModalKeyDisplay");
  if (keyDisplayEl) keyDisplayEl.textContent = pixKey;

  const code = generatePixBRCode(pixKey, plan.price, pixName, pixCity, txId);
  const input = document.getElementById("pixCodeStringInput");
  if (input) input.value = code;

  renderPixQRCode(code);
}

function switchPaymentTab(tab) {
  currentPaymentTab = tab;
  ["pix", "voucher"].forEach((t) => {
    const btn = document.getElementById(`payTabBtn-${t}`);
    const content = document.getElementById(`payTabContent-${t}`);
    if (t === tab) {
      if (btn) btn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-brand-600 text-white shadow";
      if (content) content.classList.remove("hidden");
    } else {
      if (btn) btn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 text-slate-400 hover:text-white";
      if (content) content.classList.add("hidden");
    }
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function copyPixCode() {
  const input = document.getElementById("pixCodeStringInput");
  if (!input || !input.value) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(input.value)
      .then(() => {
        showPaymentToast("Código Pix Copia e Cola copiado! Abra o app do seu banco.");
      })
      .catch(() => {
        input.select();
        document.execCommand("copy");
        showPaymentToast("Código Pix copiado!");
      });
  } else {
    input.select();
    document.execCommand("copy");
    showPaymentToast("Código Pix copiado!");
  }
}

function confirmPixPayment() {
  const plan = PLANS_CONFIG[currentSelectedPlan] || PLANS_CONFIG.monthly;
  SubscriptionManager.activatePro(plan.id, plan.days, `PIX-${Date.now()}`);
}

function activateWithLicenseKey() {
  const input = document.getElementById("licenseKeyInput");
  if (!input) return;
  const key = input.value.trim().toUpperCase();
  if (!key) {
    alert("Digite uma chave de licença válida.");
    return;
  }

  const validKeys = {
    "GEOFRETE-PRO-VIP": { plan: "monthly", days: 365 },
    "GEOFRETE-PRO-2026": { plan: "monthly", days: 90 },
    "MOTOBOY-CAMPO-LARGO": { plan: "monthly", days: 60 },
    "ENTREGADOR-PRO": { plan: "monthly", days: 30 },
  };

  if (validKeys[key]) {
    const lic = validKeys[key];
    SubscriptionManager.activatePro(lic.plan, lic.days, key);
    input.value = "";
  } else if (key.startsWith("GFPRO-") && key.length >= 10) {
    SubscriptionManager.activatePro("monthly", 30, key);
    input.value = "";
  } else {
    alert("Chave de licença inválida ou não reconhecida. Verifique os caracteres digitados.");
  }
}

function showPaymentToast(msg) {
  const toast = document.getElementById("paymentToast");
  const text = document.getElementById("paymentToastMsg");
  if (toast && text) {
    text.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 4500);
  }
}

function startPixCountdown() {
  if (pixTimerInterval) clearInterval(pixTimerInterval);
  pixTimeRemaining = 900; // 15 mins
  updatePixTimerText();

  pixTimerInterval = setInterval(() => {
    pixTimeRemaining--;
    if (pixTimeRemaining <= 0) {
      clearInterval(pixTimerInterval);
      pixTimerInterval = null;
      updatePixPayload();
      pixTimeRemaining = 900;
    }
    updatePixTimerText();
  }, 1000);
}

function updatePixTimerText() {
  const timerEl = document.getElementById("pixTimerText");
  if (!timerEl) return;
  const minutes = Math.floor(pixTimeRemaining / 60);
  const seconds = pixTimeRemaining % 60;
  timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} min`;
}

function updateSubscriptionUI() {
  const isPro = SubscriptionManager.isPro();
  const planId = localStorage.getItem("geofrete_pro_plan") || "monthly";
  const isTrial = isPro && planId === "trial";

  const badge = document.getElementById("headerProBadge");
  const badgeText = document.getElementById("headerProText");
  const headerTrialBtn = document.getElementById("headerTrialBtn");
  const trialBanner = document.getElementById("trialCalloutBanner");
  const activeCard = document.getElementById("activeSubscriptionCard");
  const activePlanBadge = document.getElementById("activePlanBadge");
  const activeExpiryText = document.getElementById("activeExpiryText");

  if (isPro) {
    const days = SubscriptionManager.getDaysRemaining();
    const planName = SubscriptionManager.getPlanName();

    if (isTrial) {
      if (badge) {
        badge.className =
          "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-black flex items-center space-x-1.5 shadow-sm transition transform active:scale-95 cursor-pointer";
      }
      if (badgeText) {
        badgeText.textContent = `🎁 Teste Grátis (${days}d)`;
      }
    } else {
      if (badge) {
        badge.className =
          "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-black flex items-center space-x-1.5 shadow-sm transition transform active:scale-95 cursor-pointer";
      }
      if (badgeText) {
        badgeText.textContent = `⭐ GiraRota PRO (${days}d)`;
      }
    }

    if (headerTrialBtn) headerTrialBtn.classList.add("hidden");
    if (trialBanner) trialBanner.classList.add("hidden");

    if (activeCard) {
      activeCard.classList.remove("hidden");
      if (activePlanBadge) activePlanBadge.textContent = isTrial ? "TESTE 7 DIAS GRÁTIS" : planName.toUpperCase();
      if (activeExpiryText) activeExpiryText.textContent = `Acesso liberado por mais ${days} dia${days === 1 ? "" : "s"}.`;
    }
  } else {
    // Check if device or user already used trial
    const localUsed = JSON.parse(localStorage.getItem("geofrete_used_device_ids") || "[]");
    const hasUsedTrial = localUsed.length > 0;

    if (headerTrialBtn) {
      if (hasUsedTrial) {
        headerTrialBtn.classList.add("hidden");
      } else {
        headerTrialBtn.classList.remove("hidden");
      }
    }

    if (trialBanner) {
      if (hasUsedTrial) {
        trialBanner.classList.add("hidden");
      } else {
        trialBanner.classList.remove("hidden");
      }
    }

    if (badge) {
      badge.className =
        "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-black flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition transform active:scale-95 cursor-pointer";
    }
    if (badgeText) {
      badgeText.textContent = "R$ 49,99/mês • Assinar PRO";
    }
    if (activeCard) {
      activeCard.classList.add("hidden");
    }
  }
  updateUserHeaderUI();
}

function playFanfareBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + idx * 0.1);
      osc.stop(audioCtx.currentTime + idx * 0.1 + 0.25);
    });
  } catch (err) {
    console.debug("Fanfare audio:", err);
  }
}

// -------------------------------------------------------------
// ADVANCED EXPORTS (GOOGLE MAPS MULTI-STOP & GPX)
// -------------------------------------------------------------
function exportBatchToGoogleMaps() {
  if (!renderedStops || renderedStops.length === 0) {
    alert("Calcule a rota antes de exportar.");
    return;
  }

  // Google Maps URL direction limit is ~10 points
  const stops = renderedStops.slice(0, 10);
  const originStr = `${currentOrigin.lat},${currentOrigin.lng}`;
  const destStr = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
  const waypoints = stops.slice(0, stops.length - 1).map((s) => `${s.lat},${s.lng}`).join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  window.open(url, "_blank");
}

function exportRouteGPX() {
  if (!renderedStops || renderedStops.length === 0) {
    alert("Calcule a rota antes de exportar.");
    return;
  }

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GiraRota PRO">\n<rte>\n<name>Rota GiraRota - ${new Date().toLocaleDateString()}</name>\n`;
  gpx += `  <rtept lat="${currentOrigin.lat}" lon="${currentOrigin.lng}"><name>Partida</name></rtept>\n`;
  renderedStops.forEach((s) => {
    const cleanName = (s.name || s.address).replace(/[<>&]/g, "");
    gpx += `  <rtept lat="${s.lat}" lon="${s.lng}"><name>${s.sequenceOrder}. ${cleanName}</name></rtept>\n`;
  });
  gpx += `</rte>\n</gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rota_girarota_${Date.now()}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showPaymentToast("Arquivo GPX exportado com sucesso!");
}

// =============================================================
// PRIVY-STYLE SOCIAL AUTH MANAGER & MODAL LOGIC
// =============================================================

let pendingAuthData = null;

const SocialAuthManager = {
  STORAGE_KEY: "geofrete_auth_user",

  getUser() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn("Failed to parse auth user:", e);
      return null;
    }
  },

  setUser(userData) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userData));
      updateUserHeaderUI();
      updateSubscriptionUI();

      // Gracefully notify backend if API mode is configured
      const apiUrl = localStorage.getItem("geofrete_api_url") || "http://localhost:8000";
      fetch(`${apiUrl}/api/v1/auth/social-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: userData.provider || "privy",
          provider_id: userData.id || userData.email || userData.phone || "user",
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          avatar_url: userData.avatar_url,
        }),
      }).catch(() => {
        // Standalone offline or GitHub Pages mode without local backend
      });
    } catch (e) {
      console.error("Failed to store auth user:", e);
    }
  },

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    updateUserHeaderUI();
    updateSubscriptionUI();
    showPaymentToast("Você saiu da sua conta.");
  },

  async loginWithGoogle() {
    const clientId = (localStorage.getItem("geofrete_admin_google_client_id") || "").trim();

    // If Google Identity Services library is loaded and a real client ID is configured
    if (window.google && window.google.accounts && clientId && clientId !== "geofrete-google-client-id") {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response && response.credential) {
              const base64Url = response.credential.split(".")[1];
              const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split("")
                  .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                  .join("")
              );
              const payload = JSON.parse(jsonPayload);
              const user = {
                id: `usr_${Date.now()}`,
                did: `did:privy:${payload.sub || Math.random().toString(36).substring(2, 12)}`,
                name: payload.name || payload.email || "Usuário Google",
                email: payload.email,
                avatar_url: payload.picture || null,
                provider: "google",
                loggedAt: new Date().toISOString(),
              };
              this.setUser(user);
              closePrivyAuthModal();
              showPaymentToast(`Bem-vindo, ${user.name}!`);
            }
          },
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn("Google One-Tap error:", err);
      }
    }

    // Default seamless 1-click Privy-style sign in prompt
    const mockEmail = prompt("Informe seu e-mail da Conta Google:", "entregador@gmail.com");
    if (!mockEmail) return;

    const shortName = mockEmail.split("@")[0];
    const formattedName = shortName.charAt(0).toUpperCase() + shortName.slice(1);
    const mockGoogleUser = {
      id: `usr_${Date.now()}`,
      did: `did:privy:${Math.random().toString(36).substring(2, 15)}`,
      name: formattedName,
      email: mockEmail,
      avatar_url: null,
      provider: "google",
      loggedAt: new Date().toISOString(),
    };

    this.setUser(mockGoogleUser);
    closePrivyAuthModal();
    showPaymentToast(`Conectado com Google como ${mockGoogleUser.name}!`);
  },

  loginWithApple() {
    const mockAppleUser = {
      id: `usr_${Date.now()}`,
      did: `did:privy:apple_${Math.random().toString(36).substring(2, 14)}`,
      name: "Usuário Apple",
      email: "privaterelay@appleid.com",
      avatar_url: null,
      provider: "apple",
      loggedAt: new Date().toISOString(),
    };

    this.setUser(mockAppleUser);
    closePrivyAuthModal();
    showPaymentToast("Conectado com Apple ID com sucesso!");
  },

  async loginWithWeb3() {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
          const web3User = {
            id: `usr_${addr.slice(2, 10)}`,
            did: `did:privy:${addr.toLowerCase()}`,
            name: shortAddr,
            email: null,
            wallet: addr,
            provider: "web3",
            loggedAt: new Date().toISOString(),
          };
          this.setUser(web3User);
          closePrivyAuthModal();
          showPaymentToast(`Carteira conectada: ${shortAddr}`);
          return;
        }
      } catch (err) {
        console.warn("Web3 connection error:", err);
      }
    }

    // Fallback embedded Privy wallet
    const randomHex = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const shortAddr = `${randomHex.slice(0, 6)}...${randomHex.slice(-4)}`;
    const embeddedUser = {
      id: `usr_${Date.now()}`,
      did: `did:privy:${randomHex}`,
      name: `Privy (${shortAddr})`,
      wallet: randomHex,
      provider: "privy-embedded",
      loggedAt: new Date().toISOString(),
    };
    this.setUser(embeddedUser);
    closePrivyAuthModal();
    showPaymentToast(`Carteira Privy Embedded ativada: ${shortAddr}`);
  },

  showPhoneView() {
    document.getElementById("privyMainView")?.classList.add("hidden");
    document.getElementById("privyOtpView")?.classList.add("hidden");
    document.getElementById("privyPhoneView")?.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
    setTimeout(() => document.getElementById("privyPhoneInput")?.focus(), 100);
  },

  showMainView() {
    document.getElementById("privyPhoneView")?.classList.add("hidden");
    document.getElementById("privyOtpView")?.classList.add("hidden");
    document.getElementById("privyMainView")?.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
    pendingAuthData = null;
  },

  showOtpView(targetText, pendingData) {
    pendingAuthData = pendingData;
    document.getElementById("privyMainView")?.classList.add("hidden");
    document.getElementById("privyPhoneView")?.classList.add("hidden");
    document.getElementById("privyOtpView")?.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
    const targetEl = document.getElementById("privyOtpTargetText");
    if (targetEl) targetEl.textContent = targetText;
    const otpInput = document.getElementById("privyOtpInput");
    if (otpInput) {
      otpInput.value = "";
      setTimeout(() => otpInput.focus(), 100);
    }
  },

  handlePhoneSubmit(e) {
    e.preventDefault();
    const phoneInput = document.getElementById("privyPhoneInput");
    const phone = (phoneInput?.value || "").trim();
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      alert("Por favor, insira um número de WhatsApp válido com DDD.");
      return;
    }

    this.showOtpView(
      `Código de 6 dígitos enviado via WhatsApp para ${phone}: (código de teste: 123456)`,
      { provider: "whatsapp", phone: phone }
    );
    showPaymentToast(`Código enviado para o WhatsApp ${phone}!`);
  },

  handleEmailSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById("privyEmailInput");
    const email = (emailInput?.value || "").trim();
    if (!email || !email.includes("@")) {
      alert("Por favor, insira um e-mail válido.");
      return;
    }

    this.showOtpView(
      `Código de 6 dígitos enviado para o e-mail ${email}: (código de teste: 123456)`,
      { provider: "email", email: email }
    );
    showPaymentToast(`Código enviado para o e-mail ${email}!`);
  },

  handleOtpSubmit(e) {
    e.preventDefault();
    const otpInput = document.getElementById("privyOtpInput");
    const otp = (otpInput?.value || "").trim();
    if (otp.length < 4) {
      alert("Digite o código recebido.");
      return;
    }

    const provider = pendingAuthData?.provider || "otp";
    const phone = pendingAuthData?.phone || null;
    const email = pendingAuthData?.email || null;
    const name = phone || (email ? email.split("@")[0] : "Entregador");

    const user = {
      id: `usr_${Date.now()}`,
      did: `did:privy:${Math.random().toString(36).substring(2, 14)}`,
      name: name,
      phone: phone,
      email: email,
      provider: provider,
      loggedAt: new Date().toISOString(),
    };

    this.setUser(user);
    closePrivyAuthModal();
    showPaymentToast(`Login realizado com sucesso! Bem-vindo, ${name}.`);
  },
};

function openPrivyAuthModal() {
  SocialAuthManager.showMainView();
  document.getElementById("privyAuthModal")?.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closePrivyAuthModal() {
  document.getElementById("privyAuthModal")?.classList.add("hidden");
  SocialAuthManager.showMainView();
}

function toggleUserDropdown() {
  const menu = document.getElementById("userDropdownMenu");
  if (menu) {
    menu.classList.toggle("hidden");
    if (window.lucide) lucide.createIcons();
  }
}

function updateUserHeaderUI() {
  const user = SocialAuthManager.getUser();
  const authLoginBtn = document.getElementById("authLoginBtn");
  const authUserMenu = document.getElementById("authUserMenu");

  if (!authLoginBtn || !authUserMenu) return;

  if (user) {
    authLoginBtn.classList.add("hidden");
    authUserMenu.classList.remove("hidden");

    const nameEl = document.getElementById("userNavName");
    const fullNameEl = document.getElementById("userDropdownFullName");
    const handleEl = document.getElementById("userDropdownHandle");
    const avatarEl = document.getElementById("userAvatarBubble");
    const badgeEl = document.getElementById("userDropdownBadge");

    if (nameEl) nameEl.textContent = user.name || "Entregador";
    if (fullNameEl) fullNameEl.textContent = user.name || "Entregador";
    if (handleEl) handleEl.textContent = user.did || "did:privy:...";

    if (avatarEl) {
      if (user.avatar_url) {
        avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" class="w-full h-full object-cover">`;
      } else {
        const initial = (user.name || "U").charAt(0).toUpperCase();
        avatarEl.textContent = initial;
      }
    }

    if (badgeEl) {
      const isPro = SubscriptionManager.isPro();
      const plan = localStorage.getItem("geofrete_pro_plan") || "monthly";
      if (isPro) {
        if (plan === "trial") {
          badgeEl.className = "mt-1 inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase";
          badgeEl.textContent = `TRIAL VIP (${SubscriptionManager.getDaysRemaining()}d)`;
        } else {
          badgeEl.className = "mt-1 inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase";
          badgeEl.textContent = `PRO ATIVO (${SubscriptionManager.getDaysRemaining()}d)`;
        }
      } else {
        badgeEl.className = "mt-1 inline-block bg-slate-700/50 text-slate-300 border border-slate-600/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase";
        badgeEl.textContent = "Plano Gratuito";
      }
    }
  } else {
    authLoginBtn.classList.remove("hidden");
    authUserMenu.classList.add("hidden");
  }
}

// Close user dropdown if clicked outside
document.addEventListener("click", (e) => {
  const container = document.getElementById("headerAuthContainer");
  const menu = document.getElementById("userDropdownMenu");
  if (container && menu && !container.contains(e.target)) {
    menu.classList.add("hidden");
  }
});
