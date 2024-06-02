import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { pathDrawing } from './pathDrawing.js';

const routeHandling = {
    updateRoutesArray: async function () {
        let newRoutes = [];
        let fetchPromises = [];

        const waypoints = appState.routeDirection === 'to' ? [...appState.waypoints].reverse() : appState.waypoints;

        // Fetch routes for waypoints
        for (let i = 0; i < waypoints.length; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            if (!toWaypoint) continue;

            if (!appState.directRoutes[fromWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(fromWaypoint.iata_code));
            }
            if (!appState.directRoutes[toWaypoint.iata_code]) {
                fetchPromises.push(flightMap.fetchAndCacheRoutes(toWaypoint.iata_code));
            }
        }

        await Promise.all(fetchPromises);

        for (let i = 0; i < waypoints.length; i += 2) {
            const fromWaypoint = waypoints[i];
            const toWaypoint = waypoints[i + 1];

            if (!toWaypoint) {
                newRoutes.push({
                    origin: fromWaypoint.iata_code,
                    destination: 'Any',
                    isDirect: false,
                    price: null,
                    source: 'placeholder',
                    timestamp: new Date().toISOString()
                });
                break;
            }

            let route = flightMap.findRoute(fromWaypoint.iata_code, toWaypoint.iata_code);

            if (route) {
                route.isDirect = true;
                if (!newRoutes.some(r => r.origin === route.origin && r.destination === route.destination)) {
                    newRoutes.push(route);
                }
            } else {
                const [originAirport, destinationAirport] = await Promise.all([
                    flightMap.getAirportDataByIata(fromWaypoint.iata_code),
                    flightMap.getAirportDataByIata(toWaypoint.iata_code)
                ]);

                if (originAirport && destinationAirport && originAirport.latitude && destinationAirport.latitude) {
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
                    if (!newRoutes.some(r => r.origin === indirectRoute.origin && r.destination === indirectRoute.destination)) {
                        newRoutes.push(indirectRoute);
                    }
                }
            }
        }

        // Remove routes with no corresponding waypoints
        newRoutes = newRoutes.filter(route => appState.waypoints.some(waypoint => waypoint.iata_code === route.origin));

        // Ensure all routes with no corresponding waypoints are removed, including current route or route 0
        appState.routes = appState.routes.filter(route => appState.waypoints.some(waypoint => waypoint.iata_code === route.origin));

        if (newRoutes.length > 0 && !arraysEqual(newRoutes, appState.routes)) {
            newRoutes = newRoutes.map((route, index) => ({
                ...route,
                tripType: appState.routes[index]?.tripType || 'oneWay'
            }));
            updateState('updateRoutes', newRoutes, 'routeHandling.updateRoutesArray');
            pathDrawing.clearLines(true);
            pathDrawing.drawLines();
            document.dispatchEvent(new CustomEvent('routesArrayUpdated'));
        } else {
            console.log('No valid routes found to update or routes are the same as current state.');
        }
    }
};

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) return false;
    }
    return true;
}

export { routeHandling };
