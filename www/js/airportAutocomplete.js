import { appState, updateState } from './stateManager.js';
import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { flightMap } from './flightMap.js';

async function fetchAirports(query) {
    try {
        const response = await fetch(`https://yonderhop.com/api/airports?query=${query}`);
        return await response.json();
    } catch (error) {
        console.warn('Airport not found');
        return [];
    }
}

async function fetchAirportByIata(iata) {
    try {
        const response = await fetch(`https://yonderhop.com/api/airports?iata=${iata}`);
        const airports = await response.json();
        return airports.length > 0 ? airports[0] : null;
    } catch (error) {
        console.error('Failed to fetch airport data', error);
        return null;
    }
}

function setupAutocompleteForField(fieldId) {
    const inputField = document.getElementById(fieldId);
    const suggestionBox = document.getElementById(fieldId + 'Suggestions');
    let selectionMade = false; // Track if a selection has been made
    let initialInputValue = ""; // Store the initial input value on focus
    let currentFocus = -1; // Track the currently focused item in the suggestion box

    // Disable browser autofill
    inputField.setAttribute('autocomplete', 'new-password');
    inputField.setAttribute('name', 'waypoint-' + Date.now());
    inputField.setAttribute('readonly', true);
    inputField.addEventListener('focus', () => {
        inputField.removeAttribute('readonly');
        toggleSuggestionBox(true);
        initialInputValue = inputField.value; // Store the initial value on focus
    });

    inputField.addEventListener('focus', async () => {
        inputField.removeAttribute('readonly');
        toggleSuggestionBox(true);
        initialInputValue = inputField.value; // Store the initial value on focus

        // New functionality to center map on airport
        const iataCode = inputField.getAttribute('data-selected-iata') || getIataFromField(fieldId);
        if (iataCode) {
            const airport = await fetchAirportByIata(iataCode);
            if (airport && airport.latitude && airport.longitude) {
                map.flyTo([airport.latitude, airport.longitude], 6, {
                    animate: true,
                    duration: 0.5 // Adjust duration as needed
                });
            }
        }
    });

    inputField.addEventListener('input', async () => {
        const airports = await fetchAirports(inputField.value);
        updateSuggestions(fieldId, airports, (value) => selectionMade = value);
        selectionMade = false; // Reset selection flag on new input
    });

    const toggleSuggestionBox = (display) => {
        suggestionBox.style.display = display ? 'block' : 'none';
        if (display) {
            const rect = inputField.getBoundingClientRect();
            suggestionBox.style.left = `${rect.left}px`;
            suggestionBox.style.top = `${rect.bottom}px`;
        }
    };

    const clearInputField = (inputField) => {
        const currentInputValue = inputField.value;
        const selectedIata = inputField.getAttribute('data-selected-iata');
        const isCurrentIataValid = currentInputValue.includes(selectedIata);
        if (!selectionMade && !isCurrentIataValid && initialInputValue !== currentInputValue) {
            inputField.value = '';
        }
    };

    const outsideClickListener = (e) => {
        if (!inputField.contains(e.target) && !suggestionBox.contains(e.target)) {
            toggleSuggestionBox(false);
            clearInputField(inputField); // Pass the correct inputField reference
        }
    };    

    // Add event listeners for focus, keydown, and blur
    inputField.addEventListener('focus', () => toggleSuggestionBox(true));
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleSuggestionBox(false);
            clearInputField();
        } else if (e.key === 'ArrowDown') {
            currentFocus++;
            updateActiveItem(suggestionBox.getElementsByTagName('div'));
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            updateActiveItem(suggestionBox.getElementsByTagName('div'));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1) {
                const items = suggestionBox.getElementsByTagName('div');
                if (items) items[currentFocus].click();
            }
        }
    });

    inputField.addEventListener('blur', () => {
        setTimeout(() => {
            clearInputField(inputField);
            toggleSuggestionBox(false);
        }, 300); // Delay to allow for selection
    });

    if (!window.outsideClickListenerAdded) {
        document.addEventListener('click', outsideClickListener);
        window.outsideClickListenerAdded = true;
    }

    function updateActiveItem(items) {
        if (!items || items.length === 0) return false;
        const itemsArray = Array.from(items);
        itemsArray.forEach(item => item.classList.remove('autocomplete-active'));
        currentFocus = ((currentFocus % itemsArray.length) + itemsArray.length) % itemsArray.length;
        const activeItem = itemsArray[currentFocus];
        if (activeItem) {
            activeItem.classList.add('autocomplete-active');
            activeItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'start'
            });
        }
    }         
}

