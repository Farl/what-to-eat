import { COLORS } from './constants.js';

let totalDegrees = 0; // Tracks the cumulative rotation for the wheel logic
const MAX_DISPLAY_SEGMENTS = 50; // Limit the number of segments displayed on the wheel

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function setupWheelVisuals(canvasElement, restaurants) {
    // Increase canvas resolution
    const scale = window.devicePixelRatio || 1;
    const baseWidth = 300; // Use fixed base size from HTML
    const baseHeight = 300; // Use fixed base size from HTML

    const width = baseWidth * scale;
    const height = baseHeight * scale;

    // Set actual canvas size for drawing
    canvasElement.width = width;
    canvasElement.height = height;

    // Set CSS size for display
    canvasElement.style.width = `${baseWidth}px`;
    canvasElement.style.height = `${baseHeight}px`;

    const ctx = canvasElement.getContext('2d');
    ctx.scale(scale, scale); // Scale drawing operations

    // Clear canvas using the base size coordinates due to scale
    ctx.clearRect(0, 0, baseWidth, baseHeight);

    const displayRestaurants = (restaurants && restaurants.length > 0) ? restaurants.slice(0, MAX_DISPLAY_SEGMENTS) : [];
    const numSegments = displayRestaurants.length;

    if (numSegments === 0) {
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        // Position text in the center of the base size area
        ctx.fillText('No restaurants to display',
            baseWidth / 2,
            baseHeight / 2
        );
        // Reset rotation state - keep transition as none or default
        canvasElement.style.transform = 'rotate(0deg)';
        totalDegrees = 0; // Reset totalDegrees if no segments
        return;
    }

    const segmentAngle = (2 * Math.PI) / numSegments; // Divide based on actual number of segments
    const centerX = baseWidth / 2;
    const centerY = baseHeight / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.imageSmoothingEnabled = true; // Ensure anti-aliasing

    for (let i = 0; i < numSegments; i++) { // Loop for the actual number of segments
        const currentAngleStart = (i * segmentAngle) - (Math.PI / 2);
        const currentAngleEnd = ((i + 1) * segmentAngle) - (Math.PI / 2);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngleStart, currentAngleEnd);
        ctx.closePath();

        // Use solid color instead of gradient
        const sliceColorHex = COLORS[i % COLORS.length];
        ctx.fillStyle = sliceColorHex;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        const textAngle = currentAngleStart + segmentAngle / 2;
        ctx.rotate(textAngle);

        const rgb = hexToRgb(sliceColorHex);
        if (rgb) {
            const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
            ctx.fillStyle = luminance < 0.4 ? '#fff' : '#000';
        } else {
            ctx.fillStyle = '#000';
        }

        // Dynamically adjust font size based on number of segments
        let fontSize = 10;
        if (numSegments <= 20) fontSize = 12;
        if (numSegments <= 10) fontSize = 14;
        if (numSegments <= 5) fontSize = 16;

        ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let shortName = displayRestaurants[i].name;
        const textXPosition = radius * 0.3;
        const maxTextWidth = radius * 0.7;

        // Truncate text if it's too long
        if (ctx.measureText(shortName).width > maxTextWidth && shortName.length > 0) {
            while (ctx.measureText(shortName + '...').width > maxTextWidth && shortName.length > 1) {
                shortName = shortName.substring(0, shortName.length - 1);
            }
            shortName += '...';
        }

        // Only render text if font size is legible and space permits
        if (fontSize >= 8 && radius * 0.3 < radius * 0.9) {
             ctx.fillText(shortName, textXPosition, 0);
        }

        ctx.restore();
    }

    // The transition is now managed in spinWheel based on the duration slider
    // We just need to ensure the wheel is rendered at the correct current rotation
    // Apply the current totalDegrees rotation
    canvasElement.style.transform = `rotate(${totalDegrees % 360}deg)`;
}

