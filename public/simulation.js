/**
 * RAPIDO CLONE - SIMULATION LAYER
 * Location presets, distance/ETA calculations, routing, nearby-driver generation.
 * No hardcoded user data — all user context lives in app.js state.
 */

// ── Location presets (Jamshedpur / Telco Colony) ─────────────────────────────

const LOCATION_PRESETS = [
    { name: "Telco Colony",                    lat: 22.7735, lng: 86.2505, address: "Telco Colony, Jamshedpur, Jharkhand 831004" },
    { name: "Telco Club & Sports Complex",     lat: 22.7780, lng: 86.2520, address: "Telco Club, Jamshedpur, Jharkhand 831004" },
    { name: "Hudco Lake",                      lat: 22.7668, lng: 86.2492, address: "Govindpur Road, Telco Colony, Jamshedpur 831004" },
    { name: "Plaza Market Telco",              lat: 22.7752, lng: 86.2468, address: "Telco Town, Jamshedpur 831004" },
    { name: "Tatanagar Railway Station",       lat: 22.7698, lng: 86.2028, address: "Station Road, Parsudih, Jamshedpur 831002" },
    { name: "Bistupur Market",                 lat: 22.8015, lng: 86.1798, address: "Main Road, Bistupur, Jamshedpur 831001" },
    { name: "Sakchi Roundabout",               lat: 22.8022, lng: 86.2025, address: "Sakchi Main Road, Jamshedpur 831001" },
    { name: "Jubilee Park Main Gate",          lat: 22.8080, lng: 86.1955, address: "Jubilee Park Road, Sakchi, Jamshedpur 831001" },
    { name: "Golmuri Chowk",                   lat: 22.7885, lng: 86.2162, address: "Golmuri Road, Jamshedpur 831003" },
    { name: "XLRI Campus",                     lat: 22.8018, lng: 86.1852, address: "Rivers Meet Road, Jamshedpur 831001" },
    { name: "P&M Hi-Tech City Centre Mall",    lat: 22.8105, lng: 86.1620, address: "Outer Circle Road, Bistupur, Jamshedpur 831001" },
    { name: "Sonari Airport",                  lat: 22.8152, lng: 86.1685, address: "Airport Road, Sonari, Jamshedpur 831011" },
    { name: "Kadma Market",                    lat: 22.7952, lng: 86.1582, address: "Main Road, Kadma, Jamshedpur 831005" },
    { name: "Adityapur Industrial Area",       lat: 22.7835, lng: 86.1420, address: "Tata Kandra Road, Adityapur, Jamshedpur 831013" },
    { name: "Keenan Stadium",                  lat: 22.8042, lng: 86.1982, address: "Northern Town, Sakchi, Jamshedpur 831001" },
    { name: "Tata Main Hospital (TMH)",        lat: 22.7995, lng: 86.1895, address: "Inner Circle Road, Bistupur, Jamshedpur 831001" },
    { name: "Bhalubasa Bridge",                lat: 22.8068, lng: 86.2205, address: "Bhalubasa Main Road, Jamshedpur 831009" },
    { name: "Baridih Market",                  lat: 22.7925, lng: 86.2458, address: "Baridih Chowk, Jamshedpur 831017" },
    { name: "Sidhgora Town Hall",              lat: 22.7988, lng: 86.2345, address: "Sidhgora Road, Jamshedpur 831009" },
    { name: "Mango Chowk",                     lat: 22.8222, lng: 86.2095, address: "Purulia Road, Mango, Jamshedpur 831012" },
    { name: "Dimna Lake Resort",               lat: 22.8525, lng: 86.2305, address: "Dimna Road, Mirzadih, Jamshedpur 831018" },
    { name: "Loyola School Ground",            lat: 22.8002, lng: 86.1915, address: "Straight Mile Road, Beldih, Jamshedpur 831001" },
    { name: "G-Town Club",                     lat: 22.7968, lng: 86.1822, address: "Road No 4, Bistupur, Jamshedpur 831001" },
    { name: "Regal Ground",                    lat: 22.8032, lng: 86.1802, address: "Regal Circle, Bistupur, Jamshedpur 831001" },
    { name: "Marine Drive Promenade",          lat: 22.8188, lng: 86.1552, address: "Marine Drive Road, Sonari, Jamshedpur 831011" },
    { name: "Govindpur Chowk",                 lat: 22.7552, lng: 86.2758, address: "Hata-Jamshedpur Highway, Govindpur 831015" },
    { name: "Parsudih Market",                 lat: 22.7522, lng: 86.2085, address: "Haludbani Main Road, Parsudih, Jamshedpur 831002" },
    { name: "Sundarnagar Chowk",               lat: 22.7305, lng: 86.2125, address: "Sundarnagar Road, Jamshedpur 831002" },
    { name: "Karandih Chowk",                  lat: 22.7482, lng: 86.2065, address: "Tata-Chaibasa Road, Karandih, Jamshedpur 831002" },
    { name: "Beldih Club",                     lat: 22.8005, lng: 86.1870, address: "Beldih Triangle, Northern Town, Jamshedpur 831001" },
    { name: "Circuit House Area",              lat: 22.8048, lng: 86.1805, address: "Circuit House Road, Bistupur, Jamshedpur 831001" },
    { name: "Gopal Maidan",                    lat: 22.8010, lng: 86.1835, address: "Bistupur Main Road, Jamshedpur 831001" },
    { name: "Tata Steel Zoological Park",      lat: 22.8095, lng: 86.1985, address: "Jubilee Park Road, Sakchi, Jamshedpur 831001" },
    { name: "Dalma Wildlife Sanctuary Gate",   lat: 22.8750, lng: 86.2180, address: "National Highway 33, Mango, Jamshedpur 831012" },
    { name: "NML (National Metallurgical Lab)", lat: 22.7938, lng: 86.2090, address: "Burmamines Main Road, Jamshedpur 831007" },
    { name: "Burmamines Market",               lat: 22.7915, lng: 86.2135, address: "Station Road, Burmamines, Jamshedpur 831007" },
    { name: "Bhuvaneshwari Temple (Telco)",    lat: 22.7635, lng: 86.2625, address: "Bhuvaneshwari Temple Road, Telco Colony 831004" },
    { name: "Kharangajhar Market",             lat: 22.7715, lng: 86.2585, address: "Telco Main Road, Kharangajhar, Jamshedpur 831004" },
    { name: "Vikas Vidyalaya Ground",          lat: 22.7760, lng: 86.2645, address: "Hill Top Road, Telco Colony, Jamshedpur 831004" },
    { name: "Telco Gurudwara",                 lat: 22.7745, lng: 86.2545, address: "Plaza Market Road, Telco Colony, Jamshedpur 831004" },
    { name: "ISWP Sports Ground",              lat: 22.7845, lng: 86.2365, address: "Telco Road, Jamshedpur 831004" },
    { name: "Jamshedpur Public School (JPS)",  lat: 22.7910, lng: 86.2485, address: "Baridih Main Road, Jamshedpur 831017" },
    { name: "Govindpur Railway Overbridge",    lat: 22.7610, lng: 86.2795, address: "Govindpur Road, Jamshedpur 831015" },
    { name: "Dhatkidih Community Centre",      lat: 22.7985, lng: 86.1730, address: "Dhatkidih Main Road, Jamshedpur 831001" },
    { name: "Sonari Ram Mandir",               lat: 22.8122, lng: 86.1645, address: "Ram Mandir Road, Sonari, Jamshedpur 831011" },
    { name: "Chhaya Nagar",                    lat: 22.8255, lng: 86.1995, address: "Mango Bridge Link Road, Jamshedpur 831012" },
    { name: "Karim City College",              lat: 22.8008, lng: 86.2045, address: "Mango Road, Sakchi, Jamshedpur 831001" },
    { name: "Jamshedpur Eye Hospital",         lat: 22.8038, lng: 86.2005, address: "Sakchi Main Road, Jamshedpur 831001" },
    { name: "Sabuj Kalyan Sangha",             lat: 22.7792, lng: 86.2485, address: "Telco Town, Jamshedpur 831004" },
    { name: "Jamshedpur Co-operative College", lat: 22.8090, lng: 86.1890, address: "College Road, Jamshedpur 831001" }
];

