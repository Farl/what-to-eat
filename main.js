/**
 * main.js – unified entry point.
 *
 * Backend switching strategy:
 *   1. On load, default to "overpass" (no key needed).
 *   2. User can click the "Google Maps" backend button.
 *   3. If a build-time API key was injected by CI/CD (__GOOGLE_MAPS_API_KEY__)
 *      we use it silently; otherwise the key-input card is shown.
 *   4. Each backend swap tears down the previous map and reinitialises.
 */

import * as ui from './ui.js';
import * as wheelManager from './wheel.js';

// ── Build-time API key placeholder (replaced by GitHub Actions CI/CD) ────────
// When not replaced, this string starts with "__" and is ignored.
const BUILD_TIME_GOOGLE_KEY = "__GOOGLE_MAPS_API_KEY__";
const hasBuildTimeKey =
    BUILD_TIME_GOOGLE_KEY.length > 0 &&
    !BUILD_TIME_GOOGLE_KEY.startsWith("__");

// ── DOM elements ─────────────────────────────────────────────────────────────
const dom = {
    backendBtns:           document.querySelectorAll('.backend-btn'),
    googleApiSection:      document.getElementById('google-api-section'),
    googleApiKeyInput:     document.getElementById('google-api-key'),
    initializeAppBtn:      document.getElementById('initialize-app-btn'),
    apiKeyStatus:          document.getElementById('api-key-status'),
    appContent:            document.getElementById('app-content'),
    leafletCss:            document.getElementById('leaflet-css'),

    detectLocationBtn:     document.getElementById('detect-location'),
    distanceNumberInput:   document.getElementById('distance-number-input'),
    distanceRangeSlider:   document.getElementById('distance-range-slider'),
    distanceValueDisplay:  document.getElementById('distance-value'),
    findRestaurantsBtn:    document.getElementById('find-restaurants'),
    resultsSection:        document.getElementById('results-section'),
    restaurantCountDisplay:document.getElementById('restaurant-count'),
    restaurantList:        document.getElementById('restaurant-list'),
    wheelContainer:        document.getElementById('wheel-container'),
    wheelCanvas:           document.getElementById('wheel'),
    spinDurationRange:     document.getElementById('spin-duration-range'),
    spinDurationValue:     document.getElementById('spin-duration-value'),
    resultModal:           document.getElementById('result-modal'),
    chosenRestaurantDisplay:document.getElementById('chosen-restaurant'),
    closeModalButton:      document.querySelector('.close-button'),
    mapElement:            document.getElementById('map'),
    cuisineFilterContainer:document.getElementById('cuisine-filter-container'),
    cuisineCheckboxesContainer: document.getElementById('cuisine-checkboxes'),
};

// ── App state ─────────────────────────────────────────────────────────────────
let currentBackend  = 'overpass'; // 'overpass' | 'google'
let mapManager      = null;       // dynamically imported
let apiModule       = null;       // dynamically imported
let googleApiKey    = '';
let currentLatitude = null;
let currentLongitude= null;
let foundRestaurants    = [];
let displayedRestaurants= [];
let isWheelSpinning = false;
let currentSpinDuration = 2.0;

const LOCAL_STORAGE_DISTANCE_KEY = 'restaurantRouletteDistance';
const LOCAL_STORAGE_DURATION_KEY  = 'restaurantRouletteSpinDuration';

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────
function init() {
    restoreDistanceAndDuration();
    wireStaticListeners();
    // Start with Overpass by default – no API key needed
    activateBackend('overpass');
}

function restoreDistanceAndDuration() {
    const savedDist = localStorage.getItem(LOCAL_STORAGE_DISTANCE_KEY);
    if (savedDist !== null) {
        const v = parseFloat(savedDist);
        if (!isNaN(v)) ui.updateDistanceControls(v, dom);
    }

    const savedDur = localStorage.getItem(LOCAL_STORAGE_DURATION_KEY);
    if (savedDur !== null) {
        const v = parseFloat(savedDur);
        if (!isNaN(v)) {
            currentSpinDuration = v;
            dom.spinDurationRange.value = v;
            dom.spinDurationValue.textContent = v.toFixed(1);
        }
    }
}

