// Replaces previous Leaflet-based map.js
let googleMap = null;
let googleMarker = null;
let googleCircle = null;
let onMarkerDragEndCallbackGlobal = null;
let onLocationDetectedCallbackGlobal = null;

export function initMap(mapElement, initialLat, initialLng, initialZoom, onMarkerDragEndCb, onLocationDetectedCb) {
    onMarkerDragEndCallbackGlobal = onMarkerDragEndCb;
    onLocationDetectedCallbackGlobal = onLocationDetectedCb;

    const initialMapCenter = { lat: initialLat, lng: initialLng };

    googleMap = new google.maps.Map(mapElement, {
        center: initialMapCenter,
        zoom: initialZoom,
        mapTypeControl: false,
        streetViewControl: false,
    });

    googleMarker = new google.maps.Marker({
        position: initialMapCenter,
        map: googleMap,
        draggable: true,
        title: "Drag me!"
    });

    googleMarker.addListener('dragend', () => {
        const newPosition = googleMarker.getPosition();
        if (googleCircle) {
            googleCircle.setCenter(newPosition);
        }
        if (onMarkerDragEndCallbackGlobal) {
            onMarkerDragEndCallbackGlobal(newPosition.lat(), newPosition.lng());
        }
    });
    
    // Attempt to geolocate on load AFTER map is initialized
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const userLocation = { lat: userLat, lng: userLng };
                
                googleMap.setCenter(userLocation);
                googleMap.setZoom(13);
                googleMarker.setPosition(userLocation);
                if (googleCircle) {
                    googleCircle.setCenter(userLocation);
                }
                if (onLocationDetectedCallbackGlobal) {
                    onLocationDetectedCallbackGlobal(userLat, userLng);
                }
            },
            (error) => {
                console.warn('Could not auto-detect location on load:', error.message);
                // Fallback to initial marker position for callback
                const currentLatLng = googleMarker.getPosition();
                if (onLocationDetectedCallbackGlobal) {
                    onLocationDetectedCallbackGlobal(currentLatLng.lat(), currentLatLng.lng());
                }
            }
        );
    } else {
        // Geolocation not supported, use initial marker position
        const currentLatLng = googleMarker.getPosition();
        if (onLocationDetectedCallbackGlobal) {
            onLocationDetectedCallbackGlobal(currentLatLng.lat(), currentLatLng.lng());
        }
    }
    
    return { map: googleMap, marker: googleMarker };
}

export function createRadiusCircle(latLng, initialRadiusKm) {
    if (googleMap) {
        googleCircle = new google.maps.Circle({
            strokeColor: '#e74c3c',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#e74c3c',
            fillOpacity: 0.2,
            map: googleMap,
            center: latLng,
            radius: initialRadiusKm * 1000
        });
    }
    return googleCircle;
}

export function updateMapCircleRadius(distanceKm) {
    if (googleCircle) {
        googleCircle.setRadius(distanceKm * 1000);
    }
}

export function detectUserLocation(detectButton, onCompleteCallback) {
    if (navigator.geolocation) {
        if (detectButton) {
            detectButton.textContent = 'Detecting...';
            detectButton.disabled = true;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const newLocation = { lat: lat, lng: lng };

                googleMap.setCenter(newLocation);
                googleMap.setZoom(13);
                googleMarker.setPosition(newLocation);
                if (googleCircle) {
                    googleCircle.setCenter(newLocation);
                }
                
                if (detectButton) {
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
                if (detectButton) {
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
    if (googleMarker) {
        const position = googleMarker.getPosition();
        return { lat: position.lat(), lng: position.lng() };
    }
    return null;
}

// This function needs to be globally accessible for the Google Maps API callback
window.onGoogleMapsApiLoaded = () => {
    // This is a placeholder. The actual map initialization logic will be triggered 
    // from main.js after the script loads. main.js will set a flag or resolve a promise.
    console.log("Google Maps API script loaded successfully.");
    if(window.resolveGoogleMapsLoaded) {
        window.resolveGoogleMapsLoaded();
    }
};