const appState = {
  selectedAirport: null,
  numTravelers: 1,
  flightPathToggle: 'from',
  waypoints: [],
  flights: [], 
};

function updateState(key, value) {
  switch (key) {
      case 'updateWaypoint':
        const waypointIndex = appState.waypoints.findIndex(w => w.fieldId === value.fieldId);
        if (waypointIndex !== -1) {
            appState.waypoints[waypointIndex].iata_code = value.iataCode;
        }
        break;
      case 'addWaypoint':
        appState.waypoints.push(value);
        console.table(appState.waypoints);
        break;
      case 'removeWaypoint':
        appState.waypoints = appState.waypoints.filter(waypoint => waypoint.iata_code !== value);
        break;
      case 'addFlight':
        console.log('appState: adding flight');
        appState.flights.push(value);
        console.table(appState.flights);
        break;
      default:
        appState[key] = value;
        break;
  }
  document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

export { appState, updateState };
