import { map } from './map.js';
import { flightList } from './flightList.js';
import { updateState, appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    flightPathCache: {},

    drawFlightPaths(iata, directFlights) {
        console.log('Drawing flight paths: ' + iata, directFlights);
        let cacheKey = appState.flightPathToggle + '_' + iata;
        if (this.flightPathCache[cacheKey]) {
            this.flightPathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                if (!this.currentLines.includes(path)) {
                    this.currentLines.push(path);
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
        let flightId = `${flight.originAirport.iata_code}-${flight.destinationAirport.iata_code}-${lngOffset}`;
        if (this.flightPathCache[flightId]) {
            return; // Path already exists, no need to create a new one
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
        // Create a set of flight IDs that should not be cleared
        const listedFlightIds = new Set(appState.flights.map(flight => 
            `${flight._id}`
        ));
    
        // Iterate over currentLines and remove lines not in listedFlightIds
        this.currentLines.forEach(line => {
            if (!listedFlightIds.has(line.flight._id) && map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Filter out the cleared lines from currentLines
        this.currentLines = this.currentLines.filter(line => 
            listedFlightIds.has(line.flight._id)
        );

        Object.keys(this.flightPathCache).forEach(cacheKey => {
            this.flightPathCache[cacheKey] = this.flightPathCache[cacheKey].filter(line => 
                listedFlightIds.has(line.flight._id)
            );
    
            // If the cache entry is now empty, delete it
            if (this.flightPathCache[cacheKey].length === 0) {
                delete this.flightPathCache[cacheKey];
            }
        });
    },
    
    drawPaths(flight) {
        this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, 0);
        for (let offset = -720; offset <= 720; offset += 360) {
            if (offset !== 0) {
                this.createFlightPath(flight.originAirport, flight.destinationAirport, flight, offset);
            }
        }
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