// ── Simulated captain pool (visual simulation only; real driver assigned by API) ─

const CAPTAINS_POOL = [
    { name: "Ramesh Kumar",  avatar: "🧑", rating: "4.8", rides: 1420, plate: "JH 05 AB 1234", model: "Honda Activa 6G (Yellow)" },
    { name: "Satish Gowda",  avatar: "👨", rating: "4.9", rides: 2310, plate: "JH 05 CD 5678", model: "Suzuki Access 125 (Black)" },
    { name: "Amit Sharma",   avatar: "👦", rating: "4.7", rides: 890,  plate: "JH 05 EF 9012", model: "TVS Jupiter (Grey)" },
    { name: "Vikram Singh",  avatar: "🧔", rating: "4.9", rides: 3150, plate: "JH 05 GH 3456", model: "Bajaj Pulsar 150 (Red)" },
    { name: "Priya Mehta",   avatar: "👩", rating: "5.0", rides: 640,  plate: "JH 05 IJ 7890", model: "Honda Activa (Pink)" }
];

// ── Vehicle definitions (used to build the ride-option cards) ─────────────────

const VEHICLE_TYPES = [
    { key: "bike",        label: "Rapido Bike",   sub: "Fastest, avoid traffic",           cssClass: "bike-img" },
    { key: "scooty",      label: "Scooty",         sub: "Convenient solo rides",            cssClass: "scooty-img" },
    { key: "auto",        label: "Auto",           sub: "Pocket-friendly open-air",         cssClass: "auto-img" },
    { key: "bike-pink",   label: "Pink Bike",      sub: "Safe solo rides for women",        cssClass: "bike-pink-img" },
    { key: "cab-economy", label: "Cab Economy",    sub: "Affordable daily commutes",        cssClass: "cab-economy-img" },
    { key: "cab-premium", label: "Cab Premium",    sub: "Luxury sedans, top-rated captains",cssClass: "cab-premium-img" }
];

