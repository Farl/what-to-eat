import * as mapManager from './map.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as wheelManager from './wheel.js';

// DOM elements
const domElements = {
    initializeAppBtn: document.getElementById('initialize-app-btn'),
    googleApiKeyInput: document.getElementById('google-api-key'),
    appContent: document.getElementById('app-content'),
    detectLocationBtn: document.getElementById('detect-location'),
    distanceNumberInput: document.getElementById('distance-number-input'),
    distanceRangeSlider: document.getElementById('distance-range-slider'),
    distanceValueDisplay: document.getElementById('distance-value'),
    findRestaurantsBtn: document.getElementById('find-restaurants'),
    resultsSection: document.getElementById('results-section'),
    restaurantCountDisplay: document.getElementById('restaurant-count'),
    restaurantList: document.getElementById('restaurant-list'),
    wheelContainer: document.getElementById('wheel-container'),
    wheelCanvas: document.getElementById('wheel'),
    spinDurationRange: document.getElementById('spin-duration-range'),
    spinDurationValue: document.getElementById('spin-duration-value'),
    resultModal: document.getElementById('result-modal'),
    chosenRestaurantDisplay: document.getElementById('chosen-restaurant'),
    closeModalButton: document.querySelector('.close-button'),
    mapElement: document.getElementById('map'),
    cuisineFilterContainer: document.getElementById('cuisine-filter-container'),
    cuisineCheckboxesContainer: document.getElementById('cuisine-checkboxes')
};

// State
let currentLatitude = null;
let currentLongitude = null;
let foundRestaurants = [];
let displayedRestaurants = [];
let isWheelSpinning = false;
let currentSpinDuration = 2.0;
let googleApiKey = '';
let googleMapsApiLoadedPromise = null; 
let googleMapInstance = null; 

// Constants
const LOCAL_STORAGE_DISTANCE_KEY = 'restaurantRouletteDistance';
const LOCAL_STORAGE_DURATION_KEY = 'restaurantRouletteSpinDuration';

// Initialize basic UI, wait for API key for map features
function init() {
    const savedDistance = localStorage.getItem(LOCAL_STORAGE_DISTANCE_KEY);
    const defaultDistance = 1.0;
    let initialDistance = defaultDistance;
    const minDistance = parseFloat(domElements.distanceRangeSlider.min);
    const maxDistance = parseFloat(domElements.distanceRangeSlider.max);
    if (savedDistance !== null) {
        const parsedDistance = parseFloat(savedDistance);
        if (!isNaN(parsedDistance) && parsedDistance >= minDistance && parsedDistance <= maxDistance) {
            initialDistance = parsedDistance;
        }
    }
    ui.updateDistanceControls(initialDistance, domElements);

    const savedDuration = localStorage.getItem(LOCAL_STORAGE_DURATION_KEY);
    const defaultDuration = 2.0;
    let initialDuration = defaultDuration;
    const minDuration = parseFloat(domElements.spinDurationRange.min);
    const maxDuration = parseFloat(domElements.spinDurationRange.max);
    if (savedDuration !== null) {
        const parsedDuration = parseFloat(savedDuration);
        if (!isNaN(parsedDuration) && parsedDuration >= minDuration && parsedDuration <= maxDuration) {
            initialDuration = parsedDuration;
        }
    }
    currentSpinDuration = initialDuration;
    domElements.spinDurationRange.value = initialDuration;
    domElements.spinDurationValue.textContent = initialDuration.toFixed(1);

    domElements.distanceRangeSlider.addEventListener('input', handleDistanceInputChange);
    domElements.distanceNumberInput.addEventListener('input', handleDistanceInputChange);
    if (domElements.spinDurationRange) {
        domElements.spinDurationRange.addEventListener('input', handleSpinDurationChange);
    }
    if (domElements.closeModalButton) {
        domElements.closeModalButton.addEventListener('click', () => ui.closeModal(domElements));
    }

    domElements.initializeAppBtn.addEventListener('click', handleInitializeApp);
}

