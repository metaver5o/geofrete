// GEOFRETE - Client Application Logic
// Supports both Standalone In-Browser Optimization (GitHub Pages) and Live FastAPI Backend

let map = null;
let markersGroup = null;
let routePolyline = null;
let currentStops = [];
let currentOrigin = {
  address: "Praça da Sé - Centro Histórico, São Paulo - SP",
  lat: -23.5505,
  lng: -46.6333,
};

// Preset Sample Datasets for Instant Demonstration
const SAMPLE_DATASETS = {
  sp15: {
    origin: {
      address: "Galpão Logístico - Centro SP",
      lat: -23.5505,
      lng: -46.6333,
    },
    items: [
      { name: "João Carlos", address: "Av. Paulista, 1578 - Bela Vista, SP", lat: -23.5614, lng: -46.6558, tracking: "BR91238120" },
      { name: "Mariana Costa", address: "Rua Augusta, 1200 - Consolação, SP", lat: -23.5535, lng: -46.6530, tracking: "BR91238121" },
      { name: "Pedro Almeida", address: "Rua Oscar Freire, 800 - Jardins, SP", lat: -23.5630, lng: -46.6690, tracking: "BR91238122" },
      { name: "Camila Ribeiro", address: "Rua dos Pinheiros, 450 - Pinheiros, SP", lat: -23.5670, lng: -46.6880, tracking: "BR91238123" },
      { name: "Lucas Farias", address: "Av. Brig. Faria Lima, 2232 - Itaim Bibi, SP", lat: -23.5780, lng: -46.6890, tracking: "BR91238124" },
      { name: "Beatriz Santos", address: "Rua Pamplona, 1000 - Jardim Paulista, SP", lat: -23.5660, lng: -46.6570, tracking: "BR91238125" },
      { name: "Rafael Duarte", address: "Rua Vergueiro, 1353 - Paraíso, SP", lat: -23.5740, lng: -46.6410, tracking: "BR91238126" },
      { name: "Juliana Mendes", address: "Rua Domingos de Morais, 800 - Vila Mariana, SP", lat: -23.5850, lng: -46.6380, tracking: "BR91238127" },
      { name: "Fernando Rocha", address: "Av. Ibirapuera, 3103 - Moema, SP", lat: -23.6060, lng: -46.6620, tracking: "BR91238128" },
      { name: "Larissa Dias", address: "Rua da Consolação, 2400 - Cerqueira César, SP", lat: -23.5560, lng: -46.6610, tracking: "BR91238129" },
      { name: "Gustavo Nogueira", address: "Rua Haddock Lobo, 1307 - Cerqueira César, SP", lat: -23.5590, lng: -46.6650, tracking: "BR91238130" },
      { name: "Aline Moreira", address: "Rua Teodoro Sampaio, 1800 - Pinheiros, SP", lat: -23.5600, lng: -46.6830, tracking: "BR91238131" },
      { name: "Thiago Ramos", address: "Rua Bela Cintra, 900 - Consolação, SP", lat: -23.5540, lng: -46.6580, tracking: "BR91238132" },
      { name: "Vanessa Martins", address: "Alameda Santos, 1800 - Cerqueira César, SP", lat: -23.5620, lng: -46.6560, tracking: "BR91238133" },
      { name: "Rodrigo Silveira", address: "Rua Fradique Coutinho, 900 - Vila Madalena, SP", lat: -23.5580, lng: -46.6910, tracking: "BR91238134" }
    ]
  },
  sp30: {
    origin: {
      address: "Galpão Logístico - Centro SP",
      lat: -23.5505,
      lng: -46.6333,
    },
    items: [
      { name: "Parada 01", address: "Av. Paulista, 1578", lat: -23.5614, lng: -46.6558 },
      { name: "Parada 02", address: "Rua Augusta, 1200", lat: -23.5535, lng: -46.6530 },
      { name: "Parada 03", address: "Rua Oscar Freire, 800", lat: -23.5630, lng: -46.6690 },
      { name: "Parada 04", address: "Rua dos Pinheiros, 450", lat: -23.5670, lng: -46.6880 },
      { name: "Parada 05", address: "Av. Brig. Faria Lima, 2232", lat: -23.5780, lng: -46.6890 },
      { name: "Parada 06", address: "Rua Pamplona, 1000", lat: -23.5660, lng: -46.6570 },
      { name: "Parada 07", address: "Rua Vergueiro, 1353", lat: -23.5740, lng: -46.6410 },
      { name: "Parada 08", address: "Rua Domingos de Morais, 800", lat: -23.5850, lng: -46.6380 },
      { name: "Parada 09", address: "Av. Ibirapuera, 3103", lat: -23.6060, lng: -46.6620 },
      { name: "Parada 10", address: "Rua da Consolação, 2400", lat: -23.5560, lng: -46.6610 },
      { name: "Parada 11", address: "Rua Haddock Lobo, 1307", lat: -23.5590, lng: -46.6650 },
      { name: "Parada 12", address: "Rua Teodoro Sampaio, 1800", lat: -23.5600, lng: -46.6830 },
      { name: "Parada 13", address: "Rua Bela Cintra, 900", lat: -23.5540, lng: -46.6580 },
      { name: "Parada 14", address: "Alameda Santos, 1800", lat: -23.5620, lng: -46.6560 },
      { name: "Parada 15", address: "Rua Fradique Coutinho, 900", lat: -23.5580, lng: -46.6910 },
      { name: "Parada 16", address: "Rua Harmonia, 500 - Vila Madalena", lat: -23.5510, lng: -46.6930 },
      { name: "Parada 17", address: "Rua Aspicuelta, 300 - Vila Madalena", lat: -23.5545, lng: -46.6900 },
      { name: "Parada 18", address: "Rua Cunha Gago, 400 - Pinheiros", lat: -23.5690, lng: -46.6950 },
      { name: "Parada 19", address: "Rua dos Macunis, 120 - Alto de Pinheiros", lat: -23.5570, lng: -46.7050 },
      { name: "Parada 20", address: "Av. Pedroso de Morais, 1000 - Pinheiros", lat: -23.5610, lng: -46.6980 },
      { name: "Parada 21", address: "Rua Tabapuã, 800 - Itaim Bibi", lat: -23.5830, lng: -46.6800 },
      { name: "Parada 22", address: "Rua Joaquim Floriano, 500 - Itaim Bibi", lat: -23.5840, lng: -46.6770 },
      { name: "Parada 23", address: "Rua Clodomiro Amazonas, 300 - Itaim Bibi", lat: -23.5900, lng: -46.6820 },
      { name: "Parada 24", address: "Rua Gomes de Carvalho, 1500 - Vila Olímpia", lat: -23.5970, lng: -46.6870 },
      { name: "Parada 25", address: "Rua Funchal, 418 - Vila Olímpia", lat: -23.5950, lng: -46.6910 },
      { name: "Parada 26", address: "Av. Santo Amaro, 2000 - Moema", lat: -23.6040, lng: -46.6770 },
      { name: "Parada 27", address: "Alameda dos Maracatins, 800 - Moema", lat: -23.6090, lng: -46.6660 },
      { name: "Parada 28", address: "Alameda dos Nhambiquaras, 1200 - Moema", lat: -23.6110, lng: -46.6590 },
      { name: "Parada 29", address: "Rua Sena Madureira, 600 - Vila Mariana", lat: -23.5930, lng: -46.6450 },
      { name: "Parada 30", address: "Rua Estado de Israel, 300 - Vila Mariana", lat: -23.5960, lng: -46.6480 }
    ]
  },
  rj12: {
    origin: {
      address: "Centro - Rio de Janeiro, RJ",
      lat: -22.9068,
      lng: -43.1729,
    },
    items: [
      { name: "Parada 01", address: "Av. Rio Branco, 100 - Centro, RJ", lat: -22.9035, lng: -43.1780 },
      { name: "Parada 02", address: "Praça Tiradentes, 50 - Centro, RJ", lat: -22.9070, lng: -43.1830 },
      { name: "Parada 03", address: "Rua da Lapa, 120 - Lapa, RJ", lat: -22.9140, lng: -43.1800 },
      { name: "Parada 04", address: "Rua do Catete, 200 - Catete, RJ", lat: -22.9260, lng: -43.1770 },
      { name: "Parada 05", address: "Rua Marquês de Abrantes, 80 - Flamengo, RJ", lat: -22.9360, lng: -43.1790 },
      { name: "Parada 06", address: "Praia de Botafogo, 400 - Botafogo, RJ", lat: -22.9460, lng: -43.1830 },
      { name: "Parada 07", address: "Rua Voluntários da Pátria, 150 - Botafogo, RJ", lat: -22.9520, lng: -43.1890 },
      { name: "Parada 08", address: "Av. Princesa Isabel, 300 - Copacabana, RJ", lat: -22.9640, lng: -43.1770 },
      { name: "Parada 09", address: "Av. Atlântica, 2000 - Copacabana, RJ", lat: -22.9710, lng: -43.1840 },
      { name: "Parada 10", address: "Rua Barata Ribeiro, 500 - Copacabana, RJ", lat: -22.9730, lng: -43.1890 },
      { name: "Parada 11", address: "Rua Visconde de Pirajá, 300 - Ipanema, RJ", lat: -22.9840, lng: -43.2040 },
      { name: "Parada 12", address: "Rua Ataulfo de Paiva, 600 - Leblon, RJ", lat: -22.9860, lng: -43.2240 }
    ]
  }
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initLucide();
  loadSettings();

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

  // CartoDB Dark Matter tiles (modern, low glare for drivers)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

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
}

