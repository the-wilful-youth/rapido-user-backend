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
            // Bias coordinates to current map center and increase scale to prioritize local results
            biasParams = `&lat=${center.lat}&lon=${center.lng}&location_bias_scale=2.5`;
        }

        // Query Photon Geocoding API (powered by OSM and elasticsearch, very fast, no rate blocks)
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&countrycode=in${biasParams}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Photon geocoding failed");
        const data = await response.json();
        
        if (data && data.features && data.features.length > 0) {
            return data.features.map(f => {
                const props = f.properties;
                const name = props.name || props.street || props.locality || props.city || "Location";
                
                // Build a descriptive, structured address list
                const addrParts = [];
                if (props.street && props.street !== name) addrParts.push(props.street);
                if (props.locality && props.locality !== name) addrParts.push(props.locality);
                if (props.district) addrParts.push(props.district);
                if (props.city && props.city !== name) addrParts.push(props.city);
                if (props.state) addrParts.push(props.state);
                if (props.postcode) addrParts.push(props.postcode);
                
                const address = addrParts.filter(Boolean).join(', ') || props.country || "India";
                
                return {
                    name: name,
                    lat: f.geometry.coordinates[1],
                    lng: f.geometry.coordinates[0],
                    address: address
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
        const points = coords.map(c => ({ lat: c[1], lng: c[0] }));
        points.distance = data.routes[0].distance / 1000; // km
        points.duration = data.routes[0].duration / 60; // minutes
        return points;
    } catch (e) {
        console.warn("OSRM API failed, falling back to simulated Bezier route.", e);
        const points = generateRoutePoints(start, end, 60);
        points.distance = calculateDistance(start.lat, start.lng, end.lat, end.lng) * 1.25;
        points.duration = Math.max(2, points.distance * 2);
        return points;
    }
}

/**
 * Calculates bearing between two coordinates in degrees.
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = deg2rad(lon2 - lon1);
    const lat1Rad = deg2rad(lat1);
    const lat2Rad = deg2rad(lat2);
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x);
    return (brng * 180 / Math.PI + 360) % 360;
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
 * Snaps a coordinate to the nearest drivable road using OSRM Nearest API.
 */
async function snapToNearestRoad(lat, lng) {
    try {
        const url = `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("OSRM nearest snap failed");
        const data = await response.json();
        if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
            const roadLoc = data.waypoints[0].location; // [lng, lat]
            return { lat: roadLoc[1], lng: roadLoc[0], name: data.waypoints[0].name };
        }
    } catch (e) {
        console.warn("OSRM nearest snap failed, using original point.", e);
    }
    return { lat, lng, name: "" };
}

/**
 * Reverse geocodes coordinates to a location name and address using Photon API.
 */
async function reverseGeocode(lat, lng) {
    // Snap to nearest drivable road first for maximum precision
    const snapped = await snapToNearestRoad(lat, lng);
    const queryLat = snapped.lat;
    const queryLng = snapped.lng;

    try {
        const url = `https://photon.komoot.io/reverse?lat=${queryLat}&lon=${queryLng}`;
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
                lat: queryLat,
                lng: queryLng
            };
        }
    } catch (e) {
        console.warn("Reverse geocoding failed, using coordinates fallback.", e);
    }
    return {
        name: "Pinned Location",
        address: `${queryLat.toFixed(4)}, ${queryLng.toFixed(4)}`,
        lat: queryLat,
        lng: queryLng
    };
}
