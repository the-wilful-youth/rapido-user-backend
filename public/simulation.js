/**
 * RAPIDO CLONE - SIMULATION LAYER
 * Location presets, distance/ETA calculations, routing, nearby-driver generation.
 * No hardcoded user data — all user context lives in app.js state.
 */

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

// ── Autocomplete search (Nominatim Geocoding API + Presets Fallback) ─────────

async function searchPresetLocations(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }
    const q = query.trim();
    try {
        let biasParams = "";
        if (window.state && window.state.map) {
            const center = window.state.map.getCenter();
            // Bias coordinates to current map center
            biasParams = `&lat=${center.lat}&lon=${center.lng}`;
        }

        // Query Photon Geocoding API (powered by OSM and elasticsearch, very fast, no rate blocks)
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&filter=countrycode:in${biasParams}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Photon geocoding failed");
        const data = await response.json();
        
        if (data && data.features && data.features.length > 0) {
            return data.features.map(f => {
                const props = f.properties;
                const city = props.city || props.town || props.state || "";
                const street = props.street || props.name || "";
                const dispName = [street, props.district, city].filter(Boolean).join(', ');
                return {
                    name: props.name || street || city || "Location",
                    lat: f.geometry.coordinates[1],
                    lng: f.geometry.coordinates[0],
                    address: dispName || props.state || "India"
                };
            });
        }
    } catch (e) {
        console.warn("Photon Geocoding API request failed.", e);
    }
    return [];
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

/**
 * Fetches real road route geometry from OSRM Demo API.
 * Falls back to generateRoutePoints if OSRM is offline or fails.
 */
async function fetchRoutePoints(start, end) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("OSRM routing failed");
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error("No route found in OSRM");
        }
        // Extract coordinate arrays [lng, lat] and map to {lat, lng}
        const coords = data.routes[0].geometry.coordinates;
        return coords.map(c => ({ lat: c[1], lng: c[0] }));
    } catch (e) {
        console.warn("OSRM API failed, falling back to simulated Bezier route.", e);
        return generateRoutePoints(start, end, 60);
    }
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

/**
 * Reverse geocodes coordinates to a location name and address using Photon API.
 */
async function reverseGeocode(lat, lng) {
    try {
        const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Reverse geocoding failed");
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
            const f = data.features[0];
            const props = f.properties;
            const city = props.city || props.town || props.state || "";
            const street = props.street || props.name || "";
            const dispName = [street, props.district, city].filter(Boolean).join(', ');
            return {
                name: props.name || street || city || "Pinned Location",
                address: dispName || props.state || "India",
                lat: lat,
                lng: lng
            };
        }
    } catch (e) {
        console.warn("Reverse geocoding failed, using coordinates fallback.", e);
    }
    return {
        name: "Pinned Location",
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat: lat,
        lng: lng
    };
}
