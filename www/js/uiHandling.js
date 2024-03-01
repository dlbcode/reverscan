import { appState, updateState } from "./stateManager.js";
import { adjustMapSize } from "./map.js";

const uiHandling = {

  initTravelersDropdown: function() {
    if (this.travelersDropdownInitialized) return; // Prevent multiple initializations
    this.travelersDropdownInitialized = true;

    const dropdownBtn = document.getElementById('travelersDropdownBtn');
    const dropdown = document.getElementById('travelersDropdown');

    dropdownBtn.addEventListener('click', function() {
        dropdown.classList.toggle('hidden');
    });

    dropdown.addEventListener('click', function(event) {
        const item = event.target.closest('li');
        if (item) {
            const numTravelersText = item.textContent.match(/\d+/)[0];
            const numTravelers = parseInt(numTravelersText, 10);
            document.getElementById('travelersDropdownBtn').innerHTML = `<img src="assets/person.svg" alt="" class="icon-person"> ${numTravelersText} <span class="icon-dropdown"></span>`;
            dropdown.classList.add('hidden');
            updateState('numTravelers', numTravelers);
        }
    });
  },  

  initTripTypeDropdown: function() {
    const dropdownBtn = document.getElementById('tripTypeDropdownBtn');
    const dropdown = document.getElementById('tripTypeDropdown');
    dropdownBtn.innerHTML = appState.oneWay ? 'One way <span class="icon-dropdown"></span>' : 'Round trip <span class="icon-dropdown"></span>';
    
    document.addEventListener('routesArrayUpdated', this.handleStateChange.bind(this));
    dropdownBtn.addEventListener('click', function() {
        dropdown.innerHTML = '';
        const optionToShow = dropdownBtn.textContent.trim() === 'One way' ? 'Round trip' : 'One way';
        const li = document.createElement('li');
        li.textContent = optionToShow;
        dropdown.appendChild(li);
        dropdown.classList.toggle('hidden');
    });

    dropdown.addEventListener('click', function(event) {
        if (event.target.tagName === 'LI') {
            dropdownBtn.innerHTML = `${event.target.textContent} <span class="icon-dropdown"></span>`;
            const isOneWay = event.target.textContent === 'One way';
            updateState('oneWay', isOneWay);
            dropdown.classList.add('hidden');
        }
    });
  },

  hideDropdowns: function() {
    document.addEventListener('click', function(event) {
        const dropdownSelectors = ['#travelersDropdown', '#tripTypeDropdown'];
        dropdownSelectors.forEach(selector => {
            const dropdown = document.getElementById(selector.substring(1));
            const dropdownBtn = document.querySelector(`${selector}Btn`);
            if (dropdown && !dropdown.contains(event.target) && !dropdownBtn.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });
  },

  handleStateChange: function(event) {
        this.updateTripTypeContainerVisibility();
  },

  updateTripTypeContainerVisibility: function() {
    const tripTypeDropdownBtn = document.getElementById('tripTypeDropdownBtn');
    if (appState.routes.length > 1 && (!appState.oneWay)) {
      updateState('oneWay', true);
      tripTypeDropdownBtn.disabled = true;
      tripTypeDropdownBtn.innerHTML = "One way <span class='icon-dropdown'></span";
    } else {
        tripTypeDropdownBtn.disabled = false;
    }
  },  

  initTripButtons: function() {
    const addButton = document.getElementById('addBtn');
    addButton.addEventListener('click', () => this.handleAddButtonClick());
    this.toggleTripButtonsVisibility(false);
  },

  toggleTripButtonsVisibility: function() {
    document.getElementById('tripButtons').style.display =
      appState.waypoints.length > 1 && appState.oneWay ? 'flex' : 'none';
      addBtn.focus();
  },

  handleAddButtonClick: function() {
    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1];
    updateState('addWaypoint', lastWaypoint);
    const newRouteNumber = Math.ceil(appState.waypoints.length / 2);
  },

  setFocusToNextUnsetInput: function() {
    const waypointInputs = document.querySelectorAll('.airport-selection input[type="text"]');
    requestAnimationFrame(() => {
        for (let input of waypointInputs) {
            if (!input.value) {
                input.focus();
                break;
            }
        }
    });
  },

  updateTripTypeDropdownBasedOnAppState: function() {
    const tripTypeDropdownBtn = document.getElementById('tripTypeDropdownBtn');
    const tripTypeDropdown = document.getElementById('tripTypeDropdown');

    tripTypeDropdownBtn.innerHTML = appState.oneWay ? 'One way <span class="icon-dropdown"></span>' : 'Round trip <span class="icon-dropdown"></span>';
    tripTypeDropdown.innerHTML = '';
    const oppositeOption = document.createElement('li');
    oppositeOption.textContent = appState.oneWay ? 'Round trip' : 'One way';

    tripTypeDropdown.appendChild(oppositeOption);
    oppositeOption.onclick = () => {
        updateState('oneWay', false);
    };
  },
  
  initTogglePaneButton: function() {
    const toggleBtn = document.getElementById('togglePaneBtn');
    const leftPane = document.querySelector('.leftPane');
    const mapPane = document.querySelector('.mapPane');

    toggleBtn.addEventListener('click', () => {
        leftPane.classList.toggle('leftPane-hidden');
        mapPane.classList.toggle('mapPane-expanded');
        adjustMapSize();

        if (leftPane.classList.contains('leftPane-hidden')) {
            toggleBtn.style.left = '0px';
            toggleBtn.textContent = '❯';
        } else {
            toggleBtn.style.left = '170px';
            toggleBtn.textContent = '❮';
        }
    });
  },

  initInfoPaneDragButton: function() {
    const infoPane = document.getElementById('infoPane');
    const resizeHandle = document.getElementById('resizeHandle');

    let startY, startHeight;

    const startDrag = function(e) {
      if (e.cancelable) {
        e.preventDefault();
      }

        // Use touch events if available, otherwise use mouse event
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startY = clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(infoPane).height, 10);

        // Add event listeners for both mouse and touch move/end events
        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
        document.documentElement.addEventListener('touchmove', doDrag, { passive: false });
        document.documentElement.addEventListener('touchend', stopDrag, false);
    };

    const doDrag = function(e) {
      if (e.cancelable) {
        e.preventDefault();
      }

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const newHeight = startHeight - (clientY - startY);
        infoPane.style.height = `${newHeight}px`;
        requestAnimationFrame(adjustMapSize);
    };

    const stopDrag = function() {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
        document.documentElement.removeEventListener('touchmove', doDrag, false);
        document.documentElement.removeEventListener('touchend', stopDrag, false);
    };

    resizeHandle.addEventListener('mousedown', startDrag, false);
    resizeHandle.addEventListener('touchstart', startDrag, { passive: false });
  },

  getPriceButton: function () {
    if (appState.waypoints.length === 2) {
        document.getElementById('getPriceBtn').classList.remove('hidden');
    } else {
        document.getElementById('getPriceBtn').classList.add('hidden');
    }
  }
}

document.addEventListener('stateChange', function(event) {
  if (event.detail.key === 'oneWay') {
    uiHandling.updateTripTypeDropdownBasedOnAppState();
    uiHandling.toggleTripButtonsVisibility();
    
  }
});

document.addEventListener('DOMContentLoaded', () => {
  uiHandling.initTravelersDropdown();
  uiHandling.initTripTypeDropdown();
  uiHandling.initTogglePaneButton();
  uiHandling.initInfoPaneDragButton();
  uiHandling.hideDropdowns();
  uiHandling.initTripButtons();
});

export { uiHandling }
