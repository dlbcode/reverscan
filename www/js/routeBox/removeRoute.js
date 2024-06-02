import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { mapHandling } from '../mapHandling.js';
import { flightMap } from '../flightMap.js';

const removeRoute = {
  removeRouteButton: function(container, routeNumber) {
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'remove-button';
    removeButton.onclick = function() {
      let selectedRouteIndex = routeNumber;
      let groupNumber = appState.selectedRoutes[selectedRouteIndex]?.group;

      // Remove all selectedRoutes with the same group number
      Object.keys(appState.selectedRoutes).forEach(key => {
        if (appState.selectedRoutes[key].group === groupNumber) {
          updateState('removeSelectedRoute', parseInt(key), 'removeRoute.removeRouteButton2');
        }
      });

      // Remove the waypoints associated with the route
      updateState('removeWaypoints', { routeNumber }, 'removeRoute.removeRouteButton2');

      // Remove the route date for the removed route
      delete appState.routeDates[routeNumber];

      // Re-index routeDates to fill the gap left by the removed route
      const newRouteDates = {};
      Object.keys(appState.routeDates).forEach((key, index) => {
        if (parseInt(key) < routeNumber) {
          newRouteDates[key] = appState.routeDates[key];
        } else if (parseInt(key) > routeNumber) {
          // Shift the dates down to fill the gap left by the removed route
          newRouteDates[parseInt(key) - 1] = appState.routeDates[key];
        }
      });
      appState.routeDates = newRouteDates;

      // Additional logic to update the UI and application state as needed
      pathDrawing.clearLines(true);
      pathDrawing.drawLines();
      mapHandling.updateMarkerIcons();
      removeRoute.updateRoutesArray();

      // Close the route box after operation
      console.log('Closing route box');
      document.getElementById('routeBox').style.display = 'none';
    };
    if (container instanceof HTMLElement) {
      container.appendChild(removeButton);
    } else {
      console.error('Invalid routeBox element provided');
    }
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
          price: null,
          source: 'indirect',
          timestamp: new Date().toISOString()
        };
        newRoutes.push(indirectRoute);
      }
    }

    updateState('updateRoutes', newRoutes, 'removeRoute.updateRoutesArray');
    pathDrawing.clearLines(true);
    pathDrawing.drawLines();
    //routeList.updateEstPrice();
    document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
  }
}

export { removeRoute }
