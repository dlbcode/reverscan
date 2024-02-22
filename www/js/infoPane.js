import { appState, updateState } from './stateManager.js';
import { pathDrawing } from './pathDrawing.js';
import { buildRouteTable } from './routeTable/routeTable.js';
import { selectedRoute } from './routeTable/selectedRoute.js';

const infoPane = {
  init() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    const tripButton = document.getElementById('tripButton');
    document.addEventListener('stateChange', this.handleStateChange.bind(this));

    tripButton.addEventListener('click', () => {
      appState.currentView = 'trip';
      this.displayContent();
    });
  },

  handleStateChange(event) {
    this.updateRouteButtons();
    if (event.detail.key === 'updateSelectedRoute' || event.detail.key === 'removeSelectedRoute') {
      this.displayContent();
    }
  },

  displayContent() {
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '';

    if (appState.currentView === 'trip') {
      const selectedRoutesArray = Object.values(appState.selectedRoutes);
      this.updateTripTable(selectedRoutesArray);
    } else if (appState.currentView === 'routeTable') {
      const routeIndex = appState.currentRouteIndex;
      buildRouteTable(routeIndex);
    } else if (appState.currentView === 'selectedRoute') {
      const routeIndex = appState.currentRouteIndex;
      selectedRoute.displaySelectedRouteInfo(routeIndex);
    }
  },

  updateRouteButtons() {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';

    appState.routes.forEach((route, index) => {
      let button = document.createElement('button');
      button.textContent = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
      button.className = 'route-info-button';
      button.onclick = () => {
        // Check if there's a selected route for this index
        if (appState.selectedRoutes.hasOwnProperty(index)) {
          // Display selected route information
          selectedRoute.displaySelectedRouteInfo(index);
        } else {
          // Display route table
          buildRouteTable(index);
        }
      };
      menuBar.appendChild(button);

      // Create the checkmark span and add the base class
      const checkmark = document.createElement('span');
      checkmark.innerHTML = '✓'; // Checkmark icon
      checkmark.classList.add('route-checkmark');

      // Conditionally add the selected or unselected class
      if (appState.selectedRoutes.hasOwnProperty(index)) {
        checkmark.classList.add('selected'); // Green checkmark for selected routes
      } else {
        checkmark.classList.add('unselected'); // Grey checkmark for unselected routes
      }

      button.appendChild(checkmark);

      button.addEventListener('mouseover', () => {
        const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
        pathLines.forEach(path => path.setStyle({ color: 'white' }));
      });
      
      button.addEventListener('mouseout', () => {
          const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
          const pathLines = pathDrawing.routePathCache[routeId] || pathDrawing.dashedRoutePathCache[routeId] || [];
          pathLines.forEach(path => {
              const originalColor = pathDrawing.getColorBasedOnPrice(route.price);
              path.setStyle({ color: originalColor });
          });
      });    
    });
  },

  updateTripTable: function(selectedRoutesArray) {
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = ''; // Clear existing content

    const table = document.createElement('table');
    table.className = 'route-info-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
        <th>Departure</th>
        <th>Arrival</th>
        <th>Price</th>
        <th>Airline</th>
        <th>Stops</th>
        <th>Route</th>
        <th>Action</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    selectedRoutesArray.forEach(routeData => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${routeData.departure}</td>
            <td>${routeData.arrival}</td>
            <td>${routeData.price}</td>
            <td>${routeData.airline}</td>
            <td>${routeData.stops}</td>
            <td>${routeData.route}</td>
            <td><a href="${routeData.deep_link}" target="_blank"><button>Book Flight</button></a></td>`;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    infoPaneContent.appendChild(table);
  }
}

export { infoPane };
