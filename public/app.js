/**
 * RAPIDO CLONE - APPLICATION LOGIC
 * All user-facing events wired to the PHP API.
 * No hardcoded user data — everything flows from API responses or user input.
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        user: { id: null, name: '', phone: '', email: '', homeAddress: '', workAddress: '' },
        booking: {
            pickup: null, dropoff: null, vehicle: null,
            fares: {}, etas: {}, distance: 0,
            rideId: null, captainName: null, fare: 0, paymentMethod: 'cash',
            realDriver: null
        },
        csrfToken: '',
        countryCode: '+91',
        map: null,
        markers: { pickup: null, dropoff: null, nearbyDrivers: [], activeDriver: null },
        routePolyline: null,
        activeSearchInput: null,
        simulationInterval: null,
        statusPollInterval: null
    };
    window.state = state;

    const sessionRides    = [];
    const sessionPayments = [];

    // Bootstrap: fetch CSRF token and country config before anything else
    async function bootstrap() {
        const csrfJson = await fetch('../user/csrf.php', { credentials: 'same-origin' })
            .then(r => r.json()).catch(() => null);
        if (csrfJson && csrfJson.csrf_token) {
            state.csrfToken = csrfJson.csrf_token;
        }
        // Read country code from meta tag if provided, otherwise default to +91
        const meta = document.querySelector('meta[name="country-code"]');
        if (meta) state.countryCode = meta.content;
        // Sync country code display in auth forms
        document.getElementById('reg-country-code').textContent   = state.countryCode;
        document.getElementById('login-country-code').textContent = state.countryCode;

        // Auto-recover session if user is logged in
        if (csrfJson && csrfJson.user) {
            const userPayload = {
                user_id: csrfJson.user.user_id,
                name: csrfJson.user.name,
                email: csrfJson.user.email,
                csrf_token: csrfJson.csrf_token
            };
            // Remove country code from start of mobile string to get raw local phone
            let rawPhone = csrfJson.user.mobile;
            if (rawPhone.startsWith(state.countryCode)) {
                rawPhone = rawPhone.substring(state.countryCode.length);
            }
            onLoginSuccess(userPayload, rawPhone);
        }
    }

    bootstrap();

    // =========================================================================
    // UTILITIES
    // =========================================================================

    async function apiPost(url, data) {
        const payload = Object.assign({}, data, { csrf_token: state.csrfToken });
        const res = await fetch(url, {
            method: 'POST',
            body: new URLSearchParams(payload),
            credentials: 'same-origin'
        });
        const json = await res.json();
        // If server regenerated the token (e.g. after login), cache the new one
        if (json && json.csrf_token) state.csrfToken = json.csrf_token;
        return json;
    }

    async function apiGet(url) {
        const res = await fetch(url, { credentials: 'same-origin' });
        return res.json();
    }

    function switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    function showPanel(id) {
        document.querySelectorAll('.booking-panel').forEach(p => p.classList.remove('active-panel'));
        document.getElementById(id).classList.add('active-panel');
    }

    function showError(elId, msg) {
        const el = document.getElementById(elId);
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function hideError(elId) {
        document.getElementById(elId).classList.add('hidden');
    }

    function refreshIcons() {
        if (window.lucide) lucide.createIcons();
    }

    // =========================================================================
    // AUTH
    // =========================================================================

    document.getElementById('btn-welcome-get-started').addEventListener('click', () => switchScreen('screen-register'));
    document.getElementById('btn-welcome-login').addEventListener('click', () => switchScreen('screen-login'));
    document.getElementById('btn-back-to-welcome-from-register').addEventListener('click', () => switchScreen('screen-welcome'));
    document.getElementById('btn-back-to-welcome-from-login').addEventListener('click', () => switchScreen('screen-welcome'));
    document.getElementById('link-to-login').addEventListener('click', e => { e.preventDefault(); switchScreen('screen-login'); });
    document.getElementById('link-to-register').addEventListener('click', e => { e.preventDefault(); switchScreen('screen-register'); });

    document.getElementById('btn-register').addEventListener('click', async () => {
        hideError('reg-error');
        const name     = document.getElementById('reg-name').value.trim();
        const rawPhone = document.getElementById('reg-mobile').value.trim();
        const mobile   = state.countryCode + rawPhone;
        const email    = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        const btn = document.getElementById('btn-register');
        btn.disabled = true; btn.textContent = 'Creating account...';

        const json = await apiPost('../user/register.php', { name, mobile, email, password }).catch(() => null);
        btn.disabled = false; btn.textContent = 'Create Account';

        if (!json) { showError('reg-error', 'Network error. Please try again.'); return; }
        if (!json.success) {
            showError('reg-error', json.errors ? json.errors.join(' ') : (json.message || 'Registration failed.'));
            return;
        }

        const loginJson = await apiPost('../user/login.php', { mobile, password }).catch(() => null);
        if (loginJson && loginJson.success) {
            onLoginSuccess(loginJson, rawPhone);
        } else {
            switchScreen('screen-login');
        }
    });

    document.getElementById('btn-login').addEventListener('click', async () => {
        hideError('login-error');
        const rawPhone = document.getElementById('login-mobile').value.trim();
        const mobile   = state.countryCode + rawPhone;
        const password = document.getElementById('login-password').value;

        const btn = document.getElementById('btn-login');
        btn.disabled = true; btn.textContent = 'Signing in...';

        const json = await apiPost('../user/login.php', { mobile, password }).catch(() => null);
        btn.disabled = false; btn.textContent = 'Sign In';

        if (!json) { showError('login-error', 'Network error. Please try again.'); return; }
        if (!json.success) { showError('login-error', json.message || 'Invalid credentials.'); return; }

        onLoginSuccess(json, rawPhone);
    });

    function onLoginSuccess(json, rawPhone) {
        state.user.id    = json.user_id;
        state.user.name  = json.name;
        state.user.phone = rawPhone;
        state.user.email = json.email || '';
        if (json.csrf_token) state.csrfToken = json.csrf_token;

        document.getElementById('sidebar-user-name').textContent = state.user.name;
        document.getElementById('sidebar-user-phone').textContent = state.countryCode + ' ' + state.user.phone;
        document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0).toUpperCase();
        document.getElementById('profile-name').value  = state.user.name;
        document.getElementById('profile-phone').value = state.countryCode + ' ' + state.user.phone;
        document.getElementById('profile-email').value = state.user.email;

        // Explicitly set panel visibility and active sidebar navigation states
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        const dashboardBtn = document.querySelector('.menu-item[data-target="dashboard"]');
        if (dashboardBtn) dashboardBtn.classList.add('active');
        showPanel('panel-booking');

        switchScreen('screen-app');
        initLeafletMap();
    }

    document.getElementById('btn-logout').addEventListener('click', async () => {
        clearInterval(state.statusPollInterval);
        clearInterval(state.simulationInterval);
        await apiPost('../user/logout.php', {}).catch(() => null);
        window.location.reload();
    });

    // =========================================================================
    // SIDEBAR NAV
    // =========================================================================

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            if (target === 'dashboard') {
                showPanel('panel-booking');
            } else {
                showPanel('panel-' + target);
            }
            if (target === 'history') renderHistoryList();
            if (target === 'wallet')  renderWalletPanel();
            if (window.innerWidth <= 900) document.querySelector('.sidebar').classList.remove('open');
        });
    });

    document.querySelectorAll('.btn-close-subpanel').forEach(btn => {
        btn.addEventListener('click', () => {
            showPanel('panel-booking');
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            document.querySelector('.menu-item[data-target="dashboard"]').classList.add('active');
        });
    });

    document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    // =========================================================================
    // MAP
    // =========================================================================

    function initLeafletMap() {
        if (state.map) return;

        // Default fallback: New Delhi center
        const defaultLoc = { name: "New Delhi", lat: 28.6139, lng: 77.2090, address: "New Delhi, Delhi, India" };
        state.booking.pickup = defaultLoc;
        document.getElementById('input-pickup').value = defaultLoc.name;

        // Ensure global state maps bindings are accessible immediately
        window.state = state;

        state.map = L.map('leaflet-map-container', { zoomControl: false, attributionControl: false })
            .setView([defaultLoc.lat, defaultLoc.lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.map);
        L.control.zoom({ position: 'bottomright' }).addTo(state.map);

        // Render initial marker and nearby drivers immediately
        updatePickupMarker();
        renderNearbyDrivers();

        // Force Leaflet to recalculate container bounds (resolves gray map tiles inside layouts)
        setTimeout(() => {
            if (state.map) state.map.invalidateSize();
        }, 300);

        // Request browser geolocation to center on user's real state/city
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    
                    // Reverse geocode user location using free Nominatim API to get location name
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`, {
                        headers: {
                            'User-Agent': 'QwikkBikeTaxiApp/1.0 (anurag@qwikk.co)',
                            'Accept-Language': 'en-US,en;q=0.9'
                        }
                    })
                        .then(res => res.json())
                        .then(data => {
                            const name = data.address.suburb || data.address.neighbourhood || data.address.city || "My Location";
                            const addr = data.display_name;
                            
                            state.booking.pickup = { name: name, lat: userLat, lng: userLng, address: addr };
                            document.getElementById('input-pickup').value = name;
                            
                            state.map.setView([userLat, userLng], 14);
                            updatePickupMarker();
                            renderNearbyDrivers();
                        })
                        .catch(() => {
                            // Fallback to coordinates only if geocoding fails
                            state.booking.pickup = { name: "Current Location", lat: userLat, lng: userLng, address: `${userLat}, ${userLng}` };
                            document.getElementById('input-pickup').value = "Current Location";
                            state.map.setView([userLat, userLng], 14);
                            updatePickupMarker();
                            renderNearbyDrivers();
                        });
                },
                (error) => {
                    console.warn("Geolocation permission denied or failed. Defaulting to India capital.", error);
                    updatePickupMarker();
                    renderNearbyDrivers();
                }
            );
        } else {
            updatePickupMarker();
            renderNearbyDrivers();
        }

        // Let the user tap/click on the map directly to pinpoint their locations
        state.map.on('click', async (e) => {
            const clickLat = e.latlng.lat;
            const clickLng = e.latlng.lng;
            
            // Reverse geocode the coordinate to get a pretty name
            const locObj = await reverseGeocode(clickLat, clickLng);
            
            // Check which field is active/empty to assign click coordinates
            if (state.activeSearchInput === 'pickup') {
                state.booking.pickup = locObj;
                document.getElementById('input-pickup').value = locObj.name;
                updatePickupMarker();
                renderNearbyDrivers();
            } else if (state.activeSearchInput === 'dropoff') {
                state.booking.dropoff = locObj;
                document.getElementById('input-dropoff').value = locObj.name;
                updateDropoffMarker();
                showVehiclePicker();
            } else {
                // Fallback context: if none is active, set the first empty one
                if (!state.booking.pickup) {
                    state.booking.pickup = locObj;
                    document.getElementById('input-pickup').value = locObj.name;
                    updatePickupMarker();
                    renderNearbyDrivers();
                } else {
                    state.booking.dropoff = locObj;
                    document.getElementById('input-dropoff').value = locObj.name;
                    updateDropoffMarker();
                    showVehiclePicker();
                }
            }
        });

        setInterval(animateNearbyDrivers, 4000);
        refreshIcons();
    }

    function pinIcon(extraClass) {
        return L.divIcon({
            html: `<div class="location-marker-pin ${extraClass}"></div>`,
            className: 'custom-div-icon',
            iconSize: [30, 42], iconAnchor: [15, 42]
        });
    }

    function updatePickupMarker() {
        if (!state.map) return;
        if (state.markers.pickup) {
            state.map.removeLayer(state.markers.pickup);
            state.markers.pickup = null;
        }
        if (!state.booking.pickup) {
            if (state.routePolyline) {
                state.map.removeLayer(state.routePolyline);
                state.routePolyline = null;
            }
            return;
        }
        state.markers.pickup = L.marker(
            [state.booking.pickup.lat, state.booking.pickup.lng],
            { icon: pinIcon('pickup-pin') }
        ).addTo(state.map).bindPopup('<b>Pickup</b><br>' + state.booking.pickup.name);
        
        const activeLayers = [];
        if (state.markers.pickup) activeLayers.push(state.markers.pickup);
        if (state.markers.dropoff) activeLayers.push(state.markers.dropoff);
        
        if (activeLayers.length > 0) {
            const group = new L.featureGroup(activeLayers);
            state.map.fitBounds(group.getBounds().pad(0.15));
        } else {
            state.map.setView([state.booking.pickup.lat, state.booking.pickup.lng], 14);
        }

        if (state.booking.pickup && state.booking.dropoff) {
            drawRoute();
            showVehiclePicker();
        }
        renderNearbyDrivers();
    }

    function updateDropoffMarker() {
        if (!state.map) return;
        if (state.markers.dropoff) {
            state.map.removeLayer(state.markers.dropoff);
            state.markers.dropoff = null;
        }
        if (!state.booking.dropoff) {
            if (state.routePolyline) {
                state.map.removeLayer(state.routePolyline);
                state.routePolyline = null;
            }
            return;
        }
        state.markers.dropoff = L.marker(
            [state.booking.dropoff.lat, state.booking.dropoff.lng],
            { icon: pinIcon('') }
        ).addTo(state.map).bindPopup('<b>Destination</b><br>' + state.booking.dropoff.name);
        
        const activeLayers = [];
        if (state.markers.pickup) activeLayers.push(state.markers.pickup);
        if (state.markers.dropoff) activeLayers.push(state.markers.dropoff);
        
        if (activeLayers.length > 0) {
            const group = new L.featureGroup(activeLayers);
            state.map.fitBounds(group.getBounds().pad(0.15));
        }
        
        if (state.booking.pickup && state.booking.dropoff) {
            drawRoute();
        }
    }

    async function drawRoute() {
        if (!state.map) return;
        if (state.routePolyline) {
            state.map.removeLayer(state.routePolyline);
            state.routePolyline = null;
        }
        if (!state.booking.pickup || !state.booking.dropoff) return;
        const ptsData = await fetchRoutePoints(state.booking.pickup, state.booking.dropoff);
        const pts = ptsData.map(p => [p.lat, p.lng]);
        state.routePolyline = L.polyline(pts, {
            color: '#1F2229', weight: 5, opacity: 0.8, dashArray: '1, 10', lineCap: 'round'
        }).addTo(state.map);
    }

    function renderNearbyDrivers() {
        if (!state.map) return;
        state.markers.nearbyDrivers.forEach(m => state.map.removeLayer(m));
        state.markers.nearbyDrivers = [];
        const { lat, lng } = state.booking.pickup || { lat: 28.6139, lng: 77.2090 };
        generateNearbyDrivers(lat, lng, 6).forEach(d => {
            const icon = L.divIcon({
                html: `<div class="driver-marker-pulse"><i data-lucide="${d.type === 'bike' ? 'bike' : 'car'}"></i></div>`,
                className: 'map-driver-marker', iconSize: [36, 36], iconAnchor: [18, 18]
            });
            state.markers.nearbyDrivers.push(L.marker([d.lat, d.lng], { icon }).addTo(state.map));
        });
        refreshIcons();
    }

    function animateNearbyDrivers() {
        if (!state.map || state.booking.rideId) return;
        state.markers.nearbyDrivers.forEach(m => {
            const p = m.getLatLng();
            m.setLatLng([p.lat + (Math.random() - 0.5) * 0.003, p.lng + (Math.random() - 0.5) * 0.003]);
        });
    }


    // =========================================================================
    // LOCATION AUTOCOMPLETE
    // =========================================================================

    (function initLocationInputs() {
        const pickupInput  = document.getElementById('input-pickup');
        const dropoffInput = document.getElementById('input-dropoff');
        const suggBox      = document.getElementById('autocomplete-suggestions');

        async function showSuggestions(query) {
            const listData = await searchPresetLocations(query);
            const list = listData.slice(0, 8);
            if (!list.length) { suggBox.classList.add('hidden'); return; }
            suggBox.innerHTML = '';
            list.forEach(item => {
                const row = document.createElement('div');
                row.className = 'suggestion-item';
                row.innerHTML = `<i data-lucide="map-pin"></i>
                    <div class="suggestion-details">
                        <span class="suggestion-name">${item.name}</span>
                        <span class="suggestion-address">${item.address}</span>
                    </div>`;
                row.addEventListener('click', () => selectLocation(item));
                suggBox.appendChild(row);
            });
            suggBox.classList.remove('hidden');
            refreshIcons();
        }

        function selectLocation(item) {
            suggBox.classList.add('hidden');
            if (state.activeSearchInput === 'pickup') {
                pickupInput.value = item.name;
                state.booking.pickup = item;
                updatePickupMarker();
            } else {
                dropoffInput.value = item.name;
                state.booking.dropoff = item;
                updateDropoffMarker();
                showVehiclePicker();
            }
        }

        // Debounce search function to reduce request rate and increase responsiveness
        function debounce(func, delay = 400) {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(null, args);
                }, delay);
            };
        }

        const debouncedShowSuggestions = debounce((val) => showSuggestions(val), 350);

        pickupInput.addEventListener('focus',  () => { state.activeSearchInput = 'pickup'; });
        dropoffInput.addEventListener('focus', () => { state.activeSearchInput = 'dropoff'; });
        pickupInput.addEventListener('input',  e => debouncedShowSuggestions(e.target.value));
        dropoffInput.addEventListener('input', e => debouncedShowSuggestions(e.target.value));

        document.getElementById('clear-pickup').addEventListener('click', () => {
            pickupInput.value = '';
            state.booking.pickup = null;
            suggBox.classList.add('hidden');
            updatePickupMarker();
            document.getElementById('vehicle-picker').classList.add('hidden');
        });
        document.getElementById('clear-dropoff').addEventListener('click', () => {
            dropoffInput.value = '';
            state.booking.dropoff = null;
            suggBox.classList.add('hidden');
            updateDropoffMarker();
            document.getElementById('vehicle-picker').classList.add('hidden');
        });

        document.getElementById('btn-home-shortcut').addEventListener('click', async () => {
            if (!state.user.homeAddress) return;
            state.activeSearchInput = 'dropoff';
            const matches = await searchPresetLocations(state.user.homeAddress);
            if (matches && matches.length > 0) { selectLocation(matches[0]); }
        });
        document.getElementById('btn-work-shortcut').addEventListener('click', async () => {
            if (!state.user.workAddress) return;
            state.activeSearchInput = 'dropoff';
            const matches = await searchPresetLocations(state.user.workAddress);
            if (matches && matches.length > 0) { selectLocation(matches[0]); }
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.location-inputs') && !e.target.closest('#autocomplete-suggestions')) {
                suggBox.classList.add('hidden');
            }
        });
    })();

    // =========================================================================
    // VEHICLE PICKER
    // =========================================================================

    function showVehiclePicker() {
        if (!state.booking.pickup || !state.booking.dropoff) return;
        const dist = calculateDistance(
            state.booking.pickup.lat, state.booking.pickup.lng,
            state.booking.dropoff.lat, state.booking.dropoff.lng
        );
        state.booking.distance = parseFloat(dist.toFixed(2));
        const distEl = document.getElementById('vehicle-picker-distance');
        if (distEl) distEl.textContent = state.booking.distance + " km";

        const { prices, etas } = calculatePrices(dist);
        state.booking.fares = prices;
        state.booking.etas  = etas;

        const container = document.getElementById('ride-options-container');
        container.innerHTML = '';
        VEHICLE_TYPES.forEach((v, i) => {
            const card = document.createElement('div');
            card.className = 'ride-option-card' + (i === 0 ? ' selected' : '');
            card.dataset.vehicle = v.key;
            card.innerHTML = `
                <div class="vehicle-image-placeholder ${v.cssClass}"></div>
                <div class="ride-desc">
                    <span class="ride-title">${v.label}</span>
                    <span class="ride-sub">${v.sub}</span>
                </div>
                <div class="ride-pricing">
                    <span class="ride-price">₹${prices[v.key]}</span>
                    <span class="ride-eta">${etas[v.key]} mins</span>
                </div>`;
            card.addEventListener('click', () => {
                container.querySelectorAll('.ride-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.booking.vehicle = v.key;
            });
            container.appendChild(card);
        });

        state.booking.vehicle = VEHICLE_TYPES[0].key;
        document.getElementById('vehicle-picker').classList.remove('hidden');
    }

    // Booking-panel payment method toggle
    document.getElementById('payment-toggle-btn').addEventListener('click', () => {
        document.getElementById('payment-method-dropdown').classList.toggle('hidden');
    });
    document.querySelectorAll('#payment-method-dropdown .payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.booking.paymentMethod = opt.dataset.method;
            document.getElementById('selected-payment-method').textContent = opt.textContent.trim();
            document.getElementById('payment-method-dropdown').classList.add('hidden');
        });
    });

    // =========================================================================
    // BOOKING & RIDE SIMULATION
    // =========================================================================

    document.getElementById('btn-request-ride').addEventListener('click', async () => {
        if (!state.booking.pickup || !state.booking.dropoff || !state.booking.vehicle) return;

        document.getElementById('matching-pickup').textContent = state.booking.pickup.name;
        document.getElementById('matching-drop').textContent   = state.booking.dropoff.name;
        showPanel('panel-matching');
        state.markers.nearbyDrivers.forEach(m => state.map.removeLayer(m));

        const json = await apiPost('../user/book_ride.php', {
            pickup_location: state.booking.pickup.name + ', ' + state.booking.pickup.address,
            destination:     state.booking.dropoff.name + ', ' + state.booking.dropoff.address
        }).catch(() => null);

        if (!json || !json.success) {
            showPanel('panel-booking');
            renderNearbyDrivers();
            alert(json ? (json.message || 'Booking failed.') : 'Network error.');
            return;
        }

        state.booking.rideId = json.ride_id;
        state.booking.fare   = json.fare;
        document.getElementById('ride-otp').textContent = json.otp;

        // Attempt real driver assignment from DB
        const assignJson = await apiPost('../user/assign_driver.php', { ride_id: json.ride_id }).catch(() => null);
        if (assignJson && assignJson.success) {
            // Real driver found — store for tracking panel
            state.booking.realDriver = assignJson;
        }

        setTimeout(() => {
            if (document.getElementById('panel-matching').classList.contains('active-panel')) {
                startRideSimulation();
            }
        }, 2500);
    });

    document.getElementById('btn-cancel-matching').addEventListener('click', () => {
        showPanel('panel-booking');
        renderNearbyDrivers();
    });

    document.getElementById('btn-cancel-ride').addEventListener('click', () => {
        stopSimulation();
        clearInterval(state.statusPollInterval);
        state.booking.rideId = null;
        document.getElementById('input-dropoff').value = '';
        document.getElementById('vehicle-picker').classList.add('hidden');
        showPanel('panel-booking');
        renderNearbyDrivers();
    });

    function startRideSimulation() {
        const driverIcon = L.divIcon({
            html: '<div class="driver-marker-pulse"><i data-lucide="bike"></i></div>',
            className: 'map-driver-marker', iconSize: [36, 36], iconAnchor: [18, 18]
        });
        const startPos = {
            lat: state.booking.pickup.lat + (Math.random() - 0.5) * 0.01,
            lng: state.booking.pickup.lng + (Math.random() - 0.5) * 0.01
        };
        state.markers.activeDriver = L.marker([startPos.lat, startPos.lng], { icon: driverIcon }).addTo(state.map);
        refreshIcons();

        // Use real DB driver; fall back to placeholder if none assigned
        const rd = state.booking.realDriver;
        const displayName  = rd ? rd.driver_name    : 'Assigned Driver';
        const displayPlate = rd ? rd.vehicle_number : '——';
        state.booking.captainName = displayName;

        document.getElementById('captain-name').textContent       = displayName;
        document.getElementById('captain-rating').textContent     = rd ? 'Verified Driver' : '——';
        document.getElementById('vehicle-plate-num').textContent  = displayPlate;
        document.getElementById('vehicle-model-desc').textContent = '';
        document.getElementById('live-fare').textContent          = '₹' + Math.round(state.booking.fare);
        document.getElementById('ride-status-badge').textContent  = 'Captain Arriving';
        document.getElementById('ride-status-badge').className    = 'status-badge green';
        showPanel('panel-tracking');

        // Advance DB ride: waiting → accepted (also assigns driver if still waiting)
        apiPost('../user/simulation_advance.php', { ride_id: state.booking.rideId, to_status: 'accepted' }).catch(() => null);

        // Phase 1: driver approaches pickup
        fetchRoutePoints(startPos, state.booking.pickup).then(toPickup => {
            let idx = 0;
            state.simulationInterval = setInterval(() => {
                if (idx < toPickup.length) {
                    const p = toPickup[idx++];
                    state.markers.activeDriver.setLatLng([p.lat, p.lng]);
                    const d = calculateDistance(p.lat, p.lng, state.booking.pickup.lat, state.booking.pickup.lng);
                    document.getElementById('live-eta').textContent      = Math.max(1, Math.round(d * 3)) + ' min';
                    document.getElementById('live-distance').textContent = d.toFixed(2) + ' km';
                } else {
                    clearInterval(state.simulationInterval);
                    document.getElementById('ride-status-badge').textContent = 'Arrived at Pickup';
                    document.getElementById('ride-status-badge').className   = 'status-badge warning';
                    document.getElementById('live-eta').textContent      = 'Arrived';
                    document.getElementById('live-distance').textContent = '0.0 km';
                    // Advance DB ride: accepted → driver_arrived
                    apiPost('../user/simulation_advance.php', { ride_id: state.booking.rideId, to_status: 'driver_arrived' }).catch(() => null);
                    setTimeout(startTripPhase, 2500);
                }
            }, 150);
        });

        startStatusPolling(state.booking.rideId);
    }

    function startTripPhase() {
        document.getElementById('ride-status-badge').textContent = 'Ride In Progress';
        document.getElementById('ride-status-badge').className   = 'status-badge green';

        // Advance DB ride: driver_arrived → started
        apiPost('../user/simulation_advance.php', { ride_id: state.booking.rideId, to_status: 'started' }).catch(() => null);

        fetchRoutePoints(state.booking.pickup, state.booking.dropoff).then(toDropoff => {
            let idx = 0;
            state.simulationInterval = setInterval(() => {
                if (idx < toDropoff.length) {
                    const p = toDropoff[idx++];
                    state.markers.activeDriver.setLatLng([p.lat, p.lng]);
                    state.map.setView([p.lat, p.lng]);
                    const d = calculateDistance(p.lat, p.lng, state.booking.dropoff.lat, state.booking.dropoff.lng);
                    document.getElementById('live-eta').textContent      = Math.max(1, Math.round(d * 3)) + ' min';
                    document.getElementById('live-distance').textContent = d.toFixed(1) + ' km';
                } else {
                    clearInterval(state.simulationInterval);
                    // Advance DB ride: started → completed (also frees driver)
                    apiPost('../user/simulation_advance.php', { ride_id: state.booking.rideId, to_status: 'completed' })
                        .catch(() => null)
                        .finally(() => showCompletedPanel());
                }
            }, 150);
        });
    }

    function stopSimulation() {
        clearInterval(state.simulationInterval);
        if (state.markers.activeDriver) { state.map.removeLayer(state.markers.activeDriver); state.markers.activeDriver = null; }
        if (state.markers.dropoff)      { state.map.removeLayer(state.markers.dropoff);      state.markers.dropoff = null; }
        if (state.routePolyline)        { state.map.removeLayer(state.routePolyline);         state.routePolyline = null; }
        state.booking.dropoff = null;
    }

    function startStatusPolling(rideId) {
        const STATUS_LABELS = {
            waiting:        'Finding Captain',
            accepted:       'Captain Arriving',
            driver_arrived: 'Arrived at Pickup',
            started:        'Ride In Progress',
            completed:      'Ride Complete',
        };
        state.statusPollInterval = setInterval(async () => {
            const json = await apiGet('../user/ride_status.php?ride_id=' + rideId).catch(() => null);
            if (!json || !json.success) return;
            if (json.driver_name)    document.getElementById('captain-name').textContent      = json.driver_name;
            if (json.vehicle_number) document.getElementById('vehicle-plate-num').textContent = json.vehicle_number;
            const label = STATUS_LABELS[json.ride_status];
            if (label) {
                document.getElementById('ride-status-badge').textContent = label;
                document.getElementById('ride-status-badge').className =
                    json.ride_status === 'driver_arrived' ? 'status-badge warning' : 'status-badge green';
            }
        }, 5000);
    }

    // =========================================================================
    // COMPLETED PANEL + PAYMENT
    // =========================================================================

    function showCompletedPanel() {
        clearInterval(state.statusPollInterval);
        const fare = Math.round(state.booking.fare);

        document.getElementById('comp-captain-name').textContent  = state.booking.captainName || 'your captain';
        document.getElementById('receipt-fare').textContent       = '₹' + fare;
        document.getElementById('receipt-total').textContent      = '₹' + fare;
        document.getElementById('receipt-pay-method').textContent = 'Payment pending';
        document.getElementById('pay-section').classList.remove('hidden');

        initPaySection(fare);
        showPanel('panel-completed');
        initRatingStars();
    }

    function initPaySection(fare) {
        let selectedMethod = state.booking.paymentMethod || 'cash';
        document.getElementById('pay-selected-method').textContent =
            selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1);

        // Re-attach listeners (panel re-used across rides)
        const toggle = document.getElementById('pay-method-toggle');
        const dropdown = document.getElementById('pay-method-dropdown');
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener('click', () => dropdown.classList.toggle('hidden'));

        document.querySelectorAll('#pay-method-dropdown .payment-option').forEach(opt => {
            const fresh = opt.cloneNode(true);
            opt.parentNode.replaceChild(fresh, opt);
            fresh.addEventListener('click', () => {
                selectedMethod = fresh.dataset.method;
                document.getElementById('pay-selected-method').textContent = fresh.textContent.trim();
                dropdown.classList.add('hidden');
            });
        });

        const payBtn = document.getElementById('btn-pay-ride');
        payBtn.onclick = async () => {
            payBtn.disabled = true; payBtn.textContent = 'Processing...';
            const json = await apiPost('../user/pay_ride.php', {
                ride_id:        state.booking.rideId,
                payment_method: selectedMethod
            }).catch(() => null);
            payBtn.disabled = false; payBtn.textContent = 'Pay Now';

            if (!json || !json.success) {
                alert(json ? (json.message || 'Payment failed.') : 'Network error.');
                return;
            }

            document.getElementById('pay-section').classList.add('hidden');
            document.getElementById('receipt-pay-method').textContent =
                'Paid via ' + selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1);

            // Record for local history & wallet
            const dropoffName = state.booking.dropoff ? state.booking.dropoff.name : 'destination';
            sessionPayments.unshift({ title: 'Ride to ' + dropoffName.split(',')[0], amount: fare, date: 'Today, just now' });
            sessionRides.unshift({
                id:      state.booking.rideId || ('RPD-' + Math.floor(10000 + Math.random() * 90000)),
                date:    'Today, just now',
                vehicle: state.booking.vehicle || 'bike',
                pickup:  state.booking.pickup  ? state.booking.pickup.name  : '',
                dropoff: dropoffName,
                cost:    fare
            });
        };
    }

    // =========================================================================
    // FEEDBACK / RATING
    // =========================================================================

    function initRatingStars() {
        const stars = document.querySelectorAll('.star-rating i');
        let selectedRating = 5;
        stars.forEach(s => s.classList.add('filled'));

        stars.forEach(star => {
            // Remove old listeners by replacing node
            const fresh = star.cloneNode(true);
            star.parentNode.replaceChild(fresh, star);
            fresh.classList.toggle('filled', parseInt(fresh.dataset.index) <= selectedRating);
            fresh.addEventListener('click', () => {
                selectedRating = parseInt(fresh.dataset.index);
                document.querySelectorAll('.star-rating i').forEach(s => {
                    s.classList.toggle('filled', parseInt(s.dataset.index) <= selectedRating);
                });
            });
        });

        document.getElementById('btn-done-rating').onclick = async () => {
            if (state.booking.rideId) {
                const comments = document.getElementById('rating-comment').value.trim();
                await apiPost('../user/submit_feedback.php', {
                    ride_id: state.booking.rideId,
                    rating:  selectedRating,
                    comments
                }).catch(() => null);
            }

            stopSimulation();
            state.booking.rideId = null;
            document.getElementById('input-dropoff').value = '';
            document.getElementById('vehicle-picker').classList.add('hidden');
            document.getElementById('rating-comment').value = '';
            document.getElementById('pay-section').classList.add('hidden');
            showPanel('panel-booking');
            renderNearbyDrivers();
        };
    }

    // =========================================================================
    // RIDE HISTORY
    // =========================================================================

    let historyPage = 1;
    const HISTORY_LIMIT = 10;

    async function renderHistoryList(page = 1) {
        const container = document.getElementById('history-items-container');
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:20px">Loading...</p>';

        const json = await apiGet(`../user/ride_history.php?page=${page}&limit=${HISTORY_LIMIT}`).catch(() => null);

        if (!json || !json.success) {
            // Fallback to session data if API fails (e.g. not logged in via PHP session)
            if (!sessionRides.length) {
                container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:20px">No rides taken yet.</p>';
                return;
            }
            renderHistoryCards(container, sessionRides.map(r => ({
                id: r.id, created_at: r.date,
                pickup_location: r.pickup, destination: r.dropoff,
                fare: r.cost, ride_status: 'completed', payment_status: 'paid',
                driver_name: null, vehicle_number: null
            })), 1, sessionRides.length, HISTORY_LIMIT);
            return;
        }

        historyPage = json.page;
        renderHistoryCards(container, json.rides, json.page, json.total, json.limit);
    }

    function renderHistoryCards(container, rides, page, total, limit) {
        container.innerHTML = '';

        if (!rides.length) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:20px">No rides taken yet.</p>';
            return;
        }

        rides.forEach(item => {
            const statusColor = item.ride_status === 'completed' ? '#065f46' : '#92400e';
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-header">
                    <span>${item.created_at}</span>
                    <span>ID: ${item.id}</span>
                </div>
                <div class="history-card-body">
                    <div class="history-card-details">
                        <div class="history-card-locs">
                            <div>🟢 ${item.pickup_location.split(',')[0]}</div>
                            <div>🔴 ${item.destination.split(',')[0]}</div>
                        </div>
                    </div>
                    <span class="history-card-cost">₹${parseFloat(item.fare).toFixed(0)}</span>
                </div>
                <div class="history-card-footer">
                    <span class="vehicle-badge" style="color:${statusColor}">${item.ride_status}</span>
                    ${item.driver_name ? `<span style="font-size:0.8rem;color:var(--text-light)">👤 ${item.driver_name}</span>` : ''}
                    <span class="vehicle-badge">${item.payment_status}</span>
                </div>`;
            container.appendChild(card);
        });

        // Pagination
        const totalPages = Math.ceil(total / limit);
        if (totalPages > 1) {
            const nav = document.createElement('div');
            nav.style.cssText = 'display:flex;justify-content:space-between;margin-top:12px;gap:8px';
            nav.innerHTML = `
                <button class="btn-secondary" id="hist-prev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
                <span style="align-self:center;font-size:0.85rem;color:var(--text-light)">${page} / ${totalPages}</span>
                <button class="btn-secondary" id="hist-next" ${page >= totalPages ? 'disabled' : ''}>Next →</button>`;
            container.appendChild(nav);
            nav.querySelector('#hist-prev')?.addEventListener('click', () => renderHistoryList(page - 1));
            nav.querySelector('#hist-next')?.addEventListener('click', () => renderHistoryList(page + 1));
        }
    }

    // =========================================================================
    // WALLET
    // =========================================================================

    async function renderWalletPanel() {
        const container = document.getElementById('transaction-list-container');
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:10px">Loading...</p>';

        const json = await apiGet('../user/payment_history.php?limit=20').catch(() => null);

        if (!json || !json.success) {
            // Fallback to session data
            if (!sessionPayments.length) {
                container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:10px">No payments yet.</p>';
                document.getElementById('wallet-total-spent').textContent = '₹0';
                return;
            }
            const total = sessionPayments.reduce((sum, p) => sum + p.amount, 0);
            document.getElementById('wallet-total-spent').textContent = '₹' + total;
            container.innerHTML = '';
            sessionPayments.forEach(p => {
                const el = document.createElement('div');
                el.className = 'transaction-item';
                el.innerHTML = `
                    <div class="txn-desc">
                        <span class="txn-title">${p.title}</span>
                        <span class="txn-time">${p.date}</span>
                    </div>
                    <span class="txn-amt negative">- ₹${p.amount}</span>`;
                container.appendChild(el);
            });
            return;
        }

        document.getElementById('wallet-total-spent').textContent = '₹' + parseFloat(json.total_spent).toFixed(0);
        container.innerHTML = '';

        if (!json.payments.length) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-light);margin-top:10px">No payments yet.</p>';
            return;
        }

        json.payments.forEach(p => {
            const el = document.createElement('div');
            el.className = 'transaction-item';
            el.innerHTML = `
                <div class="txn-desc">
                    <span class="txn-title">Ride to ${p.destination.split(',')[0]}</span>
                    <span class="txn-time">${p.paid_at} · ${p.payment_method}</span>
                </div>
                <span class="txn-amt negative">- ₹${parseFloat(p.amount).toFixed(0)}</span>`;
            container.appendChild(el);
        });
    }

    // =========================================================================
    // PROFILE
    // =========================================================================

    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const name  = document.getElementById('profile-name').value.trim()  || state.user.name;
        const email = document.getElementById('profile-email').value.trim();
        state.user.homeAddress = document.getElementById('profile-home-addr').value.trim();
        state.user.workAddress = document.getElementById('profile-work-addr').value.trim();

        const btn = document.getElementById('btn-save-profile');
        btn.disabled = true; btn.textContent = 'Saving...';

        const json = await apiPost('../user/update_profile.php', { name, email }).catch(() => null);

        btn.disabled = false; btn.textContent = 'Save Changes';

        const msg = document.getElementById('profile-save-msg');
        if (!json || !json.success) {
            const errText = json && json.errors ? json.errors.join(' ') : 'Save failed.';
            msg.textContent = errText;
            msg.style.color = 'var(--danger, #dc2626)';
        } else {
            state.user.name  = json.name;
            state.user.email = json.email || '';
            document.getElementById('profile-name').value = json.name;
            document.getElementById('sidebar-user-name').textContent = json.name;
            document.getElementById('sidebar-avatar').textContent    = json.name.charAt(0).toUpperCase();
            msg.textContent = 'Profile saved!';
            msg.style.color = 'var(--success, #059669)';
        }
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2500);
    });

}); // end DOMContentLoaded
