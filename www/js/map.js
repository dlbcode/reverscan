import { flightMap } from './flightMap.js';
import { updateState } from './stateManager.js';
import { getPrice } from './getPrice.js';
import { leftPane } from './leftPane.js';
import { infoPane } from './infoPane.js';
import { routeHandling } from './routeHandling.js';

async function initMapFunctions() {
    const params = new URLSearchParams(window.location.search);
    const waypointParam = params.get('waypoints');
    if (waypointParam) {
        const waypointIatas = waypointParam.split(',').map(decodeURIComponent);
        const airports = [];
        for (const iata of waypointIatas) {
            const airport = await flightMap.getAirportDataByIata(iata);
            if (airport) {
                airports.push(airport);
            }
        }
        updateState('addWaypoint', airports); // Add all waypoints in one operation
    }
    const directionParam = params.get('direction');
    if (directionParam) {
        updateState('routeDirection', directionParam);
    }
    const routeDatesParam = params.get('dates');
    if (routeDatesParam) {
        const datePairs = routeDatesParam.split(',');
        datePairs.forEach(pair => {
            const [key, value] = pair.split(':');
            const routeNumber = parseInt(key, 10);
            const date = value;
            updateState('updateRouteDate', { routeNumber: routeNumber, date: date });
        });
    }

    document.dispatchEvent(new CustomEvent('waypointsLoadedFromURL'));
}

var map = L.map('map', { 
    zoomControl: false, 
    minZoom: 2, 
    maxZoom: 19,
    worldCopyJump: true // This option makes the map jump to the original world copy
});

map.setView([0, 0], 4); // Default view settings

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', { // Tile layer settings
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ // Zoom control settings
    position: 'bottomright'
}).addTo(map);

// Use HTML5 Geolocation API to fetch client's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
        map.setView([position.coords.latitude, position.coords.longitude], 4);
    }, function(error) {
        console.error('Geolocation API Error:', error);
        // Optionally, set a fallback location here
    });
} else {
    console.error('Geolocation API not supported by this browser.');
    // Optionally, set a fallback location here
}

document.getElementById('map').style.height = window.innerHeight + 'px'; // Initial resize on load
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    getPrice.init();
    leftPane.init();
    infoPane.init();
    routeHandling.init();
    adjustMapSize();
});

function adjustMapSize() {
    const mapElement = document.getElementById('map');
    const infoPaneHeight = document.getElementById('infoPane').offsetHeight;
    const windowHeight = window.innerHeight;
    const newMapHeight = windowHeight - infoPaneHeight;
    mapElement.style.height = `${newMapHeight}px`;

    if (window.map) {
        map.invalidateSize();
    }    
}

window.addEventListener('resize', adjustMapSize);

window.addEventListener('orientationchange', adjustMapSize);

// Initial call to adjust map size
document.addEventListener('DOMContentLoaded', adjustMapSize);

var blueDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #3B74D5; width: 8px; height: 8px; border-radius: 50%;"></div>',
    iconSize: [8, 8],
    iconAnchor: [5, 5]
});
  
var magentaDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [6, 6]
});

var greenDotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color: #2ec54e; width: 10px; height: 10px; border-radius: 50%;"></div>',
    iconSize: [10, 10],
    iconAnchor: [6, 6]
});

export { map, blueDotIcon, magentaDotIcon, greenDotIcon, adjustMapSize };
