import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField, fetchAirportByIata } from '../airportAutocomplete.js';
import { buildRouteTable } from '../routeTable/routeTable.js';
import { initDatePicker } from './datePicker.js';
import { travelersPicker } from './travelersPicker.js';
import { tripTypePicker } from './tripTypePicker.js';
import { removeRoute } from './removeRoute.js';
import { routeHandling } from '../routeHandling.js';

const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

const routeBox = {
    showRouteBox: function(event, routeNumber) {
        let existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) {
            existingRouteBox.remove();
        }

        let routeBox = document.createElement('div');
        routeBox.id = 'routeBox';
        routeBox.className = 'route-box-popup';
        document.body.appendChild(routeBox);

        const topRow = document.createElement('div');
        topRow.id = 'topRow';
        topRow.className = 'top-row';
        routeBox.prepend(topRow);

        const tripTypeDropdown = tripTypePicker();
        topRow.appendChild(tripTypeDropdown);

        const travelersDropdown = travelersPicker(routeNumber);
        topRow.appendChild(travelersDropdown);

        if (routeNumber > 0 && !appState.waypoints[(routeNumber * 2)]) {
            let previousDestinationIndex = (routeNumber * 2) - 1;
            let previousDestination = appState.waypoints[previousDestinationIndex];
            if (previousDestination) {
                appState.waypoints[routeNumber * 2] = previousDestination;  // Set the previous destination as the current origin
            }
        }        

        let waypointInputsContainer = document.createElement('div');
        waypointInputsContainer.className = 'waypoint-inputs-container';
        routeBox.appendChild(waypointInputsContainer);

        let placeholders = ['From', 'To'];

        let waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];
    
        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + waypointsOrder[i];
            let waypoint = appState.waypoints[index];
            let inputWrapper = document.createElement('div');
            inputWrapper.className = 'input-wrapper';
        
            let input = document.createElement('input');
            input.type = 'text';
            input.id = `waypoint-input-${index + 1}`;
            input.classList.add('waypoint-input');
            input.placeholder = placeholders[i];
            input.value = waypoint ? waypoint.city + ', ' + waypoint.country + ' (' + waypoint.iata_code + ')' : '';

            // Create the fade overlay element
            let fadeOverlay = document.createElement('div');
            fadeOverlay.className = 'fade-overlay';
        
            let clearSpan = document.createElement('span');
            clearSpan.innerHTML = '✕';
            clearSpan.className = 'clear-span';
            clearSpan.style.visibility = input.value ? 'visible' : 'hidden'; // Initial visibility based on input value
            clearSpan.onclick = function() {
                input.value = '';
                clearSpan.style.visibility = 'hidden'; // Hide clear button when input is cleared
                input.focus();
            };
        
            input.oninput = function() { // Update visibility on input change
                clearSpan.style.visibility = input.value ? 'visible' : 'hidden';
            };
        
            inputWrapper.appendChild(input);
            inputWrapper.appendChild(fadeOverlay);
            inputWrapper.appendChild(clearSpan);
            waypointInputsContainer.appendChild(inputWrapper);        
            
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
            suggestionsDiv.className = 'suggestions';
            waypointInputsContainer.appendChild(suggestionsDiv);
        }

        for (let i = 0; i < 2; i++) {
            let index = (routeNumber) * 2 + i;
            setupAutocompleteForField(`waypoint-input-${index + 1}`);
        }
        
        // Adjust the swap button positioning
        let swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;'; // Double-headed arrow symbol
        swapButton.className = 'swap-route-button';
        swapButton.onclick = () => handleSwapButtonClick(routeNumber);
        swapButton.title = 'Swap waypoints'; // Tooltip for accessibility
        
        // Place swap button between the two input wrappers
        let inputWrappers = waypointInputsContainer.querySelectorAll('.input-wrapper');
        if (inputWrappers.length === 2) {
            waypointInputsContainer.insertBefore(swapButton, inputWrappers[1]);
        }                      

        //let firstInput = waypointInputsContainer.querySelector('input[type="text"]');
        //waypointInputsContainer.insertBefore(swapButton, firstInput.nextSibling);

        const currentRouteDate = appState.routeDates[routeNumber] || '';
        const isDateRange = appState.routeDates[routeNumber] && appState.routeDates[routeNumber].includes(' to ');
        
        const dateInputId = 'date-input';
        let dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'date-input';
        dateInput.value = currentRouteDate;
        dateInput.className = 'date-input';
        dateInput.placeholder = 'Date';
        routeBox.appendChild(dateInput);

        initDatePicker(dateInputId, routeNumber);

        let fromInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 1));
        let toInput = document.getElementById('waypoint-input-' + (routeNumber * 2 + 2));

        if (!fromInput.value) {
            fromInput.focus();
        } else if (!toInput.value) {
            toInput.focus();
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';  // This class will be used for CSS styling

        let searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.className = 'search-button';
        searchButton.onclick = () => {
            const infoPaneContent = document.getElementById('infoPaneContent');
            infoPaneContent.innerHTML = '';
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        }

        let closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';

        buttonContainer.appendChild(searchButton);
        buttonContainer.appendChild(closeButton); // If you want the close button next to search/remove

        // Assuming removeRouteButton appends the button inside the passed container
        removeRoute.removeRouteButton(buttonContainer, routeNumber);

        routeBox.appendChild(buttonContainer);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';
    },

    positionPopup: function(popup, event) {
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10;

        let leftPosition = iconRect.left + window.scrollX - (popupWidth / 2) + (iconRect.width / 2);
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - popup.offsetHeight - 10}px`; // Position above the icon
    },
}

document.addEventListener('click', function(event) {
    let routeBox = document.getElementById('routeBox');
    const routeNumber = appState.currentRouteIndex;
    let routeButton = document.getElementById(`route-button-${routeNumber}`);

    function hasParentWithClass(element, className) {
        while (element) {
            if (element.classList && element.classList.contains(className)) {
                return true;
            }
            element = element.parentNode;
        }
        return false;
    }

    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton && !hasParentWithClass(event.target, 'do-not-close-routebox')) {
        routeBox.style.display = 'none';
    }
}, true);

function handleSwapButtonClick(routeNumber) {
    let waypointInputsContainer = document.getElementById('routeBox').querySelector('.waypoint-inputs-container');
    let inputs = waypointInputsContainer.querySelectorAll('input[type="text"]');
    if (inputs.length === 2) {
        // Swap the values of the input fields
        let temp = inputs[0].value;
        inputs[0].value = inputs[1].value;
        inputs[1].value = temp;
        // Update the appState.waypoints array
        let waypointIndex = (routeNumber) * 2;
        [appState.waypoints[waypointIndex], appState.waypoints[waypointIndex + 1]] = 
            [appState.waypoints[waypointIndex + 1], appState.waypoints[waypointIndex]];
        routeHandling.updateRoutesArray();
        updateUrl();
    }
} 

export { routeBox };