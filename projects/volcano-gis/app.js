const map = L.map('map', { center: [20, 0], zoom: 3, zoomControl: false });

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const STATUS_COLOR = { Active: '#dc3545', Dormant: '#fd7e14', Extinct: '#6c757d' };
const STATUS_LABEL_TR = { Active: 'Aktif', Dormant: 'Uykuda', Extinct: 'Sönmüş' };

const markerGroups = {
    Active: L.layerGroup().addTo(map),
    Dormant: L.layerGroup().addTo(map),
    Extinct: L.layerGroup().addTo(map)
};

function volcanoIcon(status) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${STATUS_COLOR[status] || '#6c757d'};" class="marker-pin"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -8]
    });
}

let allVolcanoes = [];
let allMarkers = [];
let currentImpactArea = null;
let userLocationMarker = null;

function popupHtml(v) {
    return `
        <div class="popup-content">
            <h3>${v.name}</h3>
            <table>
                <tr><td>Ülke:</td><td>${v.country}</td></tr>
                <tr><td>Tür:</td><td>${v.type || 'Bilinmiyor'}</td></tr>
                <tr><td>Durum:</td><td>${STATUS_LABEL_TR[v.status]}</td></tr>
                <tr><td>Son Patlama:</td><td>${v.lastEruption}</td></tr>
                <tr><td>Konum:</td><td>${v.lat.toFixed(3)}, ${v.lon.toFixed(3)}</td></tr>
                <tr><td>Tahmini Etki Yarıçapı:</td><td>${v.radiusKm} km</td></tr>
                <tr><td>Tahmini Etki Alanı:</td><td>${v.areaKm2} km²</td></tr>
            </table>
            <button onclick="toggleImpactArea(${v.lat}, ${v.lon}, ${v.radiusKm * 1000})">Etki Alanını Göster</button>
        </div>
    `;
}

function toggleImpactArea(lat, lon, radiusMeters) {
    if (currentImpactArea) {
        map.removeLayer(currentImpactArea);
        currentImpactArea = null;
        return;
    }
    currentImpactArea = L.circle([lat, lon], {
        radius: radiusMeters,
        color: '#ff0000',
        fillColor: '#ff000033',
        fillOpacity: 0.3,
        weight: 2,
        dashArray: '5, 10'
    }).addTo(map);
    map.fitBounds(currentImpactArea.getBounds(), { padding: [50, 50] });
}

function createMarker(v) {
    const marker = L.marker([v.lat, v.lon], { icon: volcanoIcon(v.status) });
    marker.volcano = v;
    marker.bindPopup(popupHtml(v));
    return marker;
}

function updateStatistics(volcanoes) {
    const counts = { Active: 0, Dormant: 0, Extinct: 0 };
    volcanoes.forEach(v => counts[v.status]++);
    document.getElementById('statsContent').innerHTML = `
        <p>Aktif: <span>${counts.Active}</span></p>
        <p>Uykuda: <span>${counts.Dormant}</span></p>
        <p>Sönmüş: <span>${counts.Extinct}</span></p>
        <p>Toplam: <span>${volcanoes.length}</span></p>
    `;
}

function populateCountryFilter(volcanoes) {
    const countries = Array.from(new Set(volcanoes.map(v => v.country))).sort();
    const select = document.getElementById('countryFilter');
    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

function applyFilters() {
    const showActive = document.getElementById('f-active').checked;
    const showDormant = document.getElementById('f-dormant').checked;
    const showExtinct = document.getElementById('f-extinct').checked;
    const nameQuery = document.getElementById('nameSearch').value.trim().toLowerCase();
    const countryQuery = document.getElementById('countryFilter').value;

    Object.values(markerGroups).forEach(g => g.clearLayers());

    const statusVisible = { Active: showActive, Dormant: showDormant, Extinct: showExtinct };
    let visibleCount = 0;

    allMarkers.forEach(marker => {
        const v = marker.volcano;
        if (!statusVisible[v.status]) return;
        if (nameQuery && !v.name.toLowerCase().includes(nameQuery)) return;
        if (countryQuery && v.country !== countryQuery) return;
        markerGroups[v.status].addLayer(marker);
        visibleCount++;
    });

    const visibleVolcanoes = allVolcanoes.filter(v => {
        if (!statusVisible[v.status]) return false;
        if (nameQuery && !v.name.toLowerCase().includes(nameQuery)) return false;
        if (countryQuery && v.country !== countryQuery) return false;
        return true;
    });
    updateStatistics(visibleVolcanoes);
}

['f-active', 'f-dormant', 'f-extinct'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('nameSearch').addEventListener('input', applyFilters);
document.getElementById('countryFilter').addEventListener('change', applyFilters);

// Risk analizi
function analyzeLocation(userLatLng) {
    const dangerous = [];
    allVolcanoes.forEach(v => {
        const distance = userLatLng.distanceTo(L.latLng(v.lat, v.lon)) / 1000;
        if (distance <= v.radiusKm) {
            dangerous.push({ name: v.name, distance: distance.toFixed(1), status: v.status });
        }
    });
    dangerous.sort((a, b) => a.distance - b.distance);
    return dangerous;
}

function showRiskResult(dangerous) {
    const el = document.getElementById('riskResult');
    if (dangerous.length === 0) {
        el.innerHTML = `<div class="risk-alert safe"><strong>Güvenli bölge.</strong> Yakın çevrenizde etki alanına giren bir volkan bulunmuyor.</div>`;
        return;
    }
    el.innerHTML = `
        <div class="risk-alert danger">
            <strong>${dangerous.length} volkanın etki alanındasınız.</strong>
            ${dangerous.map(v => `
                <div class="nearby-item">
                    <span>${v.name} (${STATUS_LABEL_TR[v.status]})</span>
                    <span>${v.distance} km</span>
                </div>
            `).join('')}
        </div>
    `;
}

document.getElementById('checkMyLocation').addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
        alert('Tarayıcınız konum özelliğini desteklemiyor.');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            if (userLocationMarker) map.removeLayer(userLocationMarker);
            userLocationMarker = L.marker(latlng, {
                icon: L.divIcon({ className: 'user-location-marker', html: '<div class="user-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
            }).addTo(map);
            map.setView(latlng, 6);
            showRiskResult(analyzeLocation(latlng));
        },
        err => alert('Konum alınamadı: ' + err.message),
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// Veri yükleme (statik, yerel JSON — herhangi bir backend gerektirmez)
fetch('data/volcano-data.json')
    .then(res => res.json())
    .then(data => {
        allVolcanoes = data;
        allMarkers = data.map(v => {
            const marker = createMarker(v);
            markerGroups[v.status].addLayer(marker);
            return marker;
        });
        populateCountryFilter(data);
        updateStatistics(data);
    })
    .catch(err => {
        console.error('Volkan verisi yüklenemedi:', err);
        document.getElementById('statsContent').innerHTML = '<p>Veri yüklenirken bir hata oluştu.</p>';
    });
