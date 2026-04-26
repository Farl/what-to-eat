import { RELEVANT_PLACE_TYPES, GENERIC_PLACE_TYPES } from './constants.js';

// Store the PlacesService instance to reuse it
let placesServiceInstance = null;
const MAX_PAGES_PER_KEYWORD_SEARCH = 3; // Max pages Google API provides (1 initial + 2 next)

function getPlacesService(mapInstance) {
    if (!placesServiceInstance && mapInstance) {
        placesServiceInstance = new google.maps.places.PlacesService(mapInstance);
    }
    return placesServiceInstance;
}

// Helper to extract meaningful cuisine types
function extractCuisineFromTypes(types) {
    if (!types || types.length === 0) return 'Restaurant'; 

    let specificCuisines = types.filter(type => !GENERIC_PLACE_TYPES.includes(type) && type !== 'restaurant');
    
    const relevantMatched = specificCuisines.filter(type => RELEVANT_PLACE_TYPES.includes(type));
    if (relevantMatched.length > 0) {
        specificCuisines = relevantMatched;
    }

    if (specificCuisines.length > 0) {
        return specificCuisines.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join('; ');
    }
    
    if (types.includes('restaurant')) return 'Restaurant';
    if (types.includes('cafe')) return 'Cafe';
    if (types.includes('bar')) return 'Bar';
    if (types.includes('bakery')) return 'Bakery';

    const fallbackCuisines = types.filter(type => !GENERIC_PLACE_TYPES.includes(type));
    return fallbackCuisines.length > 0 ? fallbackCuisines.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join('; ') : 'Eatery';
}


async function fetchPaginatedResultsForKeyword(apiKey, lat, lon, radiusMeters, mapInstance, keyword) {
    const placesService = getPlacesService(mapInstance);
    if (!placesService) {
        console.error("Google Places Service not initialized for keyword search:", keyword);
        return { restaurants: [], cuisines: new Set() };
    }

    let keywordRestaurants = [];
    let keywordCuisinesSet = new Set();
    let pagesFetched = 0;

    return new Promise((resolve, reject) => {
        const processPageResults = (results, status, pagination) => {
            pagesFetched++;

            if (status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                if (results && results.length > 0) {
                    const processedPageRestaurants = results
                        .filter(place => 
                            place.name && 
                            place.geometry && 
                            place.geometry.location && 
                            (!place.business_status || place.business_status === "OPERATIONAL") &&
                            (place.types && (place.types.includes('restaurant') || place.types.includes('cafe') || place.types.includes('food') || RELEVANT_PLACE_TYPES.some(rt => place.types.includes(rt))))
                        ) 
                        .map(place => {
                            const cuisine = extractCuisineFromTypes(place.types);
                            cuisine.split(';').map(c => c.trim()).filter(Boolean).forEach(c => keywordCuisinesSet.add(c));
                            return {
                                id: place.place_id,
                                name: place.name,
                                lat: place.geometry.location.lat(),
                                lon: place.geometry.location.lng(),
                                cuisine: cuisine,
                                opening_hours_info: place.opening_hours || null,
                                rating: place.rating || null,
                                user_ratings_total: place.user_ratings_total || null,
                                address: place.vicinity || 'Address not available',
                                google_types: place.types || [],
                            };
                        });
                    keywordRestaurants.push(...processedPageRestaurants);
                }

                if (pagination && pagination.hasNextPage && pagesFetched < MAX_PAGES_PER_KEYWORD_SEARCH) {
                    setTimeout(() => {
                        try {
                            pagination.nextPage(); 
                        } catch (e) {
                            console.error(`Error calling nextPage() for keyword "${keyword}":`, e);
                            resolve({ restaurants: keywordRestaurants, cuisines: keywordCuisinesSet });
                        }
                    }, 2000); 
                } else {
                    resolve({ restaurants: keywordRestaurants, cuisines: keywordCuisinesSet });
                }
            } else {
                console.error(`Google Places API error for keyword "${keyword}": ${status} on page ${pagesFetched}`);
                if (keywordRestaurants.length > 0) {
                    resolve({ restaurants: keywordRestaurants, cuisines: keywordCuisinesSet });
                } else {
                    reject(new Error(`Google Places API error for keyword "${keyword}": ${status}`));
                }
            }
        };
        
        const request = {
            location: new google.maps.LatLng(lat, lon),
            radius: radiusMeters.toString(),
            keyword: keyword 
        };
        
        try {
            placesService.nearbySearch(request, processPageResults);
        } catch (e) {
            console.error(`Error initiating nearbySearch for keyword "${keyword}":`, e);
            reject(new Error(`Failed to initiate search for keyword "${keyword}".`));
        }
    });
}

export async function fetchRestaurantsFromAPI(apiKey, lat, lon, radiusKm, mapInstance) {
    const searchKeywords = ['restaurant', 'cafe', 'food']; // Example: search for these primary terms sequentially
    
    let combinedRestaurantsList = [];
    let combinedCuisinesSet = new Set();
    const radiusMeters = radiusKm * 1000;

    for (const keyword of searchKeywords) {
        console.log(`Fetching restaurants for keyword: ${keyword}`);
        try {
            const { restaurants: keywordRestaurants, cuisines: keywordCuisines } = await fetchPaginatedResultsForKeyword(
                apiKey, lat, lon, radiusMeters, mapInstance, keyword
            );
            combinedRestaurantsList.push(...keywordRestaurants);
            keywordCuisines.forEach(c => combinedCuisinesSet.add(c));
        } catch (error) {
            console.warn(`Error fetching or processing results for keyword "${keyword}":`, error.message);
            // Continue with other keywords even if one fails
        }
    }

    // De-duplicate restaurants based on place.id
    const uniqueRestaurantsMap = new Map();
    combinedRestaurantsList.forEach(r => {
        if (!uniqueRestaurantsMap.has(r.id)) {
            uniqueRestaurantsMap.set(r.id, r);
        }
        // If a restaurant is found by multiple keywords, the first encounter is kept.
        // One could implement merging logic here if desired, but it's complex.
    });
    
    let allRestaurants = Array.from(uniqueRestaurantsMap.values());

    // Sort all collected restaurants by rating then by number of reviews
    allRestaurants.sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
    });
    
    const sortedCuisines = Array.from(combinedCuisinesSet).sort((a, b) => a.localeCompare(b));
    
    console.log(`Total unique restaurants found: ${allRestaurants.length}`);
    console.log(`Total unique cuisines found: ${sortedCuisines.length}`);

    return {
        restaurants: allRestaurants,
        cuisines: sortedCuisines
    };
}