import { appState, updateState } from '../stateManager.js';
import { showPriceFilterPopup } from './priceFilter.js';
import { showDateFilterPopup } from './dateFilters.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';
import { routeInfoRow, highlightSelectedRowForRouteIndex } from './routeInfoRow.js';

function getColumnIndex(columnIdentifier) {
  const columnMap = {
    'departure': 1,
    'arrival': 2,
    'price': 3,
    'airlines': 4,
    'direct': 5,
    'stops': 6,
    'layovers': 7,
    'duration': 8,
    'route': 9
  };
  return columnMap[columnIdentifier] || -1; // Default to -1 if identifier not found
}

function buildDateRangeTable(routeIndex, dateRange) {
  const [startDate, endDate] = dateRange.split(' to ');
  const currentRoute = appState.routes[routeIndex];
  const infoPaneContent = document.getElementById('infoPaneContent');
  infoPaneContent.innerHTML = '';

  if (!currentRoute) {
    return;
  }

  document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', type: 'text/css', href: '../css/routeTable.css'}));

   // Start the loading animation
   const topBar = document.getElementById('top-bar');
   topBar.classList.add('loading');

  const origin = currentRoute.originAirport.iata_code;
  const destination = currentRoute.destinationAirport.iata_code;

  let apiUrl = `https://yonderhop.com/api/range?flyFrom=${origin}&flyTo=${destination}`;

  if (!dateRange.includes('any')) {
      const [startDate, endDate] = dateRange.split(' to ');
      apiUrl += `&dateFrom=${startDate}&dateTo=${endDate}`;
  }

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

    if (Array.isArray(data.data)) {
      data.data.forEach(flight => {
        let row = document.createElement('tr');
        row.setAttribute('data-route-id', flight.id);
        const directFlight = flight.route.length === 1;
        const price = parseFloat(flight.price.toFixed(2));
        const stops = flight.route.length - 1;
        const layovers = flight.route.slice(0, -1).map(r => r.flyTo).join(", ");
        const durationHours = Math.floor(flight.duration.total / 3600);
        const durationMinutes = Math.floor((flight.duration.total % 3600) / 60);
        const routeIATAs = flight.route.map(r => r.flyFrom).concat(flight.route[flight.route.length - 1].flyTo).join(" > ");

        const departureDate = new Date(flight.dTime * 1000);
        const arrivalDate = new Date(flight.aTime * 1000);
        const departureDayName = departureDate.toLocaleDateString('en-US', { weekday: 'short' });
        const arrivalDayName = arrivalDate.toLocaleDateString('en-US', { weekday: 'short' });
    
        const formattedDeparture = `${departureDayName} ${departureDate.toLocaleString()}`;
        const formattedArrival = `${arrivalDayName} ${arrivalDate.toLocaleString()}`;
    
        row.innerHTML = `<td>${formattedDeparture}</td>
                          <td>${formattedArrival}</td>
                          <td>$${price}</td>
                          <td>${flight.airlines.join(", ")}</td>
                          <td>${directFlight ? '✓' : ''}</td>
                          <td>${stops}</td>
                          <td>${layovers}</td>
                          <td>${durationHours}h ${durationMinutes}m</td>
                          <td>${routeIATAs}</td>`;
        tbody.appendChild(row);
      });         
    } else {
      console.error('data.data is not an array:', data.data);

    }
    table.appendChild(tbody);
    infoPaneContent.appendChild(table);

    topBar.classList.remove('loading');

    pathDrawing.drawRouteLines();

    highlightSelectedRowForRouteIndex(routeIndex);

    attachEventListeners(table, data, routeIndex);
  })
  .catch(error => {
    infoPaneContent.textContent = 'Error loading data: ' + error.message;
  });  

    function attachEventListeners(table, data, routeIndex) {
      const headers = table.querySelectorAll('th');
      headers.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function(event) {
          if (!event.target.closest('.filterIcon')) {
            const sortIcon = this.querySelector('.sortIcon');
            const columnIdentifier = sortIcon.getAttribute('data-column');
            const columnIndex = getColumnIndex(columnIdentifier);
            const isAscending = sortIcon.getAttribute('data-sort') !== 'asc';
            sortTableByColumn(table, columnIndex, isAscending);
            resetSortIcons(headers, sortIcon, isAscending ? 'asc' : 'desc');
          }
        });
      });
    
      // Attach event listeners specifically for date filter icons
      document.querySelectorAll('.filterIcon').forEach(icon => {
        icon.addEventListener('click', function(event) {
          event.stopPropagation(); // Prevent the event from bubbling up to the header
          const column = this.getAttribute('data-column');
          if (column === 'departure' || column === 'arrival') {
            const dateFilterPopup = document.getElementById(`${column}DateFilterPopup`);
            if (dateFilterPopup) {
              dateFilterPopup.classList.toggle('hidden');
            } else {
              showDateFilterPopup(event, column);
            }
          }
        });
      });
       
      document.querySelectorAll('.route-info-table tbody tr').forEach((row, index) => {
        row.addEventListener('click', function() {
          const routeIdString = this.getAttribute('data-route-id');
          const routeIds = routeIdString.split('|');
          const fullFlightData = data.data[index];
          routeInfoRow(this, fullFlightData, routeIds, routeIndex);
        });
    });    
    
    document.querySelectorAll('.route-info-table tbody tr').forEach(row => {
      row.addEventListener('mouseover', function() {
        const routeString = this.cells[8].textContent.trim();
        const iataCodes = routeString.split(' > ');
  
        for (let i = 0; i < iataCodes.length - 1; i++) {
            const originIata = iataCodes[i];
            const destinationIata = iataCodes[i + 1];
            pathDrawing.drawPathBetweenAirports(originIata, destinationIata, flightMap.getAirportDataByIata);
        }
      });
  
      row.addEventListener('mouseout', function() {
          pathDrawing.clearLines();
          pathDrawing.drawLines();
      });
    });
  
    // Separate handling for the price filter icon
    const priceFilterIcon = document.getElementById('priceFilter');
    if (priceFilterIcon) {
      priceFilterIcon.addEventListener('click', function(event) {
        event.stopPropagation(); // Prevent the event from affecting other elements
        const priceSliderPopup = document.getElementById('priceSliderPopup');
        if (priceSliderPopup) {
          priceSliderPopup.classList.toggle('hidden');
        } else {
          showPriceFilterPopup(event, data);
        }
      });
    }
  } 
  
  function resetSortIcons(headers, currentIcon, newSortState) {
    headers.forEach(header => {
      const icon = header.querySelector('.sortIcon');
      if (icon !== currentIcon) {
        icon.innerHTML = '&#x21C5;'; // Reset to double arrow
        icon.removeAttribute('data-sort');
      } else {
        icon.innerHTML = newSortState === 'asc' ? '&#x25B2;' : '&#x25BC;';
        icon.setAttribute('data-sort', newSortState);
      }
    });
  }
  
  function sortTableByColumn(table, columnIndex, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rows = Array.from(tBody.querySelectorAll("tr"));
  
    const sortedRows = rows.sort((a, b) => {
      let aColText = a.cells[columnIndex - 1].textContent.trim();
      let bColText = b.cells[columnIndex - 1].textContent.trim();
      return aColText.localeCompare(bColText, undefined, { numeric: true }) * dirModifier;
    });
  
    while (tBody.firstChild) {
      tBody.removeChild(tBody.firstChild);
    }
    tBody.append(...sortedRows);
  
    // Update header classes for visual indication of sort direction
    table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
    if (asc) {
      table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-asc");
    } else {
      table.querySelector(`th:nth-child(${columnIndex})`).classList.add("th-sort-desc");
    }
  }
}
    
  export { buildDateRangeTable };
