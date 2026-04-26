import { map as leafletMap, tileLayer as leafletTileLayer, marker as leafletMarker, circle as leafletCircle } from 'leaflet';

let map = null;
let markerInstance = null;
let radiusCircleInstance = null;

export function initMap(mapElement, initialLat, initialLng, initialZoom, onMarkerDragEndCallback, onLocationDetectedCallback, latitudeInput, longitudeInput) {
    map = leafletMap(mapElement).setView([initialLat, initialLng], initialZoom);
    leafletTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markerInstance = leafletMarker([initialLat, initialLng], { draggable: true }).addTo(map);
    
    updateCoordinatesDisplay(markerInstance.getLatLng(), latitudeInput, longitudeInput);

    markerInstance.on('dragend', function(event) {
        const newLatLng = event.target.getLatLng();
        updateCoordinatesDisplay(newLatLng, latitudeInput, longitudeInput);
        if (radiusCircleInstance) {
            radiusCircleInstance.setLatLng(newLatLng);
        }
        if (onMarkerDragEndCallback) {
            onMarkerDragEndCallback(newLatLng.lat, newLatLng.lng);
        }
    });

    // Attempt to geolocate on load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                map.setView([userLat, userLng], 13);
                markerInstance.setLatLng([userLat, userLng]);
                updateCoordinatesDisplay({ lat: userLat, lng: userLng }, latitudeInput, longitudeInput);
                if (radiusCircleInstance) {
                    radiusCircleInstance.setLatLng([userLat, userLng]);
                }
                if (onLocationDetectedCallback) {
                    onLocationDetectedCallback(userLat, userLng);
                }
            },
            (error) => {
                console.warn('Could not auto-detect location on load:', error.message);
                 if (onLocationDetectedCallback) { // Still callback with initial marker position
                    const currentLatLng = markerInstance.getLatLng();
                    onLocationDetectedCallback(currentLatLng.lat, currentLatLng.lng);
                }
            }
        );
    } else {
         if (onLocationDetectedCallback) { // Still callback with initial marker position
            const currentLatLng = markerInstance.getLatLng();
            onLocationDetectedCallback(currentLatLng.lat, currentLatLng.lng);
        }
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


function updateCoordinatesDisplay(latLng, latitudeInput, longitudeInput) {
    if (latitudeInput && longitudeInput) {
        latitudeInput.value = latLng.lat.toFixed(4);
        longitudeInput.value = latLng.lng.toFixed(4);
    }
}

export function updateMapCircleRadius(distanceKm) {
    if (radiusCircleInstance) {
        radiusCircleInstance.setRadius(distanceKm * 1000);
    }
}

export function detectUserLocation(detectButton, latitudeInput, longitudeInput, onCompleteCallback) {
    if (navigator.geolocation) {
        if(detectButton) {
            detectButton.textContent = 'Detecting...';
            detectButton.disabled = true;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                map.setView([lat, lng], 13); 
                markerInstance.setLatLng([lat, lng]);
                updateCoordinatesDisplay({ lat, lng }, latitudeInput, longitudeInput);
                if (radiusCircleInstance) {
                    radiusCircleInstance.setLatLng([lat, lng]);
                }
                
                if(detectButton) {
                    detectButton.textContent = 'Detect My Location';
                    detectButton.disabled = false;
                }
                if (onCompleteCallback) {
                    onCompleteCallback(lat, lng, null);
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Could not detect your location. Adjust marker manually.');
                if(detectButton) {
                    detectButton.textContent = 'Detect My Location';
                    detectButton.disabled = false;
                }
                if (onCompleteCallback) {
                    onCompleteCallback(null, null, error);
                }
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
        if (onCompleteCallback) {
            onCompleteCallback(null, null, new Error('Geolocation not supported'));
        }
    }
}

export function getMarkerLatLng() {
    return markerInstance ? markerInstance.getLatLng() : null;
}