import * as mapManager from './map.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as wheelManager from './wheel.js';

// DOM elements
const domElements = {
    detectLocationBtn: document.getElementById('detect-location'),
    latitudeInput: document.getElementById('latitude'),
    longitudeInput: document.getElementById('longitude'),
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

// Constants
const LOCAL_STORAGE_DISTANCE_KEY = 'restaurantRouletteDistance';
const LOCAL_STORAGE_DURATION_KEY = 'restaurantRouletteSpinDuration';

// Initialize
function init() {
    const initialLat = 39.8283;
    const initialLng = -98.5795;
    const initialZoom = 4;

    const savedDistance = localStorage.getItem(LOCAL_STORAGE_DISTANCE_KEY);
    const defaultDistance = 1.0;
    let initialDistance = defaultDistance;

    const minDistance = parseFloat(domElements.distanceRangeSlider.min);
    const maxDistance = parseFloat(domElements.distanceRangeSlider.max);

    if (savedDistance !== null) {
        const parsedDistance = parseFloat(savedDistance);
        if (!isNaN(parsedDistance) && parsedDistance >= minDistance && parsedDistance <= maxDistance) {
            initialDistance = parsedDistance;
        } else {
            console.warn(`Loaded distance "${savedDistance}" is invalid. Using default.`);
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
        } else {
            console.warn(`Loaded spin duration "${savedDuration}" is invalid. Using default.`);
        }
    }
    currentSpinDuration = initialDuration;
    domElements.spinDurationRange.value = initialDuration;
    domElements.spinDurationValue.textContent = initialDuration.toFixed(1);

    mapManager.initMap(
        domElements.mapElement,
        initialLat,
        initialLng,
        initialZoom,
        handleMarkerDragEnd,
        handleInitialLocation,
        domElements.latitudeInput,
        domElements.longitudeInput
    );

    const initialLatLng = mapManager.getMarkerLatLng() || { lat: initialLat, lng: initialLng };
    mapManager.createRadiusCircle(initialLatLng, initialDistance);
    mapManager.updateMapCircleRadius(initialDistance);

    domElements.detectLocationBtn.addEventListener('click', handleDetectLocation);
    domElements.distanceRangeSlider.addEventListener('input', handleDistanceInputChange);
    domElements.distanceNumberInput.addEventListener('input', handleDistanceInputChange);
    domElements.findRestaurantsBtn.addEventListener('click', handleFindRestaurants);

    if (domElements.wheelCanvas) {
        domElements.wheelCanvas.addEventListener('click', handleSpinWheel);
    } else {
        console.error("Wheel canvas element not found!");
    }

    if (domElements.spinDurationRange && domElements.spinDurationValue) {
        domElements.spinDurationRange.addEventListener('input', handleSpinDurationChange);
    } else {
        console.error("Spin duration slider elements not found!");
    }

    if (domElements.closeModalButton) {
        domElements.closeModalButton.addEventListener('click', () => ui.closeModal(domElements));
    } else {
        console.error("Modal close button not found!");
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
        domElements.latitudeInput,
        domElements.longitudeInput,
        (lat, lng, error) => {
            if (lat && lng) {
                currentLatitude = lat;
                currentLongitude = lng;
            } else if (error) {
                console.error("Detection error:", error.message);
                ui.alertMessage('Could not detect your location. Please set location manually on the map.');
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
    mapManager.updateMapCircleRadius(value);

    localStorage.setItem(LOCAL_STORAGE_DISTANCE_KEY, value.toFixed(1));
}

function handleSpinDurationChange(event) {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
        currentSpinDuration = value;
        domElements.spinDurationValue.textContent = value.toFixed(1);
        localStorage.setItem(LOCAL_STORAGE_DURATION_KEY, value.toFixed(1));
    }
}

async function handleFindRestaurants() {
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

    api.fetchRestaurantsFromAPI(currentLatitude, currentLongitude, maxDistance)
        .then(({ restaurants, cuisines }) => {
            foundRestaurants = restaurants;
            updateCuisineFilterUI(cuisines);
            updateDisplayedRestaurants();
        })
        .catch(error => {
            console.error('Restaurant fetch error:', error);
            ui.alertMessage('Could not fetch restaurants. Please try again.');
            ui.setFindButtonState(domElements.findRestaurantsBtn, false);
        })
        .finally(() => {
            ui.setFindButtonState(domElements.findRestaurantsBtn, false);
        });
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

    cuisines.sort((a, b) => a.localeCompare(b));

    cuisines.forEach(cuisine => {
        const checkboxWrapper = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cuisine;
        checkbox.name = 'cuisine-filter';
        checkbox.checked = false;

        checkbox.addEventListener('change', updateDisplayedRestaurants);

        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(document.createTextNode(cuisine));

        domElements.cuisineCheckboxesContainer.appendChild(checkboxWrapper);
    });

    domElements.cuisineFilterContainer.classList.remove('hidden');

    updateDisplayedRestaurants();
}

function updateDisplayedRestaurants() {
    const selectedCuisines = getSelectedCuisines();

    const filterApplied = selectedCuisines.length > 0;

    ui.displayRestaurantResults(foundRestaurants, {
        resultsSection: domElements.resultsSection,
        restaurantCountDisplay: domElements.restaurantCountDisplay,
        restaurantList: domElements.restaurantList,
        wheelContainer: domElements.wheelContainer
    });
    domElements.restaurantCountDisplay.textContent = foundRestaurants.length;

    displayedRestaurants = foundRestaurants.filter(restaurant => {
        if (!filterApplied) {
            return true;
        }

        const restaurantCuisines = (restaurant.cuisine || '')
            .split(';')
            .map(c => c.trim().toLowerCase())
            .filter(Boolean);

        const selectedCuisineLower = selectedCuisines.map(c => c.toLowerCase());
        return restaurantCuisines.some(rCuisine =>
            selectedCuisineLower.includes(rCuisine)
        );
    });

    wheelManager.setupWheelVisuals(domElements.wheelCanvas, displayedRestaurants);

    if (displayedRestaurants.length > 0) {
        domElements.wheelContainer.classList.remove('hidden');
    } else {
        domElements.wheelContainer.classList.add('hidden');
        if (foundRestaurants.length > 0 && filterApplied) {
            const noWheelResultsMsg = document.createElement('p');
            noWheelResultsMsg.id = 'no-wheel-results-message';
            noWheelResultsMsg.textContent = 'No restaurants match your selected cuisine filters for the wheel.';
            noWheelResultsMsg.style.cssText = 'text-align: center; color: #e74c3c; margin-top: 10px;';
            if (!document.getElementById('no-wheel-results-message')) {
                domElements.wheelContainer.parentNode.insertBefore(noWheelResultsMsg, domElements.wheelContainer.nextSibling);
            }
        } else {
            const existingMsg = document.getElementById('no-wheel-results-message');
            if (existingMsg) existingMsg.remove();
        }
    }
}

function handleSpinWheel() {
    if (isWheelSpinning) {
        console.log("Wheel is already spinning.");
        return;
    }
    if (displayedRestaurants.length === 0) {
        ui.alertMessage("No restaurants currently match your filters to spin.");
        return;
    }

    isWheelSpinning = true;
    domElements.wheelCanvas.classList.add('spinning');

    wheelManager.spinWheel(domElements.wheelCanvas, displayedRestaurants, (selectedRestaurant, error) => {
        isWheelSpinning = false;
        domElements.wheelCanvas.classList.remove('spinning');

        if (error) {
            console.error("Spinning error:", error);
            ui.alertMessage(error);
            return;
        }
        if (selectedRestaurant) {
            ui.showResultModal(selectedRestaurant, domElements);
        } else {
            ui.alertMessage("Spin finished, but no restaurant was selected.");
        }
    });
}

init();