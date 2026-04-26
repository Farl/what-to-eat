import { COLORS } from './constants.js';

let totalDegrees = 0; // Tracks the cumulative rotation for the wheel logic
let currentAnimationDuration = 5000; // Default spin duration in ms, will be updated from main.js
let wheelIsSetup = false; // Flag to indicate if wheel has been drawn at least once

export function isWheelSetup() {
    return wheelIsSetup;
}

export function setSpinTime(durationMs) {
    currentAnimationDuration = durationMs;
}

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
    const baseWidth = 300; 
    const baseHeight = 300;

    const width = baseWidth * scale;
    const height = baseHeight * scale;

    canvasElement.width = width;
    canvasElement.height = height;

    canvasElement.style.width = `${baseWidth}px`;
    canvasElement.style.height = `${baseHeight}px`;

    const ctx = canvasElement.getContext('2d');
    ctx.scale(scale, scale); 

    ctx.clearRect(0, 0, baseWidth, baseHeight);

    // Use all restaurants provided (already filtered by main.js)
    const displayRestaurants = (restaurants && restaurants.length > 0) ? restaurants : [];
    const numSegments = displayRestaurants.length;
    
    wheelIsSetup = numSegments > 0;

    if (numSegments === 0) {
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No restaurants to display',
            baseWidth / 2,
            baseHeight / 2
        );
        canvasElement.style.transform = 'rotate(0deg)';
        totalDegrees = 0; 
        return;
    }

    const segmentAngle = (2 * Math.PI) / numSegments; 
    const centerX = baseWidth / 2;
    const centerY = baseHeight / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.imageSmoothingEnabled = true;

    for (let i = 0; i < numSegments; i++) { 
        const currentAngleStart = (i * segmentAngle) - (Math.PI / 2);
        const currentAngleEnd = ((i + 1) * segmentAngle) - (Math.PI / 2);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngleStart, currentAngleEnd);
        ctx.closePath();

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

        let fontSize = 10; 
        if (numSegments <= 50) fontSize = 10; 
        if (numSegments <= 30) fontSize = 11;
        if (numSegments <= 20) fontSize = 12;
        if (numSegments <= 10) fontSize = 14;
        if (numSegments <= 5) fontSize = 16;

        ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let shortName = displayRestaurants[i].name;
        const textXPosition = radius * 0.3;
        const maxTextWidth = radius * 0.7; 

        if (ctx.measureText(shortName).width > maxTextWidth && shortName.length > 0) {
            while (ctx.measureText(shortName + '...').width > maxTextWidth && shortName.length > 1) {
                shortName = shortName.substring(0, shortName.length - 1);
            }
            shortName += '...';
        }
        
        if (fontSize >= 8 && radius * 0.3 < radius * 0.9) { 
             ctx.fillText(shortName, textXPosition, 0);
        }

        ctx.restore();
    }

    canvasElement.style.transform = `rotate(${totalDegrees % 360}deg)`;
    canvasElement.style.transition = 'transform 0.1s ease-out';
}

export function spinWheel(canvasElement, restaurants, durationSeconds, onSpinCompleteCallback) {
    const numSegments = restaurants.length; 
    if (numSegments === 0) {
         if (onSpinCompleteCallback) onSpinCompleteCallback(null, "Cannot spin, no restaurants available.");
         return;
    }

    const effectiveDurationSeconds = durationSeconds;
    currentAnimationDuration = effectiveDurationSeconds * 1000;

    const baseRotations = Math.floor(Math.random() * 5) + 5; 
    const segmentAngleDegrees = 360 / numSegments;
    const targetIndex = Math.floor(Math.random() * numSegments);
    const angleToTargetCenter = (targetIndex * segmentAngleDegrees) + (segmentAngleDegrees / 2);
    const randomOffsetWithinSegment = (Math.random() * (segmentAngleDegrees * 0.8)) - (segmentAngleDegrees * 0.4);
    const finalAngleRelative = (360 - angleToTargetCenter + randomOffsetWithinSegment);
    
    let newTotalDegrees = totalDegrees + (baseRotations * 360) + finalAngleRelative;
    while (newTotalDegrees < totalDegrees + (baseRotations -1) * 360) { 
        newTotalDegrees += 360;
    }
    totalDegrees = newTotalDegrees;

    canvasElement.style.transition = `transform ${effectiveDurationSeconds}s cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
    canvasElement.style.transform = `rotate(${totalDegrees}deg)`;

    const spinDurationMs = effectiveDurationSeconds * 1000;

    setTimeout(() => {
        const selectedIndex = getSelectedRestaurantIndex(totalDegrees, numSegments);

        if (selectedIndex < 0 || selectedIndex >= numSegments || !restaurants[selectedIndex]) {
            console.error("Error selecting restaurant from wheel. Index:", selectedIndex, "Restaurants displayed:", numSegments, "Final Degrees:", totalDegrees);
            if (onSpinCompleteCallback) onSpinCompleteCallback(null, "Oops! Something went wrong with the spin. Please try again.");
            return;
        }
        const selectedRestaurant = restaurants[selectedIndex];
        const finalVisualAngle = (totalDegrees % 360 + 360) % 360;
        
        canvasElement.style.transition = 'none'; 
        canvasElement.style.transform = `rotate(${finalVisualAngle}deg)`;
        
        setTimeout(() => {
        }, 50);

        if (onSpinCompleteCallback) onSpinCompleteCallback(selectedRestaurant, null);

    }, spinDurationMs + 100); 
}

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

function getSelectedRestaurantIndex(currentTotalDegrees, numSections) {
    if (numSections === 0) return -1;
    const sectionAngleDegrees = 360 / numSections;

    let pointerLandingAngle = (360 - (currentTotalDegrees % 360) + 360) % 360;

    const selectedIndex = Math.floor(pointerLandingAngle / sectionAngleDegrees);

    return Math.min(selectedIndex, numSections - 1);
}