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
            rideId: null, captainName: null, fare: 0, paymentMethod: 'cash'
        },
        map: null,
        markers: { pickup: null, dropoff: null, nearbyDrivers: [], activeDriver: null },
        routePolyline: null,
        activeSearchInput: null,
        simulationInterval: null,
        statusPollInterval: null
    };

    const sessionRides    = [];   // rides completed this session
    const sessionPayments = [];   // payments made this session

    // =========================================================================
    // UTILITIES
    // =========================================================================

    async function apiPost(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            body: new URLSearchParams(data),
            credentials: 'same-origin'
        });
        return res.json();
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
        const mobile   = '+91' + rawPhone;
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

        // Auto-login after successful registration
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
        const mobile   = '+91' + rawPhone;
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

        document.getElementById('sidebar-user-name').textContent = state.user.name;
        document.getElementById('sidebar-user-phone').textContent = '+91 ' + state.user.phone;
        document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0).toUpperCase();
        document.getElementById('profile-name').value  = state.user.name;
        document.getElementById('profile-phone').value = '+91 ' + state.user.phone;

        switchScreen('screen-app');
        initLeafletMap();
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        clearInterval(state.statusPollInterval);
        clearInterval(state.simulationInterval);
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
            showPanel('panel-' + target);
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

        const defaultLoc = LOCATION_PRESETS[0]; // Telco Colony
        state.booking.pickup = defaultLoc;
        document.getElementById('input-pickup').value = defaultLoc.name;

        state.map = L.map('leaflet-map-container', { zoomControl: false, attributionControl: false })
            .setView([defaultLoc.lat, defaultLoc.lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.map);
        L.control.zoom({ position: 'bottomright' }).addTo(state.map);

        updatePickupMarker();
        renderNearbyDrivers();
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
        if (!state.map || !state.booking.pickup) return;
        if (state.markers.pickup) state.map.removeLayer(state.markers.pickup);
        state.markers.pickup = L.marker(
            [state.booking.pickup.lat, state.booking.pickup.lng],
            { icon: pinIcon('pickup-pin') }
        ).addTo(state.map).bindPopup('<b>Pickup</b><br>' + state.booking.pickup.name);
        state.map.setView([state.booking.pickup.lat, state.booking.pickup.lng], 14);
    }

    function updateDropoffMarker() {
        if (!state.map || !state.booking.dropoff) return;
        if (state.markers.dropoff) state.map.removeLayer(state.markers.dropoff);
        state.markers.dropoff = L.marker(
            [state.booking.dropoff.lat, state.booking.dropoff.lng],
            { icon: pinIcon('') }
        ).addTo(state.map).bindPopup('<b>Destination</b><br>' + state.booking.dropoff.name);
        const group = new L.featureGroup([state.markers.pickup, state.markers.dropoff]);
        state.map.fitBounds(group.getBounds().pad(0.15));
        drawRoute();
    }

    function drawRoute() {
        if (!state.map) return;
        if (state.routePolyline) state.map.removeLayer(state.routePolyline);
        const pts = generateRoutePoints(state.booking.pickup, state.booking.dropoff, 60).map(p => [p.lat, p.lng]);
        state.routePolyline = L.polyline(pts, {
            color: '#1F2229', weight: 5, opacity: 0.8, dashArray: '1, 10', lineCap: 'round'
        }).addTo(state.map);
    }

    function renderNearbyDrivers() {
        if (!state.map) return;
        state.markers.nearbyDrivers.forEach(m => state.map.removeLayer(m));
        state.markers.nearbyDrivers = [];
        const { lat, lng } = state.booking.pickup || LOCATION_PRESETS[0];
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

        function showSuggestions(query) {
            const list = searchPresetLocations(query).slice(0, 8);
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
                row.addEventListener('mousedown', () => selectLocation(item));
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

        pickupInput.addEventListener('focus',  () => { state.activeSearchInput = 'pickup';  showSuggestions(''); });
        dropoffInput.addEventListener('focus', () => { state.activeSearchInput = 'dropoff'; showSuggestions(''); });
        pickupInput.addEventListener('input',  e => showSuggestions(e.target.value));
        dropoffInput.addEventListener('input', e => showSuggestions(e.target.value));

        document.getElementById('clear-pickup').addEventListener('click', () => {
            pickupInput.value = '';
            state.booking.pickup = null;
            suggBox.classList.add('hidden');
        });
        document.getElementById('clear-dropoff').addEventListener('click', () => {
            dropoffInput.value = '';
            state.booking.dropoff = null;
            suggBox.classList.add('hidden');
            document.getElementById('vehicle-picker').classList.add('hidden');
        });

        document.getElementById('btn-home-shortcut').addEventListener('click', () => {
            if (!state.user.homeAddress) return;
            const match = searchPresetLocations(state.user.homeAddress)[0];
            if (match) { state.activeSearchInput = 'dropoff'; selectLocation(match); }
        });
        document.getElementById('btn-work-shortcut').addEventListener('click', () => {
            if (!state.user.workAddress) return;
            const match = searchPresetLocations(state.user.workAddress)[0];
            if (match) { state.activeSearchInput = 'dropoff'; selectLocation(match); }
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
        showPanel('panel-booking');
        renderNearbyDrivers();
    });

    function startRideSimulation() {
        const captain = CAPTAINS_POOL[Math.floor(Math.random() * CAPTAINS_POOL.length)];
        state.booking.captainName = captain.name;

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

        // Prefer real DB driver if assignment succeeded, else use simulated captain
        const rd = state.booking.realDriver;
        const displayName    = rd ? rd.driver_name    : captain.name;
        const displayPlate   = rd ? rd.vehicle_number : captain.plate;
        const displayModel   = rd ? ''                : captain.model;
        const displayRating  = rd ? 'Verified Driver' : captain.rating + ' (' + captain.rides + ' rides)';
        state.booking.captainName = displayName;

        document.getElementById('captain-name').textContent       = displayName;
        document.getElementById('captain-rating').textContent     = displayRating;
        document.getElementById('vehicle-plate-num').textContent  = displayPlate;
        document.getElementById('vehicle-model-desc').textContent = displayModel;
        document.getElementById('live-fare').textContent         = '₹' + Math.round(state.booking.fare);
        document.getElementById('ride-status-badge').textContent = 'Captain Arriving';
        document.getElementById('ride-status-badge').className   = 'status-badge green';
        showPanel('panel-tracking');

        // Phase 1: driver approaches pickup
        const toPickup = generateRoutePoints(startPos, state.booking.pickup, 40);
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
                setTimeout(startTripPhase, 2500);
            }
        }, 150);

        startStatusPolling(state.booking.rideId);
    }

    function startTripPhase() {
        document.getElementById('ride-status-badge').textContent = 'Ride In Progress';
        document.getElementById('ride-status-badge').className   = 'status-badge green';

        const toDropoff = generateRoutePoints(state.booking.pickup, state.booking.dropoff, 60);
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
                showCompletedPanel();
            }
        }, 150);
    }

    function stopSimulation() {
        clearInterval(state.simulationInterval);
        if (state.markers.activeDriver) { state.map.removeLayer(state.markers.activeDriver); state.markers.activeDriver = null; }
        if (state.markers.dropoff)      { state.map.removeLayer(state.markers.dropoff);      state.markers.dropoff = null; }
        if (state.routePolyline)        { state.map.removeLayer(state.routePolyline);         state.routePolyline = null; }
        state.booking.dropoff = null;
    }

    function startStatusPolling(rideId) {
        state.statusPollInterval = setInterval(async () => {
            const json = await apiGet('../user/ride_status.php?ride_id=' + rideId).catch(() => null);
            if (!json || !json.success) return;
            if (json.driver_name)    document.getElementById('captain-name').textContent      = json.driver_name;
            if (json.vehicle_number) document.getElementById('vehicle-plate-num').textContent = json.vehicle_number;
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
