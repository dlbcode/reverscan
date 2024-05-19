import { appState, updateState, updateUrl } from '../stateManager.js';
import { setupAutocompleteForField } from '../airportAutocomplete.js';
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
    showRouteBox(event, routeNumber) {
        const existingRouteBox = document.getElementById('routeBox');
        if (existingRouteBox) existingRouteBox.remove();

        const routeBox = document.createElement('div');
        routeBox.id = 'routeBox';
        routeBox.className = 'route-box-popup';
        document.body.appendChild(routeBox);

        const topRow = document.createElement('div');
        topRow.id = 'topRow';
        topRow.className = 'top-row';
        routeBox.prepend(topRow);

        topRow.append(tripTypePicker(), travelersPicker(routeNumber));

        if (routeNumber > 0 && !appState.waypoints[routeNumber * 2]) {
            const previousDestination = appState.waypoints[(routeNumber * 2) - 1];
            if (previousDestination) appState.waypoints[routeNumber * 2] = previousDestination;
        }

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        const fromTab = this.createTab('From', 'from-tab');
        const toTab = this.createTab('To', 'to-tab');
        tabsContainer.append(fromTab, toTab);
        routeBox.appendChild(tabsContainer);

        this.setupTabSwitching(routeNumber);

        const waypointInputsContainer = document.createElement('div');
        waypointInputsContainer.className = 'waypoint-inputs-container';
        routeBox.appendChild(waypointInputsContainer);

        const placeholders = ['From', 'To'];
        const waypointsOrder = appState.routeDirection === 'to' ? [1, 0] : [0, 1];

        waypointsOrder.forEach((order, i) => {
            const index = routeNumber * 2 + order;
            const waypoint = appState.waypoints[index];
            const input = this.createWaypointInput(index, placeholders[i], waypoint, i);
            waypointInputsContainer.appendChild(input);
        });

        Array.from({ length: 2 }, (_, i) => setupAutocompleteForField(`waypoint-input-${routeNumber * 2 + i + 1}`));

        const swapButton = document.createElement('button');
        swapButton.innerHTML = '&#8646;';
        swapButton.className = 'swap-route-button';
        swapButton.title = 'Swap waypoints';
        swapButton.onclick = () => this.handleSwapButtonClick(routeNumber);

        const inputWrappers = waypointInputsContainer.querySelectorAll('.input-wrapper');
        if (inputWrappers.length === 2) waypointInputsContainer.insertBefore(swapButton, inputWrappers[1]);

        const currentRouteDate = appState.routeDates[routeNumber] || '';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'date-input';
        dateInput.value = currentRouteDate;
        dateInput.className = 'date-input';
        dateInput.placeholder = 'Date';
        routeBox.appendChild(dateInput);

        initDatePicker(dateInput.id, routeNumber);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.className = 'search-button';
        searchButton.onclick = () => {
            document.getElementById('infoPaneContent').innerHTML = '';
            updateState('currentView', 'routeTable');
            buildRouteTable(routeNumber);
        };

        const closeButton = document.createElement('span');
        closeButton.innerHTML = '✕';
        closeButton.className = 'popup-close-button';
        closeButton.onclick = () => routeBox.style.display = 'none';

        buttonContainer.append(searchButton, closeButton);
        removeRoute.removeRouteButton(buttonContainer, routeNumber);

        routeBox.appendChild(buttonContainer);

        this.positionPopup(routeBox, event);
        routeBox.style.display = 'block';

        const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
        const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);

        if (!fromInput.value) {
            fromInput.focus();
        } else if (!toInput.value) {
            toInput.focus();
        }
    },

    createTab(text, tabId) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.id = tabId;
        tab.innerText = text;
        return tab;
    },

    createWaypointInput(index, placeholder, waypoint, order) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `waypoint-input-${index + 1}`;
        input.classList.add('waypoint-input');
        input.placeholder = placeholder;
        input.value = waypoint ? `${waypoint.city}, ${waypoint.country} (${waypoint.iata_code})` : '';

        const clearSpan = document.createElement('span');
        clearSpan.innerHTML = '✕';
        clearSpan.className = 'clear-span';
        clearSpan.style.display = input.value ? 'block' : 'none';
        clearSpan.onclick = () => {
            input.value = '';
            clearSpan.style.display = 'none';
            input.focus();
        };

        input.oninput = () => clearSpan.style.display = input.value ? 'block' : 'none';

        input.addEventListener('focus', () => {
            input.classList.add('focused');
            clearSpan.style.display = input.value ? 'block' : 'none';
            this.updateActiveTab(order === 0 ? 'from' : 'to');
        });

        input.addEventListener('blur', () => {
            input.classList.remove('focused');
            clearSpan.style.display = input.value ? 'block' : 'none';
            this.updateActiveTab();
        });

        inputWrapper.append(input, clearSpan);

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `waypoint-input-${index + 1}Suggestions`;
        suggestionsDiv.className = 'suggestions';
        inputWrapper.appendChild(suggestionsDiv);

        return inputWrapper;
    },

    handleTabClick(tab, routeNumber) {
        const fromInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 1}`);
        const toInput = document.getElementById(`waypoint-input-${routeNumber * 2 + 2}`);

        if (tab === 'from') {
            fromInput.focus();
            this.updateActiveTab('from');
        } else {
            toInput.focus();
            this.updateActiveTab('to');
        }
    },

    setupTabSwitching(routeNumber) {
        document.getElementById('from-tab').addEventListener('click', () => this.handleTabClick('from', routeNumber));
        document.getElementById('to-tab').addEventListener('click', () => this.handleTabClick('to', routeNumber));
    },

    updateActiveTab(activeTab = '') {
        document.getElementById('from-tab').classList.toggle('active', activeTab === 'from');
        document.getElementById('to-tab').classList.toggle('active', activeTab === 'to');
    },

    positionPopup(popup, event) {
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10;

        let leftPosition = iconRect.left + window.scrollX - (popupWidth / 2) + (iconRect.width / 2);
        leftPosition = Math.min(Math.max(leftPosition, screenPadding), window.innerWidth - popupWidth - screenPadding);

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - popup.offsetHeight - 10}px`;
    },

    handleSwapButtonClick(routeNumber) {
        const waypointInputsContainer = document.getElementById('routeBox').querySelector('.waypoint-inputs-container');
        const inputs = waypointInputsContainer.querySelectorAll('input[type="text"]');
        if (inputs.length === 2) {
            [inputs[0].value, inputs[1].value] = [inputs[1].value, inputs[0].value];
            const waypointIndex = routeNumber * 2;
            [appState.waypoints[waypointIndex], appState.waypoints[waypointIndex + 1]] =
                [appState.waypoints[waypointIndex + 1], appState.waypoints[waypointIndex]];
            routeHandling.updateRoutesArray();
            updateUrl();
        }
    },
};

document.addEventListener('click', function (event) {
    const routeBox = document.getElementById('routeBox');
    const routeButton = document.getElementById(`route-button-${appState.currentRouteIndex}`);

    if (routeBox && !routeBox.contains(event.target) && event.target !== routeButton &&
        !event.target.closest('.do-not-close-routebox')) {
        routeBox.style.display = 'none';
    }
}, true);

export { routeBox };
