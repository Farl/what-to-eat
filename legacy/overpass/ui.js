import confetti from 'confetti-js';
import { COLORS } from './constants.js';

export function updateDistanceControls(value, elements) {
    const { distanceNumberInput, distanceRangeSlider, distanceValueDisplay } = elements;
    const cleanValue = parseFloat(value.toFixed(1));

    distanceNumberInput.value = cleanValue.toFixed(1);
    distanceRangeSlider.value = cleanValue;
    distanceValueDisplay.textContent = cleanValue.toFixed(1);
}

export function updateCuisineFilterUI(cuisines) {
    cuisines.forEach(cuisine => {
        const checkboxWrapper = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cuisine;
        checkbox.name = 'cuisine-filter';
        checkbox.checked = false;

        checkbox.addEventListener('change', updateDisplayedRestaurants);

        checkboxWrapper.appendChild(checkbox);
        
        // Create a span for the label text to allow styling when checked
        const labelText = document.createElement('span');
        labelText.textContent = cuisine;
        checkboxWrapper.appendChild(labelText);

        domElements.cuisineCheckboxesContainer.appendChild(checkboxWrapper);
    });
}

export function displayRestaurantResults(restaurants, elements) {
    const { resultsSection, restaurantCountDisplay, restaurantList, wheelContainer } = elements;

    if (restaurants.length === 0) {
        resultsSection.classList.add('hidden');
        wheelContainer.classList.add('hidden');
        restaurantCountDisplay.textContent = 0;
        restaurantList.innerHTML = '<p>No restaurants found matching your criteria (or they might be permanently closed). Try a wider range or different location.</p>';
        alert('No restaurants found with the current criteria (or they might be permanently closed). Try adjusting location or distance.');
        return;
    }

    resultsSection.classList.remove('hidden');
    restaurantCountDisplay.textContent = restaurants.length;
    restaurantList.innerHTML = '';

    restaurants.forEach((restaurant) => {
        const restaurantItem = document.createElement('div');
        restaurantItem.className = 'restaurant-item';

        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;

        // Improved hours parsing and display
        let openingHoursHTML = '<p><small><strong>Hours:</strong> ';
        if (restaurant.opening_hours) {
            try {
                const hoursText = parseOpeningHours(restaurant.opening_hours);
                openingHoursHTML += hoursText;
            } catch (error) {
                openingHoursHTML += 'Details unavailable';
                console.warn('Opening hours parsing error:', error);
            }
        } else {
            openingHoursHTML += 'Not specified';
        }
        openingHoursHTML += '</small></p>';

        restaurantItem.innerHTML = `
            <h3><a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a></h3>
            <p><strong>Cuisine:</strong> ${restaurant.cuisine || 'Not specified'}</p>
            ${openingHoursHTML}
        `;
        restaurantList.appendChild(restaurantItem);
    });

    // Wheel container visibility is handled by main.js after filtering
    // wheelContainer.classList.remove('hidden');
}

function parseOpeningHours(hours) {
    // Clean and simplify opening hours
    hours = hours.replace(/;/g, ', ');

    // Some common opening hour syntax replacements
    const replacements = [
        [/24\/7/gi, 'Open 24/7'],
        [/mo-su/gi, 'Daily'],
        [/\bmo\b/gi, 'Monday'],
        [/\btu\b/gi, 'Tuesday'],
        [/\bwe\b/gi, 'Wednesday'],
        [/\bth\b/gi, 'Thursday'],
        [/\bfr\b/gi, 'Friday'],
        [/\bsa\b/gi, 'Saturday'],
        [/\bsu\b/gi, 'Sunday']
    ];

    replacements.forEach(([pattern, replacement]) => {
        hours = hours.replace(pattern, replacement);
    });

    return hours;
}

export function showResultModal(restaurant, elements) {
    const { resultModal, chosenRestaurantDisplay } = elements;
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;

    let openingHoursDetails = '';
    if (restaurant.opening_hours) {
        try {
            openingHoursDetails = `Hours: ${parseOpeningHours(restaurant.opening_hours)}`;
        } catch (error) {
            openingHoursDetails = 'Hours: Details unavailable';
            console.warn('Modal hours parsing error:', error);
        }
    } else {
        openingHoursDetails = 'Hours: Not specified';
    }

    chosenRestaurantDisplay.innerHTML = `
        <p class="winner-name"><a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a></p>
        <p class="restaurant-details">
            <strong>Cuisine:</strong> ${restaurant.cuisine || 'Not specified'}
        </p>
        <p class="restaurant-details">
            <strong>${openingHoursDetails}</strong>
        </p>
    `;

    resultModal.classList.remove('hidden');

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: COLORS,
            zIndex: 1005
        });
    } else {
        console.error("Confetti function not available.");
    }
}

export function closeModal(elements) {
    elements.resultModal.classList.add('hidden');
}

export function setFindButtonState(buttonElement, isLoading) {
    buttonElement.disabled = isLoading;
    buttonElement.textContent = isLoading ? 'Finding...' : 'Find Restaurants';
}

export function alertMessage(message) {
    alert(message);
}