let lastFetchedAirports = [];

function updateSuggestions(inputId, airports, setSelectionMade) {
    const suggestionBox = document.getElementById(inputId + 'Suggestions');
    suggestionBox.innerHTML = '';
    lastFetchedAirports = airports; // Update the last fetched airports whenever suggestions are updated
    
    airports.forEach(airport => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        let touchStartY = 0;
        let touchEndY = 0;

        function handleSelection(e) {
            // Only proceed if this was a tap, not a scroll
            if (Math.abs(touchEndY - touchStartY) < 10) {
                e.preventDefault(); // Prevent the default touchend action
                e.stopPropagation(); // Stop the event from propagating further
            
                const inputField = document.getElementById(inputId);
                inputField.value = `${airport.iata_code}`;
                suggestionBox.style.display = 'none';
                document.dispatchEvent(new CustomEvent('airportSelected', { 
                    detail: { airport, fieldId: inputId }
                }));
                inputField.setAttribute('data-selected-iata', airport.iata_code);
                setSelectionMade(true);
            }
        }
        
        div.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        div.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
        });

        div.addEventListener('touchend', handleSelection);                   
        suggestionBox.appendChild(div);
    });
    if (airports.length > 0) suggestionBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    setupAutocompleteForField('waypoint1');
    setupAutocompleteForField('waypoint2');

    document.addEventListener('newWaypointField', (event) => {
        setupAutocompleteForField(event.detail.fieldId);
        document.getElementById(event.detail.fieldId).focus();
    });

    document.addEventListener('airportSelected', (event) => {
        const { airport, fieldId } = event.detail;
        const waypointIndex = parseInt(fieldId.replace('waypoint', '')) - 1;
        const iata = airport.iata_code;
    
        // Check if the origin is empty and destination has a selection
        if (appState.routeDirection == 'from') {
            if (waypointIndex <= 1 && !document.getElementById('waypoint1').value) {
            updateState('routeDirection', 'to');
            }
        }

        if (appState.routeDirection == 'to') {
            if (waypointIndex <= 1 && !document.getElementById('waypoint2').value) {
            updateState('routeDirection', 'from');
            }
        }

        if (waypointIndex >= 0 && waypointIndex < appState.waypoints.length) {
            updateState('updateWaypoint', { index: waypointIndex, data: airport });
        } else {
            updateState('addWaypoint', airport);
        }
        appState.selectedAirport = airport;
        
        // Move map view to include the selected airport marker
        if (airport && airport.latitude && airport.longitude) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const currentLatLng = map.getCenter();
            const adjustedLatLng = adjustLatLngForShortestPath(currentLatLng, latLng);
            map.flyTo(adjustedLatLng, 4, {
                animate: true,
                duration: 0.5 // Duration in seconds
            });          
        }
        flightMap.fetchAndCacheRoutes(iata).then(() => {
            pathDrawing.drawRoutePaths(iata, appState.directRoutes, appState.routeDirection);
        });
    });    
    
    function adjustLatLngForShortestPath(currentLatLng, targetLatLng) {
        let currentLng = currentLatLng.lng;
        let targetLng = targetLatLng.lng;
        let lngDifference = targetLng - currentLng;
    
        // Check if crossing the antimeridian offers a shorter path
        if (lngDifference > 180) {
            targetLng -= 360;
        } else if (lngDifference < -180) {
            targetLng += 360;
        }
    
        return L.latLng(targetLatLng.lat, targetLng);
    }                                            
     
    document.addEventListener('stateChange', (event) => {
        if (event.detail.key === 'waypoints') {
            event.detail.value.forEach((_, index) => {
                setupAutocompleteForField(`waypoint${index + 1}`);
            });
        }
    });
});

export function getIataFromField(inputId) {
    const fieldValue = document.getElementById(inputId).value;
    const iataCodeMatch = fieldValue.match(/\b([A-Z]{3})\b/);
    return iataCodeMatch ? iataCodeMatch[1] : null;
}

export { setupAutocompleteForField, fetchAirportByIata }
