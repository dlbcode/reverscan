module.exports = function(app, axios, db) {
  app.get('/yhoneway', async (req, res) => {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).send('Origin, destination, and date are required');
    }

    const flightKey = `${origin}-${destination}`;
    const cacheCollection = db.collection('cache');
    
    // Check cache first
    try {
      const cachedData = await cacheCollection.findOne({ flight: flightKey });
      if (cachedData && cachedData.queriedAt) {
        // Convert queriedAt to 'yyyy-mm-dd' format for comparison
        const cachedDate = cachedData.queriedAt.toISOString().split('T')[0];
        
        if (cachedDate === date) {
          const hoursDiff = (new Date() - cachedData.queriedAt) / (1000 * 60 * 60);
          if (hoursDiff <= 24) {
            // Data is fresh and for the correct date, return cached data
            return res.json(cachedData.data);
          }
          // Data is older than 24 hours or not for the requested date, proceed to fetch new data
        }
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
    }

    // Proceed with Tequila API request
    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${date}&date_to=${date}&flight_type=oneway&partner=picky&curr=USD`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      if (response.data && response.data.data) {
        const sortedFlights = response.data.data.sort((a, b) => a.price - b.price);

        // Update cache with new data
        console.log(`Updating cache for flight ${flightKey}`);
        await cacheCollection.updateOne(
          { flight: flightKey },
          { $set: { data: sortedFlights, queriedAt: new Date() } },
          { upsert: true }
        );

        // Check for direct flights and compare prices with directRoutes collection
        console.log('Checking direct flights');
        for (const flight of sortedFlights) {
          for (const route of flight.route) {
            const existingDirectRoute = await db.collection('directRoutes').findOne({
              origin: route.flyFrom,
              destination: route.flyTo
            });

            if (existingDirectRoute) {
              if (existingDirectRoute.price > flight.price) {
                console.log(`Updating direct route from ${route.flyFrom} to ${route.flyTo} with lower price: ${flight.price}`);
                await db.collection('directRoutes').updateOne(
                  { _id: existingDirectRoute._id },
                  { $set: {
                      price: flight.price,
                      timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
                      source: 'tequila'
                    }
                  }
                );
              } else {
                console.log(`Existing price for direct route from ${route.flyFrom} to ${route.flyTo} is lower or equal; no update needed.`);
              }
            } else {
              console.log(`No existing direct route found for ${route.flyFrom} to ${route.flyTo}; inserting new.`);
              await db.collection('directRoutes').insertOne({
                origin: route.flyFrom,
                destination: route.flyTo,
                price: flight.price,
                timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
                source: 'tequila'
              });
            }
          }
        }

        res.json(sortedFlights);
      } else {
        res.status(500).send("No flight data found");
      }
    } catch (error) {
      console.error("Error fetching one-way flights data:", error.response ? error.response.data : error.message);
      res.status(500).send("Error fetching one-way flights data");
    }
  });

  // Endpoint for searching return flights
  app.get('/yhreturn', async (req, res) => {
    const { origin, destination, departureDate, returnDate } = req.query;

    if (!origin || !destination || !departureDate || !returnDate) {
      return res.status(400).send('Origin, destination, departure date, and return date are required');
    }

    const config = {
      method: 'get',
      url: `https://tequila-api.kiwi.com/v2/search?fly_from=${origin}&fly_to=${destination}&date_from=${departureDate}&date_to=${returnDate}&flight_type=round&partner=picky`,
      headers: { 
        'apikey': process.env.TEQUILA_API_KEY
      }
    };

    try {
      const response = await axios(config);
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching return flights data:", error.response ? error.response.data : error.message); // More detailed error logging
      res.status(500).send("Error fetching return flights data");
    }
  });
};
