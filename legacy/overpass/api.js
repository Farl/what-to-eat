import { OVERPASS_API_URL } from './constants.js';

export async function fetchRestaurantsFromAPI(lat, lon, radiusKm) { 
    const radiusMeters = radiusKm * 1000;
    const query = `
        [out:json][timeout:45];
        (
          node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
          way["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
          relation["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
          
          // Additional cuisine types - query widely, filter specifically later
          node["cuisine"](around:${radiusMeters},${lat},${lon});
          way["cuisine"](around:${radiusMeters},${lat},${lon});
          relation["cuisine"](around:${radiusMeters},${lat},${lon});
          
          // Additional food-related amenities - query widely
          node["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});
          way["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});
          relation["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});
          
          node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
          way["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
          relation["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
        );
        out tags center; 
    `;

    try {
        const response = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.statusText}`);
        }
        const data = await response.json();
        
        let processedRestaurants = data.elements.map(el => {
            // Collect all potentially relevant tags for cuisine
            const rawCuisines = [];
            if (el.tags?.cuisine) {
                rawCuisines.push(...el.tags.cuisine.split(';').map(c => c.trim()));
            }
             if (el.tags?.["food_menu"]) {
                rawCuisines.push(...el.tags["food_menu"].split(';').map(c => c.trim()));
            }
            // Add amenity if it's a specific food type and not already covered
             if (el.tags?.amenity && (el.tags.amenity === 'fast_food' || el.tags.amenity === 'cafe') && !rawCuisines.includes(el.tags.amenity)) {
                 rawCuisines.push(el.tags.amenity);
             }
             // Add 'restaurant' amenity if no specific cuisine is found, but it's tagged as a restaurant
             if (rawCuisines.length === 0 && el.tags?.amenity === 'restaurant') {
                 rawCuisines.push('Restaurant'); // Use a capitalized generic term
             }


            return {
                name: el.tags?.name || el.tags?.["name:en"] || 'Unnamed Eatery',
                // Store all collected unique cuisine tags, cleaned up
                cuisine: [...new Set(rawCuisines.filter(Boolean))].join('; '), // Store as a semicolon-separated string
                opening_hours: el.tags?.opening_hours || null,
                disused: el.tags?.disused || null, 
                shop: el.tags?.shop || null,       
                lat: el.lat || el.center?.lat, 
                lon: el.lon || el.center?.lon,
                id: el.id,
                additional_tags: el.tags || {} // Keep original tags for debugging/future use
            };
        });

        // Filter out problematic entries *before* further processing
        processedRestaurants = processedRestaurants.filter(r => {
            // Remove entries without name or location
            if (!r.name || r.name === 'Unnamed Eatery' || !r.lat || !r.lon) return false;
            
            // Filter out closed or permanently closed places based on common tags
            if (r.disused === 'yes' || r.shop === 'vacant' || r.additional_tags?.['check_date:closed'] || r.additional_tags?.lifecycle === 'disused' || r.additional_tags?.lifecycle === 'abandoned') return false;
            
            // Additional closure checks in opening_hours
            const ohLower = (r.opening_hours || '').toLowerCase();
            const closedKeywords = ['closed', 'off', 'permanently closed', 'permanently_closed', 'no'];
            if (closedKeywords.some(keyword => ohLower.includes(keyword))) return false;
            
            // Must have at least some form of identified food/restaurant type
            if (!r.cuisine || r.cuisine === 'Unknown' || r.cuisine === 'Restaurant') { // Include 'Restaurant' here if we want to filter generics unless no specifics are found
                // Exception: If amenity is 'restaurant' AND we have opening hours or website/phone, keep it.
                if (r.additional_tags?.amenity === 'restaurant' && (r.opening_hours || r.additional_tags?.website || r.additional_tags?.phone)) {
                    return true;
                }
                // Otherwise, filter out generic or unknown types if no specific cuisine is listed.
                const hasSpecificCuisine = (r.cuisine || '').split(';').map(c => c.trim()).filter(Boolean).some(c => c !== 'Unknown' && c !== 'Restaurant');
                 if (!hasSpecificCuisine) return false;
            }

            return true;
        });
        
        // Prioritize restaurants with more information
        processedRestaurants.sort((a, b) => {
            // Prefer restaurants with specific cuisine info over generic 'Restaurant'
            const cuisineScoreA = (a.cuisine || '').split(';').filter(c => c.trim() !== 'Unknown' && c.trim() !== 'Restaurant').length > 0 ? 2 : (a.cuisine === 'Restaurant' ? 1 : 0);
            const cuisineScoreB = (b.cuisine || '').split(';').filter(c => c.trim() !== 'Unknown' && c.trim() !== 'Restaurant').length > 0 ? 2 : (b.cuisine === 'Restaurant' ? 1 : 0);
            
            // Prefer entries with opening hours or contact info
            const infoScoreA = (a.opening_hours || a.additional_tags?.website || a.additional_tags?.phone) ? 1 : 0;
            const infoScoreB = (b.opening_hours || b.additional_tags?.website || b.additional_tags?.phone) ? 1 : 0;
            
            // Combine scores and sort
            const totalScoreA = cuisineScoreA + infoScoreA;
            const totalScoreB = cuisineScoreB + infoScoreB;
            
            return totalScoreB - totalScoreA || a.name.localeCompare(b.name);
        });
        
        // Limit the number of restaurants returned after sorting
        const MAX_RESTAURANTS = 200;
         if (processedRestaurants.length > MAX_RESTAURANTS) {
             processedRestaurants = processedRestaurants.slice(0, MAX_RESTAURANTS);
         }

        // De-duplicate based on name and location (simple check)
        const uniqueRestaurantsMap = new Map();
        processedRestaurants.forEach(r => {
            const key = `${r.name}-${r.lat ? r.lat.toFixed(4) : ''}-${r.lon ? r.lon.toFixed(4) : ''}`;
            if (!uniqueRestaurantsMap.has(key)) {
                uniqueRestaurantsMap.set(key, r);
            }
        });
        const uniqueRestaurants = Array.from(uniqueRestaurantsMap.values());


        // Collect unique *individual* cuisine tags from the *final* list of restaurants
        const allCuisines = [...new Set(uniqueRestaurants
            .flatMap(r => (r.cuisine || '').split(';').map(c => c.trim())) // Split multi-valued strings and flatten
            .filter(c => Boolean(c) && c !== 'Unknown' && c !== 'Restaurant') // Filter out empty, 'Unknown', and generic 'Restaurant' tags
        )];

        // Add 'Restaurant' back if it exists on any item and no specific cuisines are found, or if it's the only type
        if (uniqueRestaurants.some(r => (r.cuisine || '').split(';').map(c=>c.trim()).includes('Restaurant'))) {
             // Decide if 'Restaurant' should *always* be an option if present, or only if no specifics?
             // Let's add it if it exists on any restaurant, but keep it lower priority in sort.
             // The flatMap above already filtered it out. Add it back if needed.
             // Better: just let it be included in the filterable list if any restaurant is tagged ONLY as 'Restaurant'
             // Actually, the filtering logic in main.js should handle 'Unknown' and 'Restaurant' correctly.
             // Let's make sure 'Restaurant' is included in the allCuisines list if it appears on any restaurant.
             const genericRestaurantCuisines = uniqueRestaurants.flatMap(r => (r.cuisine || '').split(';').map(c => c.trim())).filter(c => c === 'Restaurant');
             if (genericRestaurantCuisines.length > 0 && !allCuisines.includes('Restaurant')) {
                 allCuisines.push('Restaurant'); // Add generic if it exists on filtered list
             }
        }


        return {
            restaurants: uniqueRestaurants, 
            cuisines: allCuisines.sort((a, b) => a.localeCompare(b)) // Sort cuisines alphabetically
        };

    } catch (error) {
        console.error('Error fetching restaurants:', error);
        ui.alertMessage('Could not fetch restaurants. Please try again later or adjust criteria.'); // Use ui.alertMessage
        return { restaurants: [], cuisines: [] };
    }
}