import { appState, updateState } from '../stateManager.js';
import { pathDrawing } from '../pathDrawing.js';
import { flightMap } from '../flightMap.js';

function routeInfoRow(rowElement, fullFlightData, routeIds, routeIndex) {
    console.log('routeInfoRow called with:', rowElement, fullFlightData, routeIds, routeIndex);

    // Toggle details row visibility
    let existingDetailRow = rowElement.nextSibling;
    if (existingDetailRow && existingDetailRow.classList.contains('route-info-row')) {
        // Remove the existing details row if clicked again
        rowElement.parentNode.removeChild(existingDetailRow);
        rowElement.classList.remove('route-info-row-header');
        rowElement.classList.remove('route-info-row');
        return; // Exit the function after removing the row
    }

    // Create a new row for detailed information
    const detailRow = document.createElement('tr');
    const detailCell = document.createElement('td');
    const flight = fullFlightData;
    detailCell.colSpan = 9;  // Assuming there are 9 columns in your table
    detailCell.innerHTML = `
        <div>Route Details for ${flight.airlines.join(", ")}:</div>
        <div>Price: $${flight.price.toFixed(2)}</div>
        <button id="selectRoute">Select Route</button>
    `;
    detailRow.classList.add('route-info-row');
    detailRow.appendChild(detailCell);

    // add selected class to the clicked row in the table
    rowElement.classList.add('route-info-row');
    rowElement.classList.add('route-info-row-header');

    // Insert the new row right after the clicked row in the table
    if (rowElement.nextSibling) {
        rowElement.parentNode.insertBefore(detailRow, rowElement.nextSibling);
    } else {
        rowElement.parentNode.appendChild(detailRow);  // Append to the end if there's no next sibling
    }

    detailRow.addEventListener('mouseover', () => {
      highlightRoutePath(fullFlightData.route);
    });

    detailRow.addEventListener('mouseout', () => {
        pathDrawing.clearLines();  // Clear the highlighted route path
        pathDrawing.drawLines();  // Optionally redraw other paths if needed
    });

    const selectRouteButton = detailCell.querySelector('#selectRoute');
    selectRouteButton.addEventListener('click', () => {
      console.log('selectRouteButton clicked');
           // Determine the group ID for the newly selected route
           appState.highestGroupId += 1;
           let newRouteGroupId = appState.highestGroupId;
           const existingRouteDetails = appState.selectedRoutes[routeIndex];
           if (existingRouteDetails) {
               // Logic to remove routes from the old group, if necessary
               Object.keys(appState.selectedRoutes).forEach(key => {
                   if (appState.selectedRoutes[key].group == existingRouteDetails.group) {
                       updateState('removeSelectedRoute', parseInt(key));
                   }
               });
           }

           const departureDate = new Date((fullFlightData.local_departure || fullFlightData.dTime * 1000)).toISOString().split('T')[0];
    
           // Update appState for the selected route
           routeIds.forEach((id, idx) => {
               const segmentData = fullFlightData.route[idx];
               console.log('segmentData:', segmentData);
               const departureDate = new Date(segmentData.local_departure || segmentData.dTime).toISOString().split('T')[0];
               const displayData = {
                   departure: new Date((segmentData.local_departure || segmentData.dTime * 1000)).toLocaleString(),
                   arrival: new Date((segmentData.local_arrival || segmentData.aTime * 1000)).toLocaleString(),
                   price: `$${fullFlightData.price}`,
                   airline: segmentData.airline,
                   stops: fullFlightData.route.length - 1,
                   route: `${segmentData.flyFrom} > ${segmentData.flyTo}`,
                   deep_link: fullFlightData.deep_link,
               };
    
               const selectedRouteIndex = routeIndex + idx;
               if (!appState.routeDates[selectedRouteIndex]) {
                   appState.routeDates[selectedRouteIndex] = departureDate;
               }
    
               if (appState.selectedRoutes.hasOwnProperty(selectedRouteIndex)) {
                 const keys = Object.keys(appState.selectedRoutes).map(Number).filter(key => key >= selectedRouteIndex).sort((a, b) => b - a); // Sort keys in descending order to avoid overwriting
                 keys.forEach(key => {
                     appState.selectedRoutes[key + 1] = appState.selectedRoutes[key]; // Shift each route up by one index
                 });
             }
             
             appState.selectedRoutes[selectedRouteIndex] = {
                 displayData: displayData,
                 fullData: segmentData,
                 group: newRouteGroupId !== null ? newRouteGroupId : routeIndex,
                 routeDates: departureDate,
             };
           });
           const routeIATAs = fullFlightData.route.map(r => r.flyFrom).concat(fullFlightData.route[flight.route.length - 1].flyTo).join(" > ");
           const routeString = routeIATAs.trim(); // Assuming the IATA codes are in the 9th column
           const iataCodes = routeString.split(' > ');
           replaceWaypointsForCurrentRoute(iataCodes, routeIndex);
           updateState('updateRouteDate: ', routeIndex, departureDate);
           updateState('changeView', 'trip');
           highlightSelectedRowForRouteIndex(routeIndex);
  });
}