function handleInitializeApp() {
    const key = domElements.googleApiKeyInput.value.trim();
    if (!key) {
        ui.alertMessage('Please enter a Google Maps API Key.');
        return;
    }
    googleApiKey = key;
    domElements.initializeAppBtn.disabled = true;
    domElements.initializeAppBtn.textContent = 'Initializing...';

    googleMapsApiLoadedPromise = new Promise(resolve => {
        window.resolveGoogleMapsLoaded = resolve; 
    });

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places,geometry&callback=onGoogleMapsApiLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
        ui.alertMessage('Failed to load Google Maps. Check API key and network.');
        domElements.initializeAppBtn.disabled = false;
        domElements.initializeAppBtn.textContent = 'Initialize App';
    };
    document.head.appendChild(script);

    googleMapsApiLoadedPromise.then(() => {
        console.log("Google Maps API ready, initializing app features.");
        document.querySelector('.api-key-section').classList.add('hidden');
        domElements.appContent.classList.remove('hidden');
        initializeMapDependentFeatures();
    }).catch(error => {
        console.error("Error during Google Maps API loading or app initialization:", error);
        ui.alertMessage('An error occurred during initialization. Please try again.');
        domElements.initializeAppBtn.disabled = false;
        domElements.initializeAppBtn.textContent = 'Initialize App';
    });
}

function initializeMapDependentFeatures() {
    const initialLat = 39.8283; 
    const initialLng = -98.5795;
    const initialZoom = 4; 
    let initialDistance = parseFloat(domElements.distanceNumberInput.value);

    const mapData = mapManager.initMap(
        domElements.mapElement,
        initialLat,
        initialLng,
        initialZoom,
        handleMarkerDragEnd,
        handleInitialLocation
    );
    googleMapInstance = mapData.map; 

    const initialMarkerPos = mapManager.getMarkerLatLng() || { lat: initialLat, lng: initialLng };
    mapManager.createRadiusCircle(initialMarkerPos, initialDistance);
    mapManager.updateMapCircleRadius(initialDistance); 

    domElements.detectLocationBtn.addEventListener('click', handleDetectLocation);
    domElements.findRestaurantsBtn.addEventListener('click', handleFindRestaurants);

    if (domElements.wheelCanvas) {
        domElements.wheelCanvas.addEventListener('click', handleSpinWheel);
    }
}

function handleInitialLocation(lat, lng, error) {
    const markerLatLng = mapManager.getMarkerLatLng(); 
    if (markerLatLng) {
        currentLatitude = markerLatLng.lat;
        currentLongitude = markerLatLng.lng;
        const currentDistance = parseFloat(domElements.distanceNumberInput.value);
        mapManager.updateMapCircleRadius(currentDistance); 
    }
    if (error) {
        console.warn("Initial location detection issue:", error.message);
    }
}

function handleMarkerDragEnd(lat, lng) {
    currentLatitude = lat;
    currentLongitude = lng;
}

function handleDetectLocation() {
    mapManager.detectUserLocation(
        domElements.detectLocationBtn,
        (lat, lng, error) => {
            if (lat && lng) {
                currentLatitude = lat;
                currentLongitude = lng;
            } else if (error) {
                console.error("Detection error:", error.message);
            }
        }
    );
}

function handleDistanceInputChange(event) {
    const sourceElement = event.target;
    let value = parseFloat(sourceElement.value);

    const min = parseFloat(domElements.distanceRangeSlider.min);
    const max = parseFloat(domElements.distanceRangeSlider.max);

    if (isNaN(value)) value = min;
    value = Math.max(min, Math.min(max, value));

    ui.updateDistanceControls(value, domElements);
    if (googleMapsApiLoadedPromise) { 
         googleMapsApiLoadedPromise.then(() => mapManager.updateMapCircleRadius(value));
    }
    localStorage.setItem(LOCAL_STORAGE_DISTANCE_KEY, value.toFixed(1));
}

function handleSpinDurationChange(event) {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
        currentSpinDuration = value;
        domElements.spinDurationValue.textContent = value.toFixed(1);
        localStorage.setItem(LOCAL_STORAGE_DURATION_KEY, value.toFixed(1));
        if (wheelManager.isWheelSetup()) { 
            wheelManager.setSpinTime(currentSpinDuration * 1000); 
        }
    }
}

