import { appState, updateState } from './stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from './airportAutocomplete.js';
import { uiHandling } from './uiHandling.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';
import { routeList } from './routeList.js';
import { mapHandling } from './mapHandling.js';

const routeHandling = {

    buildRouteDivs: function(routeNumber) {
        const container = document.querySelector('.airport-selection');
        const routeDivId = `route${routeNumber}`;
        let routeDiv = document.createElement('div');
        routeDiv.id = routeDivId;
        routeDiv.className = 'route-container';
        routeDiv.setAttribute('data-route-number', routeNumber.toString());
    
        // Define placeholders independently from the waypointsOrder
        let placeholders = ['From', 'To'];
    
        // Determine the order of waypoints based on routeDirection
        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber - 1) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint${index + 1}`;
            // Assign placeholders based on the original order, not waypointsOrder
            input.placeholder = placeholders[i];
            input.value = waypoint ? waypoint.iata_code : '';
    
            input.addEventListener('mouseover', async function() {
                const iataCode = this.value.match(/\b([A-Z]{3})\b/); // Extract IATA code using regex
                if (iataCode) {
                    const airportInfo = await fetchAirportByIata(iataCode[1]);
                    if (airportInfo) {
                        routeHandling.showWaypointTooltip(this, `${airportInfo.name} (${airportInfo.iata_code}) ${airportInfo.city}, ${airportInfo.country}`);
                    }
                }
            });
    
            input.addEventListener('mouseout', function() {
                routeHandling.hideWaypointTooltip();
            });
    
            routeDiv.appendChild(input);
    
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            routeDiv.appendChild(suggestionsDiv);
        }

         // Create a swap button with a symbol
        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility

        // Insert the swap button between the waypoint input fields
        let firstInput = routeDiv.querySelector('input[type="text"]');
        routeDiv.insertBefore(swapButton, firstInput.nextSibling);
    
        // Add a minus button for each route div
        if (routeNumber > 1) {
            let minusButton = document.createElement('button');
            minusButton.textContent = '-';
            minusButton.className = 'remove-route-button';
            minusButton.onclick = () => this.removeRouteDiv(routeNumber);
            routeDiv.appendChild(minusButton);
        }
    
        // Add event listeners to change the route line color on mouseover
        routeDiv.addEventListener('mouseover', () => {
            const routeId = this.getRouteIdFromDiv(routeDiv);
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                routeDiv.dataset.originalColor = pathLines[0].options.color;
                pathLines.forEach(path => path.setStyle({ color: 'white'}));
            }
        });
    
        routeDiv.addEventListener('mouseout', () => {
            const routeId = this.getRouteIdFromDiv(routeDiv);
            const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId];
            if (pathLines && pathLines.length > 0) {
                const originalColor = routeDiv.dataset.originalColor;
                pathLines.forEach(path => path.setStyle({ color: originalColor }));
            }
            pathDrawing.clearLines();
            pathDrawing.drawLines();
        });
    
        // Prepend the new route div so it appears above the last one if routeDirection is 'to'
        if (appState.routeDirection === 'to') {
            container.prepend(routeDiv);
        } else {
            container.appendChild(routeDiv);
        }
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber - 1) * 2 + i;
            setupAutocompleteForField(`waypoint${index + 1}`);
        }
        uiHandling.setFocusToNextUnsetInput();
        uiHandling.toggleTripButtonsVisibility();
    },
    
    handleSwapButtonClick: function(routeNumber) {
        let routeDiv = document.getElementById(`route${routeNumber}`);
        let inputs = routeDiv.querySelectorAll('input[type="text"]');
        if (inputs.length === 2) {
            // Swap the values of the input fields
            let temp = inputs[0].value;
            inputs[0].value = inputs[1].value;
            inputs[1].value = temp;
    
            // Update the appState.waypoints array
            let waypointIndex = (routeNumber - 1) * 2;
            [appState.waypoints[waypointIndex], appState.waypoints[waypointIndex + 1]] = 
                [appState.waypoints[waypointIndex + 1], appState.waypoints[waypointIndex]];
    
            routeHandling.updateRoutesArray();
        }
    },

    removeRouteDiv: function(routeNumber) {
        let routeDiv = document.getElementById(`route${routeNumber}`);
        if (routeDiv) {
            routeDiv.remove();
        }
    
        updateState('removeWaypoints', { routeNumber: routeNumber });
    
        pathDrawing.clearLines();
        pathDrawing.drawLines();
        mapHandling.updateMarkerIcons();
        routeList.updateEstPrice();
        this.updateRoutesArray();
    },
    
    getRouteIdFromDiv: function (routeDiv) {
        const inputs = routeDiv.querySelectorAll('input[type="text"]');
        if (inputs.length === 2) {
            const originIata = inputs[0].value;
            const destinationIata = inputs[1].value;
            return `${originIata}-${destinationIata}`;
        }
        return null;
    },

    showWaypointTooltip: function(element, text) {
        clearTimeout(this.tooltipTimeout);
    
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = document.createElement('div');
            tooltip.className = 'waypointTooltip';
            tooltip.textContent = text;
            document.querySelector('.container').appendChild(tooltip);
    
            const rect = element.getBoundingClientRect();
            const containerRect = document.querySelector('.container').getBoundingClientRect();
    
            tooltip.style.position = 'absolute';
            tooltip.style.left = `${rect.left - containerRect.left}px`;
            tooltip.style.top = `${rect.bottom - containerRect.top}px`;
        }, 300);
    },
    
    hideWaypointTooltip: function() {
        clearTimeout(this.tooltipTimeout);
    
        document.querySelectorAll('.waypointTooltip').forEach(tooltip => {
            tooltip.remove();
        });
    },                        

    updateRoutesArray: async function () {
        let newRoutes = [];
        let fetchPromises = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        for (let i = 0; i < waypoints.length - 1; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            // Fetch and cache routes if not already done
            if (!appState.directRoutes[fromWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
            }
            if (!appState.directRoutes[toWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(toWaypoint.iata_code));
            }
        }

        await Promise.all(fetchPromises);

        // Now find and add routes
        for (let i = 0; i < waypoints.length - 1; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];
            let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

            if (route) {
                route.isDirect = true;
                newRoutes.push(route);
            } else {
                // Fetch airport data for both origin and destination
                const [originAirport, destinationAirport] = await Promise.all([
                    flightMap.getAirportDataByIata(fromWaypoint.iata_code),
                    flightMap.getAirportDataByIata(toWaypoint.iata_code)
                ]);

                // Create an indirect route with full airport information and additional fields
                const indirectRoute = {
                    origin: fromWaypoint.iata_code,
                    destination: toWaypoint.iata_code,
                    originAirport: originAirport,
                    destinationAirport: destinationAirport,
                    isDirect: false,
                    // Set default values for missing fields if necessary
                    price: null,
                    source: 'indirect',
                    timestamp: new Date().toISOString()
                };
                newRoutes.push(indirectRoute);
            }
        }

        updateState('updateRoutes', newRoutes);
        pathDrawing.clearLines();
        pathDrawing.drawLines();
        routeList.updateEstPrice();
        document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
    }
}

export { routeHandling }