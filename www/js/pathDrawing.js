import { map } from './map.js';
import { flightList } from './flightList.js';
import { updateState, appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    flightPathCache: {},

    drawFlightPaths(iata, directFlights) {
        let cacheKey = appState.flightPathToggle + '_' + iata;
        if (this.flightPathCache[cacheKey]) {
            this.flightPathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    console.log('Adding path to map');
                    path.addTo(map);
                }
            });
        } else {
            appState.flightPathToggle === 'to' ? this.drawFlightPathsToDestination(iata, directFlights) : this.drawFlightPathsFromOrigin(iata, directFlights);
        }
    },
    
    drawFlightPathsFromOrigin(originIata, directFlights) {
        Object.values(directFlights).forEach(flights =>
            flights.forEach(flight => {
                if (flight.originAirport.iata_code === originIata) {
                    this.drawPaths(flight, originIata);
                }
            })
        );
    },

    drawFlightPathsToDestination(destinationIata, directFlights) {
        const destinationFlights = directFlights[destinationIata] || [];
        destinationFlights.forEach(flight => this.drawPaths(flight, destinationIata));
    },

    async drawFlightPathBetweenAirports(route, getAirportDataByIata) {
        this.clearFlightPaths();
        try {
            if (!route || !Array.isArray(route.segmentCosts)) {
                console.error('Invalid route data:', route);
                return;
            }

            const airportPromises = route.segmentCosts.map(segment => {
                return Promise.all([getAirportDataByIata(segment.from), getAirportDataByIata(segment.to)]);
            });

            const airportPairs = await Promise.all(airportPromises);
            airportPairs.forEach(([originAirport, destinationAirport], index) => {
                if (originAirport && destinationAirport) {
                    const flightSegment = {
                        originAirport: originAirport,
                        destinationAirport: destinationAirport,
                        price: route.segmentCosts[index].price
                    };

                    this.createFlightPath(originAirport, destinationAirport, flightSegment, 0);
                    flightList.addFlightDetailsToList(flightSegment, this.clearFlightPaths.bind(this));
                }
            });
        } catch (error) {
            console.error('Error in drawFlightPathBetweenAirports:', error);
        }
    },
    
    createFlightPath(origin, destination, flight, lngOffset) {
        console.log('createFlightPath - Creating flight path');
        let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`;
        if (this.flightPathCache[flightId]) {
            console.log('createFlightPath - Path already exists');
            // Add the cached path to the map if it's not already there
            this.flightPathCache[flightId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
            return;
        }

        var adjustedOrigin = [origin.latitude, origin.longitude + lngOffset];
        var adjustedDestination = [destination.latitude, destination.longitude + lngOffset];

        var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 1,
            opacity: 1,
            color: this.getColorBasedOnPrice(flight.price),
            wrap: false,
            zIndex: -1
        }).addTo(map);

        geodesicLine.flight = flight;

        geodesicLine.on('click', () => {
            if (flightList.isFlightListed(flight)) {
                flightList.removeFlightFromList(flight);
                this.clearFlightPaths();
            } else {
                flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            }
        });

        geodesicLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(map);
        });

        geodesicLine.on('mouseout', () => {
            map.closePopup();
        });

        // Load the plane icon
        var planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        // Replace arrow symbol with plane icon
        var planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        // Update polylineDecorator with planeSymbol
        var decoratedLine = L.polylineDecorator(geodesicLine, {
            patterns: [
                {offset: '50%', repeat: 0, symbol: planeSymbol}
            ]
        }).addTo(map);

        this.currentLines.push(geodesicLine, decoratedLine);

        let destinationIata = flight.destinationAirport.iata_code;
        let originIata = flight.originAirport.iata_code;
        let cacheKey = appState.flightPathToggle + '_' + (appState.flightPathToggle === 'to' ? destinationIata : originIata);

        this.flightPathCache[cacheKey] = this.flightPathCache[cacheKey] || [];
        this.flightPathCache[cacheKey].push(geodesicLine, decoratedLine);

        decoratedLine.on('mouseover', (e) => {
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`Price: $${flight.price}`)
                .openOn(map);
        });

        decoratedLine.on('mouseout', () => {
            map.closePopup();
        });

        decoratedLine.on('click', () => {
            flightList.addFlightDetailsToList(flight, this.clearFlightPaths.bind(this));
            this.clearFlightPaths();
        });

        geodesicLine.flight = flight;
        decoratedLine.flight = flight;

        this.currentLines.push(geodesicLine, decoratedLine);
        this.flightPathCache[flightId] = [geodesicLine, decoratedLine];
    },

    clearFlightPaths() {
        console.log('Clearing flight paths');
        const selectedFlightIds = new Set(appState.flights.map(flight => `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}`));
    
        // Clear current lines
        this.currentLines.forEach(line => {
            const flightId = `${line.flight.originAirport.iata_code}-${line.flight.destinationAirport.iata_code}`;
            if (!selectedFlightIds.has(flightId) && map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Update currentLines to keep only selected flights
        this.currentLines = this.currentLines.filter(line => {
            const flightId = `${line.flight.originAirport.iata_code}-${line.flight.destinationAirport.iata_code}`;
            return selectedFlightIds.has(flightId);
        });
    
        // Clear paths from cache that are not part of selected flights
        Object.keys(this.flightPathCache).forEach(cacheKey => {
            if (!selectedFlightIds.has(cacheKey)) {
                this.flightPathCache[cacheKey].forEach(path => {
                    if (map.hasLayer(path)) {
                        map.removeLayer(path);
                    }
                });
                delete this.flightPathCache[cacheKey];
            }
        });
    },       
    
    drawPaths(flight) {
        console.log('drawPaths: flight:', flight);
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
    },       

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey'; // Return grey for flights without price data
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    }
};

export { pathDrawing };
