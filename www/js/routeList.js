import { appState } from './stateManager.js';

const routeList = {

    numTravelers: 1,

    init() {
        this.initTravelersDropdown();
        this.addStateChangeListener();
    },

    initTravelersDropdown: function() {
        const travelersDropdown = document.getElementById('travelersDropdown');
        travelersDropdown.addEventListener('change', (event) => {
            this.numTravelers = parseInt(event.target.value, 10);
            this.updateTotalCost();
        });
    },

    updateTotalCost: function() {
        let totalCost = 0;
        appState.routes.forEach(route => {
            totalCost += route.price;
        });

        // Double the cost if the trip is not one-way
        if (!appState.oneWay) {
            totalCost *= 2;
        }

        totalCost *= this.numTravelers;
        document.getElementById('totalCost').textContent = `Estimated price: $${totalCost.toFixed(2)}`;
    },

    addStateChangeListener() {
        document.addEventListener('stateChange', (event) => {
            if (event.detail.key === 'oneWay' || event.detail.key === 'numTravelers' || event.detail.key === 'routes') {
                this.updateTotalCost();
            }
        });
    }
};

routeList.init();

export { routeList };
