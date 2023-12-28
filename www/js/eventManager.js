import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { flightList } from './flightList.js';
import { pathDrawing } from './pathDrawing.js';
import { getIataFromField } from './airportAutocomplete.js';
import { drawAllFlightPaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';

// When 'from' airport is selected
const fromAirport = document.getElementById('fromAirport');
fromAirport.addEventListener('change', (event) => {
    updateState('fromAirport', event.target.value);
    console.log('appState fromAirport: ' + appState.fromAirport)
});

// When 'to' airport is selected
const toAirport = document.getElementById('toAirport');
toAirport.addEventListener('change', (event) => {
    updateState('toAirport', event.target.value);
    console.log('appState toAirport: ' + appState.toAirport)
});

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAirportFieldListeners();
        this.setupAllPathsButtonEventListener();
    },

    setupMapEventListeners: function () {
        map.on('click', () => {
            pathDrawing.clearFlightPaths();
            flightMap.selectedMarker = null;
        });

        map.on('moveend', () => {
            flightMap.redrawMarkers();
            flightMap.updateVisibleMarkers();
        });

        map.on('zoomend', () => {
            flightMap.updateVisibleMarkers();
        });
    },

    setupUIEventListeners: function () {
        const flightPathToggle = document.getElementById('flightPathToggle');
        flightPathToggle.addEventListener('change', function () {
            updateState('flightPathToggle', this.value);
            if (flightMap.selectedMarker) {
                pathDrawing.drawFlightPaths(flightMap.selectedMarker);
            }
        });

        const increaseTravelers = document.getElementById('increaseTravelers');
        increaseTravelers.addEventListener('click', function () {
            updateState('numTravelers', appState.numTravelers + 1);
            flightList.updateTotalCost();
        });

        const decreaseTravelers = document.getElementById('decreaseTravelers');
        decreaseTravelers.addEventListener('click', function () {
            if (appState.numTravelers > 1) {
                updateState('numTravelers', appState.numTravelers - 1);
                flightList.updateTotalCost();
            }
        });

        // Assuming you have a flightMap object, you should use it here
        map.addEventListener('zoomChanged', function () {
            flightMap.updateMarkersForZoom();
        });
    },

    setupAirportFieldListeners: function () {
      const airportFields = document.querySelectorAll('#fromAirport, #toAirport');
    
      airportFields.forEach((field) => {
        field.addEventListener('airportSelected', async (event) => {
          const fromAirportValue = getIataFromField('fromAirport');
          const toAirportValue = getIataFromField('toAirport');
                  
          // Fetch or compute directFlights
          let directFlights = await this.fetchdirectFlights();
    
          if (fromAirportValue || toAirportValue) {
            const selectedIata = fromAirportValue || toAirportValue;
            pathDrawing.clearFlightPaths();
            pathDrawing.drawFlightPaths(selectedIata, directFlights);
          } else {
            flightMap.clearMultiHopPaths = true;
            pathDrawing.clearFlightPaths();
          }
        });
      });
    },
    
    fetchdirectFlights: async function() {
        // Fetch flights data and structure it by destination
        let directFlights = {};
        try {
            const response = await fetch('http://yonderhop.com:3000/flights');
            const flights = await response.json();
            flights.forEach(flight => {
                if (flight.originAirport && flight.destinationAirport) {
                    let destIata = flight.destinationAirport.iata_code;
                    directFlights[destIata] = directFlights[destIata] || [];
                    directFlights[destIata].push(flight);
                }
            });
        } catch (error) {
            console.error('Error fetching flights:', error);
        }
        return directFlights;
    },

    setupAllPathsButtonEventListener: function () {
        const allPathsButton = document.getElementById('allPathsBtn');
        if (allPathsButton) {
            allPathsButton.addEventListener('click', function () {
                drawAllFlightPaths();
            });
        }
    },

    attachMarkerEventListeners: function (iata, marker, airport) {
        marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
        marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
        marker.on('click', () => { flightMap.handleMarkerClick(airport, marker);
        });
    },

    emitCustomEvent: function (eventName, data) {
        switch (eventName) {
            case 'markerCreated':
                this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
                break;
        }
    },
};

document.addEventListener('flightAdded', function (event) {
  const flight = event.detail;
  updateState('addFlight', flight); // Update appState with the new flight
  // print the contents of the flights array in the console
  console.table(appState.flights);
  pathDrawing.clearFlightPaths();
  pathDrawing.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
});

const clearButton = document.getElementById('clearBtn');
clearButton.addEventListener('click', function () {
    flightList.clearFlightList();
    pathDrawing.clearFlightPaths();
});

window.addEventListener('resize', function () {
    const height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

// Initialize all event listeners after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    eventManager.setupEventListeners();
});

export { eventManager };
