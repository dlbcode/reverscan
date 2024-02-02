import { flightMap } from './flightMap.js';
import { routeList } from './routeList.js';
import { updateState, appState } from './stateManager.js';
import { getPrice } from './getPrice.js';
import { infoPane } from './infoPane.js';

async function initMapFunctions() {
    routeList.initTravelerControls();
    
    const params = new URLSearchParams(window.location.search);
    const oneWayParam = params.get('oneWay');
    if (oneWayParam === 'false') {
        updateState('oneWay', 'false');
    }
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

fetch('http://ip-api.com/json/') // Fetch client's approximate location using IP-API
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') { // Set map view to the obtained location
            map.setView([data.lat, data.lon], 4);
        } else {
            console.error('IP Geolocation failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching IP Geolocation:', error);
    });

document.getElementById('map').style.height = window.innerHeight + 'px'; // Initial resize on load
document.addEventListener('DOMContentLoaded', () => {
    initMapFunctions();
    getPrice.init();
    infoPane.init();
    adjustMapSize();
});

function adjustMapSize() {
    const mapElement = document.getElementById('map');
    const infoPaneHeight = document.getElementById('infoPane').offsetHeight; // Ensure dynamic height is used
    const windowHeight = window.innerHeight + 136;
    mapElement.style.height = `${windowHeight - infoPaneHeight}px`;

    const leftPane = document.querySelector('.leftPane');
    const leftPaneWidth = leftPane.offsetWidth;
    const windowWidth = window.innerWidth;
    const mapWidth = leftPane.classList.contains('leftPane-hidden') ? windowWidth : windowWidth - leftPaneWidth;
    mapElement.style.width = `${mapWidth}px`;

    if (map) {
        map.invalidateSize();
    } else {
        console.error("Leaflet map instance 'map' is not accessible.");
    }
}

window.addEventListener('resize', adjustMapSize);

var blueDotIcon = L.divIcon({ // Marker configurations
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

export { map, blueDotIcon, magentaDotIcon, adjustMapSize };