// ── Distance & pricing ────────────────────────────────────────────────────────

/**
 * Haversine formula — returns straight-line distance in km.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Calculates fares and ETAs for all vehicle types given a distance (km).
 */
function calculatePrices(distance) {
    const prices = {
        bike:        Math.max(25,  Math.round(15  + distance * 12)),
        scooty:      Math.max(28,  Math.round(18  + distance * 13)),
        auto:        Math.max(45,  Math.round(30  + distance * 18)),
        'bike-pink': Math.max(25,  Math.round(15  + distance * 12)),
        'cab-economy': Math.max(90, Math.round(60 + distance * 25)),
        'cab-premium': Math.max(150, Math.round(100 + distance * 38))
    };
    const etas = {
        bike:        Math.max(2, Math.round(2 + distance * 1.5)),
        scooty:      Math.max(2, Math.round(2 + distance * 1.6)),
        auto:        Math.max(4, Math.round(3 + distance * 2.0)),
        'bike-pink': Math.max(3, Math.round(3 + distance * 1.6)),
        'cab-economy': Math.max(6, Math.round(5 + distance * 2.5)),
        'cab-premium': Math.max(5, Math.round(4 + distance * 2.4))
    };
    return { prices, etas };
}

// ── Autocomplete search ───────────────────────────────────────────────────────

function searchPresetLocations(query) {
    if (!query || query.trim() === '') return LOCATION_PRESETS;
    const q = query.toLowerCase();
    return LOCATION_PRESETS.filter(l =>
        l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    );
}

// ── Route generation ──────────────────────────────────────────────────────────

/**
 * Returns an array of {lat, lng} points forming a curved path (quadratic Bezier).
 */
function generateRoutePoints(start, end, stepsCount = 100) {
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    const latOffset = (end.lng - start.lng) * 0.15;
    const lngOffset = -(end.lat - start.lat) * 0.15;
    const control = { lat: midLat + latOffset, lng: midLng + lngOffset };
    const points = [];
    for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        points.push({
            lat: (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * control.lat + t * t * end.lat,
            lng: (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * control.lng + t * t * end.lng
        });
    }
    return points;
}

// ── Nearby driver generation ──────────────────────────────────────────────────

function generateNearbyDrivers(centerLat, centerLng, count = 5) {
    const types = ['bike', 'auto', 'cab'];
    return Array.from({ length: count }, (_, i) => ({
        id: `driver-${i}-${Date.now()}`,
        type: types[i % 3],
        lat: centerLat + (Math.random() - 0.5) * 0.015,
        lng: centerLng + (Math.random() - 0.5) * 0.015
    }));
}