function highlightSelectedRowForRouteIndex(routeIndex) {
  document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr.selected`).forEach(row => {
    row.classList.remove('selected');
  });

  const selectedRouteDetails = appState.selectedRoutes[routeIndex];
  if (selectedRouteDetails && selectedRouteDetails.id) {
    let selectedRow = document.querySelector('.route-info-table tbody tr');
    if (!selectedRow) {
      document.querySelectorAll(`.route-info-table[data-route-index="${routeIndex}"] tbody tr`).forEach(row => {
        const routeId = row.getAttribute('data-route-id');
        if (routeId && routeId.split('|').includes(selectedRouteDetails.id)) {
          selectedRow = row;
        }
      });
    }
    
    if (selectedRow) {
      selectedRow.classList.add('selected');
    }
  }
}

function highlightRoutePath(route) {
  pathDrawing.clearLines();
  const iataCodes = route.map(r => r.flyFrom).concat(route[route.length - 1].flyTo);
  for (let i = 0; i < iataCodes.length - 1; i++) {
      const originIata = iataCodes[i];
      const destinationIata = iataCodes[i + 1];
      pathDrawing.drawPathBetweenAirports(originIata, destinationIata, flightMap.getAirportDataByIata);
  }
}

function replaceWaypointsForCurrentRoute(intermediaryIatas, routeIndex) {
  // Adjust startIndex for round trips to ensure the entire waypoints array is considered
  const startIndex = appState.roundTrip ? 0 : routeIndex * 2;
  let before = appState.waypoints.slice(0, startIndex);
  let after = appState.roundTrip ? [] : appState.waypoints.slice((routeIndex + 1) * 2);

  let updatedSegment = [flightMap.airportDataCache[intermediaryIatas[0]]];

  for (let i = 1; i < intermediaryIatas.length; i++) {
      let airportData = flightMap.airportDataCache[intermediaryIatas[i]];
      updatedSegment.push(airportData);
      if (i < intermediaryIatas.length - 1) {
          updatedSegment.push(airportData);
      }
  }

  // For round trips, ensure the return to the origin is explicitly handled
  if (appState.roundTrip) {
      const originIata = intermediaryIatas[0];
      if (updatedSegment[updatedSegment.length - 1].iata_code !== originIata) {
          updatedSegment.push(flightMap.airportDataCache[originIata]);
      }
  } else {
      // For non-round trips, ensure the final destination is added if not already present
      const finalDestinationIata = intermediaryIatas[intermediaryIatas.length - 1];
      if (updatedSegment[updatedSegment.length - 1].iata_code !== finalDestinationIata) {
          updatedSegment.push(flightMap.airportDataCache[finalDestinationIata]);
      }
  }

  appState.waypoints = [...before, ...updatedSegment, ...after];
  updateState('updateWaypoint', appState.waypoints);
}

export { routeInfoRow, highlightSelectedRowForRouteIndex };