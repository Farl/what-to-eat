import confetti from 'confetti-js';
import { COLORS } from './constants.js';

export function updateDistanceControls(value, elements) {
    const { distanceNumberInput, distanceRangeSlider, distanceValueDisplay } = elements;
    const cleanValue = parseFloat(value.toFixed(1));

    distanceNumberInput.value = cleanValue.toFixed(1);
    distanceRangeSlider.value = cleanValue;
    distanceValueDisplay.textContent = cleanValue.toFixed(1);
}

export function displayRestaurantResults(restaurants, elements, apiKey) {
    const { resultsSection, restaurantCountDisplay, restaurantList, wheelContainer } = elements;

    if (restaurants.length === 0) {
        resultsSection.classList.add('hidden');
        // wheelContainer visibility handled by main.js based on filtered results
        restaurantCountDisplay.textContent = 0;
        restaurantList.innerHTML = '<p>No restaurants found. Try a wider range, different location, or check your API key limits.</p>';
        // Don't alert here, as it might be due to filters. Message in list is enough.
        return;
    }

    resultsSection.classList.remove('hidden');
    restaurantCountDisplay.textContent = restaurants.length;
    restaurantList.innerHTML = ''; // Clear previous results

    restaurants.forEach((restaurant) => {
        const restaurantItem = document.createElement('div');
        restaurantItem.className = 'restaurant-item';

        // Google Maps link using place_id if available, otherwise by name/address or lat/lng
        let googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
        if (restaurant.id) { // place_id
            googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.id}`;
        } else if (restaurant.lat && restaurant.lon) {
             googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${restaurant.lat}%2C${restaurant.lon}`;
        }


        let openingHoursHTML = '<p><small><strong>Hours:</strong> ';
        if (restaurant.opening_hours_info) {
            if (restaurant.opening_hours_info.weekday_text) {
                openingHoursHTML += restaurant.opening_hours_info.weekday_text.join('<br>');
            } else if (typeof restaurant.opening_hours_info.open_now !== 'undefined') {
                openingHoursHTML += restaurant.opening_hours_info.open_now ? 'Open now (details unavailable)' : 'Closed now (details unavailable)';
            } else {
                openingHoursHTML += 'Details unavailable';
            }
        } else {
            openingHoursHTML += 'Not specified';
        }
        openingHoursHTML += '</small></p>';
        
        let ratingHTML = '';
        if (restaurant.rating) {
            ratingHTML = `<p><small><strong>Rating:</strong> ${restaurant.rating} (${restaurant.user_ratings_total || 0} reviews)</small></p>`;
        }

        restaurantItem.innerHTML = `
            <h3><a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a></h3>
            <p><strong>Cuisine/Type:</strong> ${restaurant.cuisine || 'Not specified'}</p>
            <p><small><strong>Address:</strong> ${restaurant.address || 'Not specified'}</small></p>
            ${openingHoursHTML}
            ${ratingHTML}
        `;
        restaurantList.appendChild(restaurantItem);
    });
}

export function showResultModal(restaurant, elements, apiKey) {
    const { resultModal, chosenRestaurantDisplay } = elements;
    
    let googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
    if (restaurant.id) { // place_id
        googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.id}`;
    } else if (restaurant.lat && restaurant.lon) {
         googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${restaurant.lat}%2C${restaurant.lon}`;
    }

    let openingHoursDetails = 'Hours: Not specified';
    if (restaurant.opening_hours_info) {
        if (restaurant.opening_hours_info.weekday_text) {
            openingHoursDetails = `<strong>Hours:</strong><br>${restaurant.opening_hours_info.weekday_text.join('<br>')}`;
        } else if (typeof restaurant.opening_hours_info.open_now !== 'undefined') {
            openingHoursDetails = `<strong>Hours:</strong> ${restaurant.opening_hours_info.open_now ? 'Open now (details unavailable)' : 'Closed now (details unavailable)'}`;
        } else {
            openingHoursDetails = '<strong>Hours:</strong> Details unavailable';
        }
    }
    
    let ratingDetails = '';
    if (restaurant.rating) {
        ratingDetails = `<strong>Rating:</strong> ${restaurant.rating} (${restaurant.user_ratings_total || 0} reviews)`;
    }

    chosenRestaurantDisplay.innerHTML = `
        <p class="winner-name"><a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">${restaurant.name}</a></p>
        <p class="restaurant-details">
            <strong>Cuisine/Type:</strong> ${restaurant.cuisine || 'Not specified'}
        </p>
        <p class="restaurant-details">
            <strong>Address:</strong> ${restaurant.address || 'Not specified'}
        </p>
        <p class="restaurant-details">${openingHoursDetails}</p>
        ${ratingDetails ? `<p class="restaurant-details">${ratingDetails}</p>` : ''}
    `;

    resultModal.classList.remove('hidden');

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: COLORS,
            zIndex: 1005 // Ensure confetti is above modal backdrop but potentially below modal content if needed
        });
    }
}

export function closeModal(elements) {
    elements.resultModal.classList.add('hidden');
}

export function setFindButtonState(buttonElement, isLoading) {
    if(buttonElement) {
        buttonElement.disabled = isLoading;
        buttonElement.textContent = isLoading ? 'Finding...' : 'Find Restaurants';
    }
}

export function alertMessage(message) {
    alert(message);
}