import { map as leafletMap, tileLayer as leafletTileLayer, marker as leafletMarker, circle as leafletCircle } from 'leaflet';

let map = null;
let markerInstance = null;
let radiusCircleInstance = null;

export function initMap(mapElement, initialLat, initialLng, initialZoom, onMarkerDragEndCallback, onLocationDetectedCallback) {
    map = leafletMap(mapElement).setView([initialLat, initialLng], initialZoom);
    leafletTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markerInstance = leafletMarker([initialLat, initialLng], { draggable: true }).addTo(map);

    markerInstance.on('dragend', function (event) {
        const newLatLng = event.target.getLatLng();
        if (radiusCircleInstance) radiusCircleInstance.setLatLng(newLatLng);
        if (onMarkerDragEndCallback) onMarkerDragEndCallback(newLatLng.lat, newLatLng.lng);
    });

    // Attempt to geolocate on load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                map.setView([userLat, userLng], 13);
                markerInstance.setLatLng([userLat, userLng]);
                if (radiusCircleInstance) radiusCircleInstance.setLatLng([userLat, userLng]);
                if (onLocationDetectedCallback) onLocationDetectedCallback(userLat, userLng);
            },
            (error) => {
                console.warn('Could not auto-detect location on load:', error.message);
                const ll = markerInstance.getLatLng();
                if (onLocationDetectedCallback) onLocationDetectedCallback(ll.lat, ll.lng);
            }
        );
    } else {
        const ll = markerInstance.getLatLng();
        if (onLocationDetectedCallback) onLocationDetectedCallback(ll.lat, ll.lng);
    }

    return { map, marker: markerInstance };
}

export function createRadiusCircle(latLng, initialRadiusKm) {
    if (map) {
        radiusCircleInstance = leafletCircle(latLng, {
            color: '#e74c3c',
            fillColor: '#e74c3c',
            fillOpacity: 0.2,
            radius: initialRadiusKm * 1000
        }).addTo(map);
    }
    return radiusCircleInstance;
}

export function updateMapCircleRadius(distanceKm) {
    if (radiusCircleInstance) radiusCircleInstance.setRadius(distanceKm * 1000);
}

export function detectUserLocation(detectButton, onCompleteCallback) {
    if (!navigator.geolocation) {
        if (onCompleteCallback) onCompleteCallback(null, null, new Error('Geolocation not supported'));
        return;
    }

    if (detectButton) { detectButton.textContent = 'Detecting…'; detectButton.disabled = true; }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 13);
            markerInstance.setLatLng([lat, lng]);
            if (radiusCircleInstance) radiusCircleInstance.setLatLng([lat, lng]);
            if (detectButton) { detectButton.textContent = 'Detect My Location'; detectButton.disabled = false; }
            if (onCompleteCallback) onCompleteCallback(lat, lng, null);
        },
        (error) => {
            console.error('Error getting location:', error);
            if (detectButton) { detectButton.textContent = 'Detect My Location'; detectButton.disabled = false; }
            if (onCompleteCallback) onCompleteCallback(null, null, error);
        }
    );
}

export function getMarkerLatLng() {
    return markerInstance ? markerInstance.getLatLng() : null;
}

export function getMapInstance() {
    return map;
}

export function destroyMap() {
    if (map) {
        map.remove();
        map = null;
        markerInstance = null;
        radiusCircleInstance = null;
    }
}
