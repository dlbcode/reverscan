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
        const hoursDiff = (new Date() - new Date(cachedData.queriedAt)) / (1000 * 60 * 60);
        if (hoursDiff <= 24) {
          // Data is fresh, return cached data
          return res.json(cachedData.data);
        }
        // Data is older than 24 hours, proceed to fetch new data
      }
    } catch (error) {
      console.error("Error accessing cache:", error);
      // Optionally handle error, e.g., by logging or returning an error response
      // For this example, we'll proceed to fetch new data even if cache access fails
    }

    // Proceed with Tequila API request if no valid cache found
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
        const sortedFlights = response.data.data.sort((a, b) => a.price.total - b.price.total);

        // Update cache with new data
        await cacheCollection.updateOne(
          { flight: flightKey },
          { $set: { data: sortedFlights, queriedAt: new Date() } },
          { upsert: true }
        );

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