function saveSettings() {
  const selectedMode = document.querySelector("input[name='engineMode']:checked").value;
  const apiUrl = document.getElementById("apiEndpointInput").value.trim();

  localStorage.setItem("geofrete_engine_mode", selectedMode);
  localStorage.setItem("geofrete_api_url", apiUrl);

  updateModeUI(selectedMode);
  document.getElementById("settingsModal").classList.add("hidden");
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

// Load Samples
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
  if (!currentStops || currentStops.length === 0) {
    alert("Adicione ou carregue ao menos um pacote para otimizar.");
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

  // Clear Map
  markersGroup.clearLayers();
  if (routePolyline) map.removeLayer(routePolyline);

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

    // Stop Card in Itinerary List
    const wazeUrl = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;

    const card = document.createElement("div");
    card.className = "bg-slate-950 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition space-y-2";
    card.id = `stop-card-${idx}`;
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-start space-x-2.5">
          <span class="bg-brand-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            ${stop.sequenceOrder}
          </span>
          <div>
            <h4 class="font-bold text-slate-100 text-xs">${stop.name || "Destinatário"}</h4>
            <p class="text-xs text-slate-400 mt-0.5">${stop.address}</p>
            ${stop.tracking ? `<span class="text-[10px] text-slate-500 font-mono">Etiqueta: ${stop.tracking}</span>` : ""}
          </div>
        </div>
        <span class="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 flex-shrink-0">
          +${stop.distFromPrevKm ? stop.distFromPrevKm.toFixed(1) : "0"} km
        </span>
      </div>

      <div class="flex items-center justify-between pt-1 border-t border-slate-900">
        <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" onchange="toggleDelivered(${idx})" class="rounded border-slate-700 text-brand-600 focus:ring-0">
          <span>Entregue</span>
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

function toggleDelivered(index) {
  const card = document.getElementById(`stop-card-${index}`);
  if (card) {
    card.classList.toggle("opacity-40");
    card.classList.toggle("bg-slate-900");
  }
}
