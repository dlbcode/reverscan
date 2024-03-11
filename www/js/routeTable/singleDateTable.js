import { appState, updateState } from '../stateManager.js';
import { 
  getColumnIndex, 
  attachEventListeners, 
  highlightSelectedRowForRouteIndex, 
  replaceWaypointsForCurrentRoute, 
  resetSortIcons, 
  sortTableByColumn 
} from './routeTable.js';

function buildSingleDateTable(routeIndex) {
  const currentRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  if (!currentRoute) {
    return;
  }

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

  const origin = currentRoute.originAirport.iata_code;
  const destination = currentRoute.destinationAirport.iata_code;
  const departureDate = appState.routeDates[routeIndex + 1];

  let apiUrl = `https://yonderhop.com/api/yhoneway?origin=${origin}&destination=${destination}&departureDate=${departureDate}`;

  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch route data: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      const table = document.createElement('table');
      table.className = 'route-info-table';
      table.style.width = '100%';
      table.setAttribute('data-route-index', routeIndex, 'border', '1');

      const thead = document.createElement('thead');
      let headerRow = `<tr>
                        <th>Departure <span class="sortIcon" data-column="departure">&#x21C5;</span><img class="filterIcon" data-column="departure" src="/assets/filter-icon.svg" alt="Filter"></th>
                        <th>Arrival <span class="sortIcon" data-column="arrival">&#x21C5;</span><img class="filterIcon" data-column="arrival" src="/assets/filter-icon.svg" alt="Filter"></th>
                        <th>Price <span class="sortIcon" data-column="price">&#x21C5;</span><img id="priceFilter" class="filterIcon" src="/assets/filter-icon.svg" alt="Filter"></th>
                        <th>Airlines <span class="sortIcon" data-column="airlines">&#x21C5;</span></th>
                        <th>Direct <span class="sortIcon" data-column="direct">&#x21C5;</span></th>
                        <th>Stops <span class="sortIcon" data-column="stops">&#x21C5;</span></th>
                        <th>Layovers <span class="sortIcon" data-column="layovers">&#x21C5;</span></th>
                        <th>Duration <span class="sortIcon" data-column="duration">&#x21C5;</span></th>
                        <th>Route <span class="sortIcon" data-column="route">&#x21C5;</span></th>
                     </tr>`;
      thead.innerHTML = headerRow;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      data.forEach(flight => {
        let row = document.createElement('tr');
        row.setAttribute('data-route-id', flight.id);
        const directFlight = flight.route.length === 1;
        const stops = flight.route.length - 1;
        const layovers = flight.route.slice(0, -1).map(r => r.flyTo).join(", ");
        const durationHours = Math.floor(flight.duration.total / 3600);
        const durationMinutes = Math.floor((flight.duration.total % 3600) / 60);
        const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > ");
        
        // Determine departure and arrival times
        const departureTime = flight.local_departure ? new Date(flight.local_departure).toLocaleString() : new Date(flight.dTime * 1000).toLocaleString();
        const arrivalTime = flight.local_arrival ? new Date(flight.local_arrival).toLocaleString() : new Date(flight.aTime * 1000).toLocaleString();

        row.innerHTML = `<td>${departureTime}</td>
                         <td>${arrivalTime}</td>
                         <td>$${flight.price}</td>
                         <td>${flight.airlines.join(", ")}</td>
                         <td>${directFlight ? '✓' : ''}</td>
                         <td>${stops}</td>
                         <td>${layovers}</td>
                         <td>${durationHours}h ${durationMinutes}m</td>
                         <td>${routeIATAs}</td>`;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      infoPaneContent.appendChild(table);

      highlightSelectedRowForRouteIndex(routeIndex);

      attachEventListeners(table, data, routeIndex);
    })
    .catch(error => {
      infoPaneContent.textContent = 'Error loading data: ' + error.message;
    });
}

export { buildSingleDateTable };