async function handleFindRestaurants() {
    if (!googleApiKey || !googleMapInstance) {
        ui.alertMessage('Please initialize the app with your API key first.');
        return;
    }

    const markerPos = mapManager.getMarkerLatLng();
    if (markerPos) {
        currentLatitude = markerPos.lat;
        currentLongitude = markerPos.lng;
    }

    if (!currentLatitude || !currentLongitude) {
        ui.alertMessage('Please set a location on the map or detect your location.');
        return;
    }

    ui.setFindButtonState(domElements.findRestaurantsBtn, true);
    const maxDistance = parseFloat(domElements.distanceNumberInput.value);

    try {
        const { restaurants, cuisines } = await api.fetchRestaurantsFromAPI(
            googleApiKey,
            currentLatitude,
            currentLongitude,
            maxDistance,
            googleMapInstance 
        );
        foundRestaurants = restaurants;
        updateCuisineFilterUI(cuisines); 
    } catch (error) {
        console.error('Restaurant fetch error:', error);
        ui.alertMessage(error.message || 'Could not fetch restaurants. Please try again.');
    } finally {
        ui.setFindButtonState(domElements.findRestaurantsBtn, false);
    }
}

function getSelectedCuisines() {
    return Array.from(
        domElements.cuisineCheckboxesContainer.querySelectorAll('input[name="cuisine-filter"]:checked')
    ).map(checkbox => checkbox.value);
}

function updateCuisineFilterUI(cuisines) {
    domElements.cuisineCheckboxesContainer.innerHTML = ''; 

    if (!cuisines || cuisines.length === 0) {
        domElements.cuisineFilterContainer.classList.add('hidden');
        updateDisplayedRestaurants();
        return;
    }

    cuisines.forEach(cuisine => { 
        const checkboxWrapper = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cuisine;
        checkbox.name = 'cuisine-filter';
        checkbox.checked = false; 

        checkbox.addEventListener('change', updateDisplayedRestaurants);

        checkboxWrapper.appendChild(checkbox);
        const labelText = document.createElement('span');
        labelText.textContent = cuisine;
        checkboxWrapper.appendChild(labelText);
        domElements.cuisineCheckboxesContainer.appendChild(checkboxWrapper);
    });

    domElements.cuisineFilterContainer.classList.remove('hidden');
    updateDisplayedRestaurants(); 
}

function updateDisplayedRestaurants() {
    const selectedCuisines = getSelectedCuisines();
    const filterApplied = selectedCuisines.length > 0;

    ui.displayRestaurantResults(foundRestaurants, domElements, googleApiKey); 
    domElements.restaurantCountDisplay.textContent = foundRestaurants.length;

    displayedRestaurants = foundRestaurants.filter(restaurant => {
        if (!filterApplied) {
            return true; 
        }
        const restaurantCuisines = (restaurant.cuisine || '')
            .split(';')
            .map(c => c.trim().toLowerCase());
        
        const selectedCuisinesLower = selectedCuisines.map(c => c.toLowerCase());

        return restaurantCuisines.some(rCuisine => selectedCuisinesLower.includes(rCuisine));
    });

    wheelManager.setupWheelVisuals(domElements.wheelCanvas, displayedRestaurants);

    const noWheelResultsMsg = document.getElementById('no-wheel-results-message');
    if (noWheelResultsMsg) noWheelResultsMsg.remove();

    if (displayedRestaurants.length > 0) {
        domElements.wheelContainer.classList.remove('hidden');
    } else {
        domElements.wheelContainer.classList.add('hidden');
        if (foundRestaurants.length > 0 && filterApplied) {
            const msgElement = document.createElement('p');
            msgElement.id = 'no-wheel-results-message';
            msgElement.textContent = 'No restaurants match your selected cuisine/type filters for the wheel.';
            msgElement.style.cssText = 'text-align: center; color: #e74c3c; margin-top: 10px;';
            domElements.cuisineFilterContainer.parentNode.insertBefore(msgElement, domElements.wheelContainer);

        }
    }
}

function handleSpinWheel() {
    if (isWheelSpinning) return;
    if (displayedRestaurants.length === 0) {
        ui.alertMessage("No restaurants currently match your filters to spin for.");
        return;
    }

    isWheelSpinning = true;
    domElements.wheelCanvas.classList.add('spinning');

    wheelManager.spinWheel(domElements.wheelCanvas, displayedRestaurants, currentSpinDuration, (selectedRestaurant, error) => {
        isWheelSpinning = false;
        domElements.wheelCanvas.classList.remove('spinning');

        if (error) {
            console.error("Spinning error:", error);
            ui.alertMessage(error);
            return;
        }
        if (selectedRestaurant) {
            ui.showResultModal(selectedRestaurant, domElements, googleApiKey);
        } else {
            ui.alertMessage("Spin finished, but no restaurant was selected.");
        }
    });
}

init();