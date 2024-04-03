import { map, blueDotIcon, magentaDotIcon, greenDotIcon } from './map.js';
import { pathDrawing } from './pathDrawing.js';
import { eventManager } from './eventManager.js';
import { appState, updateState } from './stateManager.js';

const flightMap = {
    markers: {},
    currentLines: [],
    selectedMarker: null,
    routePathCache: {},
    airportDataCache: {},
    clearMultiHopPaths: true,
    cachedRoutes: [],
    lastFetchTime: null,
    cacheDuration: 600000, // 10 minutes in milliseconds 
    
    init: function() {
        this.getAirportDataByIata = this.getAirportDataByIata.bind(this);
    },

    addMarker(airport) {
        if (!airport || !airport.iata_code || !airport.weight) {
            console.error('Incomplete airport data:', airport);
            return;
        }
    
        let iata = airport.iata_code;
        if (this.markers[iata]) return;
    
        let icon = appState.waypoints.some(wp => wp.iata_code === iata) ? magentaDotIcon : blueDotIcon;
        
        let zoom = map.getZoom();
        if (this.shouldDisplayAirport(airport.weight, zoom)) {
            const latLng = L.latLng(airport.latitude, airport.longitude);
            const marker = L.marker(latLng, {icon: icon}).addTo(map);
    
            marker.airportWeight = airport.weight;
            
            // Bind a simple popup without automatic opening on mouseover
            marker.bindPopup(`<b>${airport.city}</b>`, { maxWidth: 'auto' });
    
            eventManager.attachMarkerEventListeners(iata, marker, airport);
            this.markers[iata] = marker;
        }
    },
                   

    handleMarkerClick(airport, clickedMarker) {
        // Close all other tooltips
        Object.values(this.markers).forEach(marker => {
            if (marker !== clickedMarker) {
                marker.closePopup();
            }
        });
    
        // Set selectedAirport to the current airport
        appState.selectedAirport = airport;
    
        // Check if the airport is already a waypoint
        const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
        const waypointIndex = appState.waypoints.findIndex(wp => wp.iata_code === airport.iata_code);
        
        // Set the toolltip popup button based on whether it's a waypoint
        let popupContent = `<b>${airport.city}</b><br>` +
                   `<div style="text-align: right;"><button onclick="this.closest('.leaflet-popup').remove();">x</button></div>`;
        if (waypointIndex === -1) {
            popupContent += `<button id="addWaypointBtn">+</button>`;
        } else {
            popupContent += `<button id="removeWaypointBtn">-</button>`;
        }
    
        // Show the tooltip for the current marker
        clickedMarker.setPopupContent(popupContent).openPopup();
    
        // Update marker icon to indicate selection
        clickedMarker.setIcon(magentaDotIcon);
    
        // Wait for the popup to be added to the DOM
        clickedMarker.getPopup().on('add', () => {
            if (waypointIndex === -1) {
                document.getElementById('addWaypointBtn').onclick = () => {
                    if (appState.waypoints.length >= 2 && appState.waypoints.length === document.querySelectorAll('.airport-selection input[type="text"]').length) {
                        updateState('addWaypoint', lastWaypoint);
                        updateState('addWaypoint', airport);
                    } else {
                        updateState('addWaypoint', airport);
                        clickedMarker.setIcon(magentaDotIcon);
                    }
                    appState.selectedAirport = null; // Change icon to indicate it's a waypoint now
                    clickedMarker.closePopup(); // Optional: Close the popup after adding
                };
            } else {
                document.getElementById('removeWaypointBtn').onclick = () => {
                    if (appState.selectedAirport && appState.selectedAirport.iata_code === airport.iata_code) {
                        if (appState.waypoints.length % 2 === 0 && appState.waypoints.length > waypointIndex) {
                            updateState('removeWaypoint', waypointIndex + 1);
                            updateState('removeWaypoint', waypointIndex);
                            clickedMarker.setIcon(blueDotIcon);
                            appState.selectedAirport = null;
                            return;
                        } else {
                        updateState('removeWaypoint', appState.waypoints[waypointIndex]);
                        appState.selectedAirport = null;
                        clickedMarker.setIcon(blueDotIcon); // Change icon back to default
                    clickedMarker.closePopup(); // Optional: Close the popup after removing
                        }
                    }
                }
            }
        });
    },        

    findRoute(fromIata, toIata) {
        try {
            for (const routes of Object.values(appState.directRoutes)) {
                for (const route of routes) {
                    if (route.originAirport.iata_code === fromIata && route.destinationAirport.iata_code === toIata) {
                        return route;
                    }
                }
            }
        } catch (error) {
            console.error(`Error finding route from ${fromIata} to ${toIata}:`, error);
        }
        return null;
    },    

    async fetchAndDisplayAirports() {
        try {
            const airports = await this.fetchAndCacheAirports();
            Object.values(airports).forEach(airport => {
                this.addMarker(airport);
            });
        } catch (error) {
            console.error('Error fetching airports:', error);
        }
    },

    async fetchAndCacheAirports() {
        if (this.airportDataCache && Object.keys(this.airportDataCache).length > 0) {
            return Promise.resolve(this.airportDataCache);
        }
    
        try {
            const response = await fetch('https://yonderhop.com/api/airports');
            const data = await response.json();
            this.airportDataCache = data.reduce((acc, airport) => {
                acc[airport.iata_code] = airport;
                return acc;
            }, {});
            this.updateVisibleMarkers(); // Call updateVisibleMarkers after data is fetched
            return this.airportDataCache;
        } catch (error) {
            console.error('Error fetching airports:', error);
            return {};
        }
    },    

    getAirportDataByIata(iata) {
        if (this.airportDataCache && this.airportDataCache[iata]) {
            return Promise.resolve(this.airportDataCache[iata]);
        }

        return this.fetchAndCacheAirports().then(cache => cache[iata] || null);
    },

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    redrawMarkers() {
        Object.values(this.markers).forEach(marker => {
            var newLatLng = pathDrawing.adjustLatLng(marker.getLatLng());
            marker.setLatLng(newLatLng);
        });
    },

    markerHoverHandler(iata, event) {
        const marker = this.markers[iata];
        if (!marker) return;
        if (this.selectedMarker !== iata) {
            if (event === 'mouseover') {
                this.fetchAndCacheRoutes(iata).then(() => {
                    pathDrawing.drawRoutePaths(iata, appState.directRoutes, appState.routeDirection);
                });
            } else if (event === 'mouseout') {
                if (!marker.hovered) {  // Delay only for the first hover
                    setTimeout(() => {pathDrawing.clearLines();
                    pathDrawing.drawLines();
                    }, 200);
                    marker.hovered = true; // Set the flag to true after the first hover
                } else {
                    pathDrawing.clearLines();
                    pathDrawing.drawLines();
                }
            }
        }
    },
    
    async fetchAndCacheRoutes(iata) {
        if (!appState.directRoutes[iata]) {
            try {
                const direction = appState.routeDirection // 'to' or 'from'
                const response = await fetch(`https://yonderhop.com/api/directRoutes?origin=${iata}&direction=${direction}`);
                const routes = await response.json();
                appState.directRoutes[iata] = routes;
            } catch (error) {
                console.error('Error fetching routes:', error);
            }
        }
    },    

    shouldDisplayAirport(airportWeight, currentZoom) {
        return (
            (currentZoom >= 2 && currentZoom <= 4 && airportWeight <= 3) ||
            (currentZoom >= 5 && currentZoom <= 6 && airportWeight <= 6) ||
            (currentZoom >= 7 && airportWeight <= 10)
        );
    },    

    updateVisibleMarkers() {
        const currentZoom = map.getZoom();
        const currentBounds = map.getBounds();
    
        // Check and add markers for airports that should be visible at the current zoom level
        Object.values(this.airportDataCache).forEach(airport => {
            if (this.shouldDisplayAirport(airport.weight, currentZoom) &&
                currentBounds.contains(L.latLng(airport.latitude, airport.longitude)) &&
                !this.markers[airport.iata_code]) {
                this.addMarker(airport);
            }
        });

        // Update visibility of existing markers
        Object.values(this.markers).forEach(marker => {
            if (this.shouldDisplayAirport(marker.airportWeight, currentZoom) &&
                currentBounds.contains(marker.getLatLng())) {
                if (!map.hasLayer(marker)) {
                    marker.addTo(map);
                }
            } else {
                map.removeLayer(marker);
            }
        });
    },                      
};

flightMap.init();

export { flightMap };