function wireStaticListeners() {
    // Backend toggle buttons
    dom.backendBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.backend;
            if (target === currentBackend) return;
            activateBackend(target);
        });
    });

    // Google API key submit
    dom.initializeAppBtn.addEventListener('click', handleInitializeGoogle);
    dom.googleApiKeyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleInitializeGoogle();
    });

    // App controls
    dom.detectLocationBtn.addEventListener('click', handleDetectLocation);
    dom.distanceRangeSlider.addEventListener('input', handleDistanceChange);
    dom.distanceNumberInput.addEventListener('input', handleDistanceChange);
    dom.findRestaurantsBtn.addEventListener('click', handleFindRestaurants);
    dom.spinDurationRange.addEventListener('input', handleSpinDurationChange);
    dom.closeModalButton.addEventListener('click', () => ui.closeModal(dom));
    dom.wheelCanvas.addEventListener('click', handleSpinWheel);
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend switching
// ─────────────────────────────────────────────────────────────────────────────
async function activateBackend(backend) {
    currentBackend = backend;

    // Highlight active button
    dom.backendBtns.forEach(b => b.classList.toggle('active', b.dataset.backend === backend));

    // Reset results
    resetResults();

    if (backend === 'overpass') {
        dom.googleApiSection.classList.add('hidden');
        dom.leafletCss.removeAttribute('disabled');
        await loadBackendModules('overpass');
        showApp();
        initMap();
    } else {
        // Google backend
        dom.leafletCss.setAttribute('disabled', '');

        if (hasBuildTimeKey) {
            // CI/CD injected a key – use it silently
            googleApiKey = BUILD_TIME_GOOGLE_KEY;
            setApiKeyStatus('Using pre-configured API key.', 'ok');
            dom.googleApiSection.classList.remove('hidden');
            dom.initializeAppBtn.classList.add('hidden');
            dom.googleApiKeyInput.classList.add('hidden');
            dom.apiKeyStatus.classList.remove('hidden');
            await loadBackendModules('google');
            await loadGoogleMapsScript(googleApiKey);
            showApp();
            initMap();
        } else {
            // Show key input card
            dom.googleApiSection.classList.remove('hidden');
            dom.initializeAppBtn.classList.remove('hidden');
            dom.googleApiKeyInput.classList.remove('hidden');
            dom.apiKeyStatus.classList.add('hidden');
            dom.appContent.classList.add('hidden');
        }
    }
}

