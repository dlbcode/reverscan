module.exports = function(app, amadeus, flightsCollection) {
  app.get('/atcd', async (req, res) => {
    try {
        const { origin, destination, oneWay } = req.query;

        if (!origin || !destination) {
            return res.status(400).send('Origin and destination IATA codes are required');
        }

        // Calculate the timestamp for one day ago
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const oneDayAgoIso = oneDayAgo.toISOString();

        // Check for existing flights less than one day old
        const existingFlights = await flightsCollection.find({
            origin: origin,
            destination: destination,
            timestamp: { $gte: oneDayAgoIso }
        }).toArray();

        if (existingFlights.length > 0) {
            // Return existing flights if they are recent
            return res.json(existingFlights);
        }

        // Convert the oneWay string to a boolean
        const oneWayBool = oneWay === 'true';

        const response = await amadeus.shopping.flightDates.get({
            origin: origin,
            destination: destination,
            oneWay: oneWayBool
        });

        // Group flights by departureDate and find the cheapest flight for each date
        const cheapestFlights = response.data.reduce((acc, flight) => {
            const departureDate = flight.departureDate;
            if (!acc[departureDate] || flight.price.total < acc[departureDate].price) {
                acc[departureDate] = {
                    origin: origin,
                    destination: destination,
                    departureDate: departureDate,
                    returnDate: flight.returnDate,
                    price: flight.price.total,
                    timestamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12),
                    source: "atcd"
                };
            }
            return acc;
        }, {});

        // Convert the map to an array of bulk operations
        const bulkOps = Object.values(cheapestFlights).map(flight => ({
            updateOne: {
                filter: {
                    origin: flight.origin,
                    destination: flight.destination,
                    departureDate: flight.departureDate
                },
                update: { $set: flight },
                upsert: true
            }
        }));

        // Execute bulk operations
        if (bulkOps.length > 0) {
            await flightsCollection.bulkWrite(bulkOps);
        }

        res.json(Object.values(cheapestFlights));
    } catch (error) {
        console.error('Error fetching cheapest date/flight information:', error);
        res.status(500).send(`Error fetching cheapest date/flight information: ${error.message}`);
    }
  });
};