import { map } from './map.js';
import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { pathDrawing } from './pathDrawing.js';
import { drawAllRoutePaths } from './allPaths.js';
import { appState, updateState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';
import { uiHandling } from './uiHandling.js';
import { mapHandling } from './mapHandling.js';

function handleStateChange(event) {
    const { key, value } = event.detail;

    if (key === 'addWaypoint' || key === 'removeWaypoint' || key === 'updateWaypoint') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';

        // Ensure at least one route div is present
        const routeCount = Math.max(1, Math.ceil(appState.waypoints.length / 2));
        for (let i = 0; i < routeCount; i++) {
            routeHandling.buildRouteDivs(i + 1);
        }

        mapHandling.updateMarkerIcons();
        routeHandling.updateRoutesArray();
    }

    if (key === 'addWaypoint' || 'updateWaypoint' && appState.waypoints.length % 2 === 0) {
        const lastWaypointFieldId = `waypoint${appState.waypoints.length}`;
        const lastWaypointField = document.getElementById(lastWaypointFieldId);
        if (lastWaypointField && lastWaypointField.value) {
                uiHandling.toggleTripButtonsVisibility(true);
        }
    }

    if (key === 'routeAdded') {
        routeHandling.buildRouteDivs(value.newRoute);
    }

    if (key === 'clearData') {
        const container = document.querySelector('.airport-selection');
        container.innerHTML = '';
        routeHandling.buildRouteDivs(1);
    }
    uiHandling.setFocusToNextUnsetInput();
}

const eventManager = {
    setupEventListeners: function () {
        this.setupMapEventListeners();
        this.setupUIEventListeners();
        this.setupAllPathsButtonEventListener();
        document.addEventListener('stateChange', handleStateChange);
        document.addEventListener('routeAdded', function(event) {
            routeHandling.buildRouteDivs(event.detail.newRoute);
        });
    },

    setupMapEventListeners: function () {
        map.on('click', () => {
            flightMap.selectedMarker = null;
            appState.selectedAirport = null;
            pathDrawing.clearLines();
            pathDrawing.drawLines();
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
        document.querySelector('.airport-selection').addEventListener('click', function(event) {
            if (event.target.classList.contains('remove-route-button')) {
                const routeNumber = event.target.closest('.route-container').dataset.routeNumber;
            }
        });

        document.addEventListener('click', function (event) {
            if (event.target.id === 'increaseTravelers') {
                updateState('numTravelers', appState.numTravelers + 1);
                routeList.updateTotalCost();
            } else if (event.target.id === 'decreaseTravelers' && appState.numTravelers > 1) {
                updateState('numTravelers', appState.numTravelers - 1);
                routeList.updateTotalCost();
            } else if (event.target.id === 'clearBtn') {
                updateState('routeDirection', 'from');
                updateState('clearData', null);
                appState.selectedAirport = null;
                routeList.updateTotalCost();
                pathDrawing.clearLines();
                mapHandling.updateMarkerIcons();
                routeHandling.updateRoutesArray();
                uiHandling.toggleTripButtonsVisibility(false);
            }            
        });
    },

    setupAllPathsButtonEventListener: function () {
        document.addEventListener('click', function (event) {
            if (event.target.id === 'allPathsBtn') {
                drawAllRoutePaths();
            }
        });
    },

    attachMarkerEventListeners: function (iata, marker, airport) {
        marker.on('mouseover', () => flightMap.markerHoverHandler(iata, 'mouseover'));
        marker.on('mouseout', () => flightMap.markerHoverHandler(iata, 'mouseout'));
        marker.on('click', () => { flightMap.handleMarkerClick(airport, marker); });
    },

    emitCustomEvent: function (eventName, data) {
        switch (eventName) {
            case 'markerCreated':
                this.attachMarkerEventListeners(data.iata, data.marker, data.airport);
                break;
        }
    },
};

window.addEventListener('resize', function () {
    const height = window.innerHeight;
    document.getElementById('map').style.height = height + 'px';
});

document.addEventListener('DOMContentLoaded', function () {
    flightMap.fetchAndDisplayAirports();
    eventManager.setupEventListeners();
});

export { eventManager };