async function loadBackendModules(backend) {
    if (backend === 'overpass') {
        mapManager = await import('./map-leaflet.js');
        apiModule  = await import('./api-overpass.js');
    } else {
        mapManager = await import('./map-google.js');
        apiModule  = await import('./api-google.js');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps key handling
// ─────────────────────────────────────────────────────────────────────────────
async function handleInitializeGoogle() {
    const key = dom.googleApiKeyInput.value.trim();
    if (!key) {
        setApiKeyStatus('Please enter an API key.', 'error');
        return;
    }
    googleApiKey = key;
    dom.initializeAppBtn.disabled = true;
    dom.initializeAppBtn.textContent = 'Loading…';

    try {
        await loadBackendModules('google');
        await loadGoogleMapsScript(googleApiKey);
        showApp();
        initMap();
        setApiKeyStatus('Google Maps loaded successfully.', 'ok');
    } catch (err) {
        console.error('Google Maps load error:', err);
        setApiKeyStatus('Failed to load Google Maps. Check your API key.', 'error');
        dom.initializeAppBtn.disabled = false;
        dom.initializeAppBtn.textContent = 'Use this key';
    }
}

function loadGoogleMapsScript(key) {
    // Remove any previously injected script
    const old = document.getElementById('google-maps-script');
    if (old) old.remove();
    if (window.google?.maps) return Promise.resolve(); // already loaded

    return new Promise((resolve, reject) => {
        window.__googleMapsReady = resolve;
        const script = document.createElement('script');
        script.id  = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&callback=__googleMapsReady`;
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function setApiKeyStatus(msg, type) {
    dom.apiKeyStatus.textContent = msg;
    dom.apiKeyStatus.className   = `api-key-status ${type}`;
    dom.apiKeyStatus.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// Map lifecycle
// ─────────────────────────────────────────────────────────────────────────────
function showApp() {
    dom.appContent.classList.remove('hidden');
}

function initMap() {
    // Tear down any existing map instance first
    if (mapManager?.destroyMap) mapManager.destroyMap();

    const initialLat = 39.8283;
    const initialLng = -98.5795;
    const initialZoom = 4;
    const distance = parseFloat(dom.distanceNumberInput.value) || 1.0;

    mapManager.initMap(
        dom.mapElement,
        initialLat, initialLng, initialZoom,
        handleMarkerDragEnd,
        handleInitialLocation
    );

    // createRadiusCircle may be called after initMap (Leaflet) or after map-ready (Google)
    setTimeout(() => {
        const pos = mapManager.getMarkerLatLng?.() || { lat: initialLat, lng: initialLng };
        mapManager.createRadiusCircle?.(pos, distance);
        mapManager.updateMapCircleRadius?.(distance);
    }, 0);
}

function handleInitialLocation(lat, lng) {
    currentLatitude  = lat;
    currentLongitude = lng;
    const dist = parseFloat(dom.distanceNumberInput.value) || 1.0;
    mapManager.updateMapCircleRadius?.(dist);
}

function handleMarkerDragEnd(lat, lng) {
    currentLatitude  = lat;
    currentLongitude = lng;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────
function handleDetectLocation() {
    mapManager.detectUserLocation(
        dom.detectLocationBtn,
        (lat, lng, error) => {
            if (lat && lng) {
                currentLatitude  = lat;
                currentLongitude = lng;
            } else if (error) {
                ui.alertMessage('Could not detect location. Set it manually on the map.');
            }
        }
    );
}

function handleDistanceChange(event) {
    let value = parseFloat(event.target.value);
    const min = parseFloat(dom.distanceRangeSlider.min);
    const max = parseFloat(dom.distanceRangeSlider.max);
    if (isNaN(value)) value = min;
    value = Math.max(min, Math.min(max, value));
    ui.updateDistanceControls(value, dom);
    mapManager.updateMapCircleRadius?.(value);
    localStorage.setItem(LOCAL_STORAGE_DISTANCE_KEY, value.toFixed(1));
}

function handleSpinDurationChange(event) {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
        currentSpinDuration = value;
        dom.spinDurationValue.textContent = value.toFixed(1);
        localStorage.setItem(LOCAL_STORAGE_DURATION_KEY, value.toFixed(1));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch restaurants
// ─────────────────────────────────────────────────────────────────────────────
async function handleFindRestaurants() {
    const markerPos = mapManager.getMarkerLatLng?.();
    if (markerPos) {
        currentLatitude  = markerPos.lat;
        currentLongitude = markerPos.lng;
    }

    if (!currentLatitude || !currentLongitude) {
        ui.alertMessage('Please set a location on the map or detect your location.');
        return;
    }

    ui.setFindButtonState(dom.findRestaurantsBtn, true);
    const maxDistance = parseFloat(dom.distanceNumberInput.value);

    try {
        let result;
        if (currentBackend === 'google') {
            result = await apiModule.fetchRestaurantsFromAPI(
                googleApiKey, currentLatitude, currentLongitude, maxDistance,
                mapManager.getMapInstance?.()
            );
        } else {
            result = await apiModule.fetchRestaurantsFromAPI(
                currentLatitude, currentLongitude, maxDistance
            );
        }
        foundRestaurants = result.restaurants;
        buildCuisineFilter(result.cuisines);
    } catch (error) {
        console.error('Fetch error:', error);
        ui.alertMessage(error.message || 'Could not fetch restaurants. Please try again.');
    } finally {
        ui.setFindButtonState(dom.findRestaurantsBtn, false);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuisine filter
// ─────────────────────────────────────────────────────────────────────────────
function buildCuisineFilter(cuisines) {
    dom.cuisineCheckboxesContainer.innerHTML = '';

    if (!cuisines?.length) {
        dom.cuisineFilterContainer.classList.add('hidden');
        updateDisplayedRestaurants();
        return;
    }

    cuisines.sort((a, b) => a.localeCompare(b)).forEach(cuisine => {
        const label    = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type  = 'checkbox';
        checkbox.value = cuisine;
        checkbox.name  = 'cuisine-filter';
        checkbox.addEventListener('change', updateDisplayedRestaurants);
        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = cuisine;
        label.appendChild(span);
        dom.cuisineCheckboxesContainer.appendChild(label);
    });

    dom.cuisineFilterContainer.classList.remove('hidden');
    updateDisplayedRestaurants();
}

function getSelectedCuisines() {
    return Array.from(
        dom.cuisineCheckboxesContainer.querySelectorAll('input[name="cuisine-filter"]:checked')
    ).map(cb => cb.value);
}

function updateDisplayedRestaurants() {
    const selected = getSelectedCuisines();
    const filtering = selected.length > 0;

    displayedRestaurants = foundRestaurants.filter(r => {
        if (!filtering) return true;
        const rCuisines = (r.cuisine || '').split(';').map(c => c.trim().toLowerCase());
        return selected.some(s => rCuisines.includes(s.toLowerCase()));
    });

    ui.displayRestaurantResults(displayedRestaurants, dom, currentBackend === 'google' ? googleApiKey : null);
    dom.restaurantCountDisplay.textContent = displayedRestaurants.length;

    wheelManager.setupWheelVisuals(dom.wheelCanvas, displayedRestaurants);

    // Remove any stale "no results" message
    document.getElementById('no-wheel-results-message')?.remove();

    if (displayedRestaurants.length > 0) {
        dom.wheelContainer.classList.remove('hidden');
    } else {
        dom.wheelContainer.classList.add('hidden');
        if (foundRestaurants.length > 0 && filtering) {
            const msg = document.createElement('p');
            msg.id = 'no-wheel-results-message';
            msg.textContent = 'No restaurants match the selected cuisine filters.';
            msg.style.cssText = 'text-align:center;color:#e74c3c;margin-top:10px;';
            dom.cuisineFilterContainer.after(msg);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheel
// ─────────────────────────────────────────────────────────────────────────────
function handleSpinWheel() {
    if (isWheelSpinning) return;
    if (!displayedRestaurants.length) {
        ui.alertMessage('No restaurants available. Find some first!');
        return;
    }

    isWheelSpinning = true;
    dom.wheelCanvas.classList.add('spinning');

    wheelManager.spinWheel(
        dom.wheelCanvas, displayedRestaurants, currentSpinDuration,
        (selected, error) => {
            isWheelSpinning = false;
            dom.wheelCanvas.classList.remove('spinning');
            if (error) { ui.alertMessage(error); return; }
            if (selected) {
                ui.showResultModal(
                    selected, dom,
                    currentBackend === 'google' ? googleApiKey : null
                );
            }
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function resetResults() {
    foundRestaurants = [];
    displayedRestaurants = [];
    dom.resultsSection?.classList.add('hidden');
    dom.wheelContainer?.classList.add('hidden');
    dom.cuisineFilterContainer?.classList.add('hidden');
    dom.restaurantList && (dom.restaurantList.innerHTML = '');
    dom.cuisineCheckboxesContainer && (dom.cuisineCheckboxesContainer.innerHTML = '');
}

init();
