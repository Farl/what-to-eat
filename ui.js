import confetti from 'confetti-js';
import { COLORS } from './constants.js';

export function updateDistanceControls(value, elements) {
    const { distanceNumberInput, distanceRangeSlider, distanceValueDisplay } = elements;
    const cleanValue = parseFloat(value.toFixed(1));
    distanceNumberInput.value = cleanValue.toFixed(1);
    distanceRangeSlider.value = cleanValue;
    distanceValueDisplay.textContent = cleanValue.toFixed(1);
}

/**
 * Renders the restaurant list.
 * @param {Array}  restaurants
 * @param {Object} elements    - DOM element refs
 * @param {string|null} googleApiKey - present only for Google backend (enables place_id links)
 */
export function displayRestaurantResults(restaurants, elements, googleApiKey) {
    const { resultsSection, restaurantCountDisplay, restaurantList, wheelContainer } = elements;

    if (restaurants.length === 0) {
        resultsSection.classList.add('hidden');
        wheelContainer.classList.add('hidden');
        restaurantCountDisplay.textContent = 0;
        restaurantList.innerHTML =
            '<p>No restaurants found. Try a wider range or a different location.</p>';
        return;
    }

    resultsSection.classList.remove('hidden');
    restaurantCountDisplay.textContent = restaurants.length;
    restaurantList.innerHTML = '';

    restaurants.forEach(restaurant => {
        const item = document.createElement('div');
        item.className = 'restaurant-item';

        // Build Google Maps link – prefer place_id when available
        let mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
        if (googleApiKey && restaurant.id) {
            mapsLink += `&query_place_id=${encodeURIComponent(restaurant.id)}`;
        } else if (restaurant.lat && restaurant.lon) {
            mapsLink = `https://www.google.com/maps/search/?api=1&query=${restaurant.lat}%2C${restaurant.lon}`;
        }

        // Hours HTML – Google gives opening_hours_info object; OSM gives plain string
        let hoursHTML = '<p><small><strong>Hours:</strong> ';
        if (googleApiKey && restaurant.opening_hours_info) {
            const ohi = restaurant.opening_hours_info;
            if (ohi.weekday_text) {
                hoursHTML += ohi.weekday_text.join('<br>');
            } else if (typeof ohi.open_now !== 'undefined') {
                hoursHTML += ohi.open_now ? 'Open now' : 'Closed now';
            } else {
                hoursHTML += 'Details unavailable';
            }
        } else if (restaurant.opening_hours) {
            hoursHTML += parseOpeningHours(restaurant.opening_hours);
        } else {
            hoursHTML += 'Not specified';
        }
        hoursHTML += '</small></p>';

        // Rating (Google only)
        const ratingHTML = restaurant.rating
            ? `<p><small><strong>Rating:</strong> ${restaurant.rating} ⭐ (${restaurant.user_ratings_total || 0} reviews)</small></p>`
            : '';

        // Address (Google only)
        const addressHTML = restaurant.address
            ? `<p><small><strong>Address:</strong> ${restaurant.address}</small></p>`
            : '';

        item.innerHTML = `
            <h3><a href="${mapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a></h3>
            <p><strong>Cuisine/Type:</strong> ${restaurant.cuisine || 'Not specified'}</p>
            ${addressHTML}${hoursHTML}${ratingHTML}
        `;
        restaurantList.appendChild(item);
    });
}

export function showResultModal(restaurant, elements, googleApiKey) {
    const { resultModal, chosenRestaurantDisplay } = elements;

    let mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
    if (googleApiKey && restaurant.id) {
        mapsLink += `&query_place_id=${encodeURIComponent(restaurant.id)}`;
    } else if (restaurant.lat && restaurant.lon) {
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${restaurant.lat}%2C${restaurant.lon}`;
    }

    let hoursDetails = '<strong>Hours:</strong> Not specified';
    if (googleApiKey && restaurant.opening_hours_info) {
        const ohi = restaurant.opening_hours_info;
        if (ohi.weekday_text) {
            hoursDetails = `<strong>Hours:</strong><br>${ohi.weekday_text.join('<br>')}`;
        } else if (typeof ohi.open_now !== 'undefined') {
            hoursDetails = `<strong>Hours:</strong> ${ohi.open_now ? 'Open now' : 'Closed now'}`;
        }
    } else if (restaurant.opening_hours) {
        hoursDetails = `<strong>Hours:</strong> ${parseOpeningHours(restaurant.opening_hours)}`;
    }

    const ratingLine = restaurant.rating
        ? `<p class="restaurant-details"><strong>Rating:</strong> ${restaurant.rating} ⭐ (${restaurant.user_ratings_total || 0} reviews)</p>`
        : '';

    const addressLine = restaurant.address
        ? `<p class="restaurant-details"><strong>Address:</strong> ${restaurant.address}</p>`
        : '';

    chosenRestaurantDisplay.innerHTML = `
        <p class="winner-name">
            <a href="${mapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a>
        </p>
        <p class="restaurant-details"><strong>Cuisine/Type:</strong> ${restaurant.cuisine || 'Not specified'}</p>
        ${addressLine}
        <p class="restaurant-details">${hoursDetails}</p>
        ${ratingLine}
    `;

    resultModal.classList.remove('hidden');

    confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: COLORS,
        zIndex: 1005
    });
}

export function closeModal(elements) {
    elements.resultModal.classList.add('hidden');
}

export function setFindButtonState(buttonElement, isLoading) {
    if (buttonElement) {
        buttonElement.disabled = isLoading;
        buttonElement.textContent = isLoading ? 'Finding…' : 'Find Restaurants';
    }
}

export function alertMessage(message) {
    alert(message);
}

// ── Private helpers ──────────────────────────────────────────────────────────
function parseOpeningHours(hours) {
    hours = hours.replace(/;/g, ', ');
    const replacements = [
        [/24\/7/gi, 'Open 24/7'], [/mo-su/gi, 'Daily'],
        [/\bmo\b/gi, 'Monday'],   [/\btu\b/gi, 'Tuesday'],
        [/\bwe\b/gi, 'Wednesday'],[/\bth\b/gi, 'Thursday'],
        [/\bfr\b/gi, 'Friday'],   [/\bsa\b/gi, 'Saturday'],
        [/\bsu\b/gi, 'Sunday'],
    ];
    replacements.forEach(([p, r]) => { hours = hours.replace(p, r); });
    return hours;
}