export function spinWheel(canvasElement, restaurants, onSpinCompleteCallback) {
    const numSegments = Math.min(restaurants.length, MAX_DISPLAY_SEGMENTS);
    if (numSegments === 0) {
         if (onSpinCompleteCallback) onSpinCompleteCallback(null, "Cannot spin, no restaurants available.");
         return { isSpinning: false, selectedRestaurant: null };
    }

    const spinDurationRange = document.getElementById('spin-duration-range');
    const durationSeconds = parseFloat(spinDurationRange ? spinDurationRange.value : 5); // Get duration from slider, default to 5

    // Determine base rotations needed to land on a segment plus random offset
    // Ensure enough rotations for visual effect
    const baseRotations = Math.floor(Math.random() * 5) + 5; // Spin at least 5 full times
    const segmentAngleDegrees = 360 / numSegments;

    // Pick a random target index
    const targetIndex = Math.floor(Math.random() * numSegments);

    // Calculate the rotation needed to land the pointer *precisely* in the middle of the target segment.
    // The segments are laid out clockwise from the top (0 degrees).
    // The center of segment `targetIndex` is at `targetIndex * segmentAngleDegrees + segmentAngleDegrees / 2`.
    // The rotation needed to bring this center to the top (pointer position, 0 degrees) is `360 - (targetIndex * segmentAngleDegrees + segmentAngleDegrees / 2)`.
    // Add full spins and a random offset within the target segment (not too close to edges).
    const angleToTargetCenter = (targetIndex * segmentAngleDegrees) + (segmentAngleDegrees / 2);
    const randomOffsetWithinSegment = (Math.random() * (segmentAngleDegrees * 0.8)) - (segmentAngleDegrees * 0.4); // Offset between -40% and +40% of segment angle
    const finalAngleRelative = (360 - angleToTargetCenter + randomOffsetWithinSegment);

    // The total rotation is previous total + full spins + calculated relative angle
    // Add a large multiple of 360 to ensure forward spin from current position
    const fullSpinsOffset = Math.ceil(Math.abs(totalDegrees) / 360) * 360; // Ensure we spin forward enough from current position
    const finalAngle = fullSpinsOffset + (baseRotations * 360) + finalAngleRelative;


    // Calculate the new cumulative total degrees
    totalDegrees += finalAngle;

    // Apply the transformation with dynamic duration
    canvasElement.style.transition = `transform ${durationSeconds}s cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
    canvasElement.style.transform = `rotate(${totalDegrees}deg)`;

    const spinDurationMs = durationSeconds * 1000;

    setTimeout(() => {
        // Calculate selected index based on the final cumulative rotation
        // The getSelectedRestaurantIndex function already handles the angle logic
        const selectedIndex = getSelectedRestaurantIndex(totalDegrees, numSegments);

        if (selectedIndex < 0 || selectedIndex >= numSegments || !restaurants[selectedIndex]) {
            console.error("Error selecting restaurant from wheel. Index:", selectedIndex, "Restaurants displayed:", numSegments);
            if (onSpinCompleteCallback) onSpinCompleteCallback(null, "Oops! Something went wrong with the spin. Please try again.");
            return;
        }
        const selectedRestaurant = restaurants[selectedIndex];

        // Calculate the final visual angle for the CSS transform after the spin
        // This angle should be normalized to 0-360 for the final display state.
        // Use the cumulative totalDegrees to find the equivalent angle within one rotation.
        // This does NOT reset totalDegrees, only updates the CSS property.
        const finalVisualAngle = (totalDegrees % 360 + 360) % 360;

        // Temporarily disable transition to snap to the precise final visual angle
        canvasElement.style.transition = 'none';
        canvasElement.style.transform = `rotate(${finalVisualAngle}deg)`;

        // Re-enable transition for future spins
        // Add a small delay to ensure transition is off before re-enabling
        // This allows the browser to apply the 'none' transition style before setting the new transform
        setTimeout(() => {
             canvasElement.style.transition = ''; // Remove inline style to allow future JS setting
        }, 50);


        if (onSpinCompleteCallback) onSpinCompleteCallback(selectedRestaurant, null);

    }, spinDurationMs + 100); // A small delay after the transition finishes
}

// Helper function to lighten or darken a hex color
function lightenDarkenColor(hex, amount) {
    let usePound = false;
  
    if (hex[0] === "#") {
        hex = hex.slice(1);
        usePound = true;
    }
 
    const num = parseInt(hex, 16);
 
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
 
    let g = ((num >> 8) & 0x00FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
 
    let b = (num & 0x0000FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
 
    return (usePound ? "#" : "") + (g | (r << 8) | (b << 16)).toString(16).padStart(6, '0');
}

// Helper function to get the index of the selected segment
function getSelectedRestaurantIndex(currentTotalDegrees, numSections) {
    if (numSections === 0) return -1;
    const sectionAngleDegrees = 360 / numSections;

    // Calculate the angle where the pointer landed on the wheel (0-360 range)
    // The pointer is at the top (0 degrees). The wheel rotated by `currentTotalDegrees`.
    // A point originally at angle `A` is now at `A + currentTotalDegrees`.
    // We want to find the original angle `A` that is now at the pointer position (0 degrees).
    // A + currentTotalDegrees = 0 + n*360  => A = -currentTotalDegrees + n*360
    // Normalize A to 0-360 range: `A_normalized = (-currentTotalDegrees % 360 + 360) % 360`.
    let pointerLandingAngle = (360 - (currentTotalDegrees % 360) + 360) % 360;

    // Segments are laid out clockwise from the top (0 degrees).
    // Segment 0: 0 to angle
    // Segment 1: angle to 2*angle
    // Segment i: i*angle to (i+1)*angle
    // The index is floor(pointerLandingAngle / sectionAngleDegrees)
    const selectedIndex = Math.floor(pointerLandingAngle / sectionAngleDegrees);

    // Ensure index is within bounds (should be if logic is correct)
    return Math.min(selectedIndex, numSections - 1);
}