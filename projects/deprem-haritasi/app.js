// Harita başlatma
const map = L.map('map').setView([39.0, 35.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Public deprem API'si (Kandilli Rasathanesi verisi, backend'e ihtiyaç duymadan tarayıcıdan erişilebilir)
const EARTHQUAKE_API = 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=100';
const REFRESH_INTERVAL_MS = 60000;

// Global değişkenler
let allEarthquakes = [];
let filteredEarthquakes = [];
let markers = {};
let magnitudeChart = null;
let depthChart = null;
let historyChart = null;
let lastEarthquakeId = null;

// Tarih seçici başlatma
flatpickr("#dateRange", {
    mode: "range",
    locale: "tr",
    maxDate: "today",
    dateFormat: "Y-m-d",
});

// API yanıtını uygulamanın beklediği formata çevir
function mapApiRecord(item) {
    const [lon, lat] = item.geojson && item.geojson.coordinates ? item.geojson.coordinates : [null, null];
    const [datePart, timePart] = (item.date_time || '').split(' ');
    return {
        id: item.earthquake_id || `${datePart}-${timePart}`,
        date: datePart,
        time: timePart,
        latitude: lat,
        longitude: lon,
        depth: Number(item.depth) || 0,
        magnitude: Number(item.mag) || 0,
        location: item.title || 'Bilinmiyor'
    };
}

async function fetchEarthquakes() {
    try {
        const response = await fetch(EARTHQUAKE_API);
        if (!response.ok) throw new Error('API yanıt vermedi');
        const payload = await response.json();
        const earthquakes = (payload.result || []).map(mapApiRecord).filter(eq => eq.latitude && eq.longitude);

        document.getElementById('info-panel').style.opacity = '1';

        allEarthquakes = earthquakes;
        applyFilters();

        if (earthquakes.length > 0) {
            const latestEq = earthquakes[0];
            if (latestEq.id !== lastEarthquakeId) {
                const isFirstLoad = lastEarthquakeId === null;
                lastEarthquakeId = latestEq.id;
                if (!isFirstLoad && Notification.permission === 'granted') {
                    new Notification('Yeni Deprem!', {
                        body: `${latestEq.location}\nBüyüklük: ${latestEq.magnitude.toFixed(1)}`,
                        icon: 'earthquake-icon.png'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Veri çekme hatası:', error);
        document.getElementById('info-panel').style.opacity = '0.5';
    }
}

fetchEarthquakes();
setInterval(fetchEarthquakes, REFRESH_INTERVAL_MS);

// Magnitude'a göre marker boyutu
function getMarkerSize(magnitude) {
    return Math.max(magnitude * 4, 6);
}

// Magnitude'a göre renk
function getColor(magnitude) {
    if (magnitude >= 5.0) return '#e74c3c';
    if (magnitude >= 4.0) return '#f39c12';
    if (magnitude >= 3.0) return '#3498db';
    return '#2ecc71';
}

// Magnitude'a göre CSS sınıfı
function getMagnitudeClass(magnitude) {
    if (magnitude >= 5.0) return 'magnitude-high';
    if (magnitude >= 4.0) return 'magnitude-medium';
    return 'magnitude-low';
}

// İstatistikleri güncelle
function updateStatistics(earthquakes) {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    const last24HourCount = earthquakes.filter(eq => new Date(eq.date + ' ' + eq.time) > last24Hours).length;
    document.getElementById('last24HourCount').textContent = last24HourCount;

    const maxEq = earthquakes.reduce((max, eq) => eq.magnitude > max.magnitude ? eq : max, earthquakes[0]);
    if (maxEq) {
        document.getElementById('maxMagnitude').textContent = maxEq.magnitude.toFixed(1);
        document.getElementById('maxMagnitudeLocation').textContent = maxEq.location;
    }
}

// Grafikleri güncelle
function updateCharts(earthquakes) {
    const magnitudeCounts = { '0-2.9': 0, '3.0-3.9': 0, '4.0-4.9': 0, '5.0+': 0 };
    earthquakes.forEach(eq => {
        if (eq.magnitude >= 5.0) magnitudeCounts['5.0+']++;
        else if (eq.magnitude >= 4.0) magnitudeCounts['4.0-4.9']++;
        else if (eq.magnitude >= 3.0) magnitudeCounts['3.0-3.9']++;
        else magnitudeCounts['0-2.9']++;
    });

    if (magnitudeChart) magnitudeChart.destroy();
    magnitudeChart = new Chart(document.getElementById('magnitudeChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(magnitudeCounts),
            datasets: [{
                label: 'Deprem Sayısı',
                data: Object.values(magnitudeCounts),
                backgroundColor: ['#2ecc71', '#3498db', '#f39c12', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Büyüklük Dağılımı' } }
        }
    });

    const depthCounts = { 'Yüzeysel': 0, 'Orta': 0, 'Derin': 0 };
    earthquakes.forEach(eq => {
        if (eq.depth > 60) depthCounts['Derin']++;
        else if (eq.depth > 30) depthCounts['Orta']++;
        else depthCounts['Yüzeysel']++;
    });

    if (depthChart) depthChart.destroy();
    depthChart = new Chart(document.getElementById('depthChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(depthCounts),
            datasets: [{ data: Object.values(depthCounts), backgroundColor: ['#3498db', '#f39c12', '#e74c3c'] }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Derinlik Dağılımı' } }
        }
    });
}

// Filtreleri uygula
function applyFilters() {
    const magMin = parseFloat(document.getElementById('magMin').value) || 0;
    const magMax = parseFloat(document.getElementById('magMax').value) || 10;
    const depth = document.getElementById('depth').value;
    const dateRange = document.getElementById('dateRange').value;
    const region = document.getElementById('region').value.toLowerCase();

    filteredEarthquakes = allEarthquakes.filter(eq => {
        let passes = eq.magnitude >= magMin && eq.magnitude <= magMax;

        if (depth) {
            if (depth === 'shallow') passes = passes && eq.depth <= 30;
            else if (depth === 'medium') passes = passes && eq.depth > 30 && eq.depth <= 60;
            else if (depth === 'deep') passes = passes && eq.depth > 60;
        }

        if (dateRange) {
            const [startDate, endDate] = dateRange.split(' to ');
            const eqDate = new Date(eq.date);
            passes = passes && eqDate >= new Date(startDate) && eqDate <= new Date(endDate || startDate);
        }

        if (region) {
            passes = passes && eq.location.toLowerCase().includes(region);
        }

        return passes;
    });

    updateMap(filteredEarthquakes);
    updateEarthquakeList(filteredEarthquakes);
    if (filteredEarthquakes.length > 0) updateStatistics(filteredEarthquakes);
    updateCharts(filteredEarthquakes);
}

// Deprem detay modalını göster
function showEarthquakeDetails(earthquake) {
    const modal = new bootstrap.Modal(document.getElementById('earthquakeModal'));

    document.getElementById('earthquakeDetails').innerHTML = `
        <div class="mb-3">
            <strong>Konum:</strong> ${earthquake.location}<br>
            <strong>Büyüklük:</strong> ${earthquake.magnitude.toFixed(1)}<br>
            <strong>Derinlik:</strong> ${earthquake.depth.toFixed(1)} km<br>
            <strong>Tarih:</strong> ${earthquake.date}<br>
            <strong>Saat:</strong> ${earthquake.time}
        </div>
        <div class="mb-3">
            <a href="http://www.koeri.boun.edu.tr/scripts/lst1.asp" target="_blank" class="btn btn-sm btn-outline-primary">
                Kandilli Rasathanesi
            </a>
            <a href="https://deprem.afad.gov.tr/" target="_blank" class="btn btn-sm btn-outline-primary ms-2">
                AFAD
            </a>
        </div>
    `;

    const recentEarthquakes = allEarthquakes.filter(eq =>
        Math.abs(eq.latitude - earthquake.latitude) < 0.5 &&
        Math.abs(eq.longitude - earthquake.longitude) < 0.5
    ).slice(0, 10);

    if (historyChart) historyChart.destroy();
    historyChart = new Chart(document.getElementById('historyChart'), {
        type: 'line',
        data: {
            labels: recentEarthquakes.map(eq => eq.date),
            datasets: [{ label: 'Büyüklük', data: recentEarthquakes.map(eq => eq.magnitude), borderColor: '#3498db', tension: 0.1 }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Bölgedeki Son Depremler' } }
        }
    });

    modal.show();
}

// Haritayı güncelle
function updateMap(earthquakes) {
    Object.values(markers).forEach(marker => {
        if (marker && marker.remove) marker.remove();
    });
    markers = {};

    earthquakes.forEach(eq => {
        if (!eq || !eq.latitude || !eq.longitude) return;

        const marker = L.circleMarker([eq.latitude, eq.longitude], {
            radius: getMarkerSize(eq.magnitude),
            fillColor: getColor(eq.magnitude),
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(`
            <b>${eq.location}</b><br>
            Büyüklük: ${eq.magnitude.toFixed(1)}<br>
            Derinlik: ${eq.depth.toFixed(1)} km<br>
            Tarih: ${eq.date} ${eq.time}
        `);

        marker.on('click', () => showEarthquakeDetails(eq));

        markers[eq.id] = marker;
        marker.addTo(map);
    });
}

// Deprem listesi güncelleme
function updateEarthquakeList(earthquakes) {
    const listElement = document.getElementById('earthquake-list');
    if (!listElement) return;

    listElement.innerHTML = '';

    earthquakes.forEach(eq => {
        if (!eq || !eq.location) return;

        const item = document.createElement('div');
        item.className = `earthquake-item ${getMagnitudeClass(eq.magnitude)}`;
        item.innerHTML = `
            <h3>${eq.location}</h3>
            <p>Büyüklük: ${eq.magnitude.toFixed(1)}</p>
            <p>Derinlik: ${eq.depth.toFixed(1)} km</p>
            <p>Tarih: ${eq.date} ${eq.time}</p>
        `;

        item.addEventListener('click', () => {
            if (eq.latitude && eq.longitude) {
                map.setView([eq.latitude, eq.longitude], 8);
                if (markers[eq.id]) markers[eq.id].openPopup();
                showEarthquakeDetails(eq);
            }
        });

        listElement.appendChild(item);
    });
}

// Event listener'ları ekle
document.getElementById('applyFilters').addEventListener('click', applyFilters);

// Bildirim izni isteme
if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
}
