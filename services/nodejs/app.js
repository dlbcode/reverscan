const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const app = express();
const port = 3000;
const cors = require('cors');
const mongodbPassword = process.env.MONGO_RSUSER_PASSWORD;

//// Middleware to check the referrer 
//function checkReferrer(req, res, next) {
//    const referrer = req.get('Referrer');
//    if (!referrer || 
//        (!referrer.startsWith('http://44.199.76.209') && 
//         !referrer.startsWith('http://localhost'))) {
//        return res.status(403).send('Access denied');
//    }
//    next();
//}

// use it before all route definitions
app.use(cors({
  origin: ['http://localhost:8002', 'http://44.199.76.209:8002']
}));

//// Apply the referrer check middleware to the API routes
//app.use('/airports', checkReferrer);
//app.use('/flights', checkReferrer);

// MongoDB connection URL and database name
const mongoUrl = `mongodb://rsuser:${mongodbPassword}@mongodb:27017/rsdb`;
const dbName = 'rsdb';

let db;
let airportsCollection;
let flightsCollection;

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  db = client.db(dbName);
  airportsCollection = db.collection('airports');
  flightsCollection = db.collection('flights');
  console.log('Connected to MongoDB');
});

app.get('/airports', async (req, res) => {
  try {
    const queryParam = req.query.query;
    let query = {};

    if (queryParam) {
      const regex = new RegExp("^" + queryParam, 'i'); // Strictly starts with the query
      
      // Check iata_code first, then other fields
      query = {
        $or: [
          { iata_code: regex },
          { $or: [{ name: regex }, { city: regex }, { country: regex }] }
        ]
      };
    }

    const airports = await airportsCollection.find(query).limit(7).toArray();
    res.json(airports);
  } catch (error) {
    res.status(500).send('Error fetching airports data');
  }
});

// Endpoint to get flights data
app.get('/flights', async (req, res) => {
  try {
      const flights = await flightsCollection.find({}).toArray();
      const airports = await airportsCollection.find({}).toArray();

      const airportMap = airports.reduce((map, airport) => {
          map[airport.iata_code] = airport;
          return map;
      }, {});

      const enrichedFlights = flights.map(flight => {
          return {
              ...flight,
              originAirport: airportMap[flight.origin],
              destinationAirport: airportMap[flight.destination]
          };
      });

      res.status(200).json(enrichedFlights);
  } catch (e) {
      console.error(e);
      res.status(500).send("Error fetching flights data");
  }
});

app.get('/cheapest-routes', async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;

  if (!origin || !destination) {
      return res.status(400).send('Origin and destination IATA codes are required');
  }

  try {
      const flights = await flightsCollection.find({}).toArray();
      let routes = findCheapestRoutes(flights, origin, destination);
      routes = routes.slice(0, 3); // Get top 3 cheapest routes

      res.json(routes);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error searching for routes');
  }
});

function findCheapestRoutes(flights, origin, destination) {
  let costs = {};
  let paths = {};

  flights.forEach(flight => {
      costs[flight.destination] = Infinity;
      paths[flight.destination] = [];
  });
  costs[origin] = 0;
  paths[origin] = [origin];

  for (let i = 0; i < flights.length; i++) {
      let updated = false;

      flights.forEach(flight => {
          if (costs[flight.origin] + flight.price < costs[flight.destination]) {
              costs[flight.destination] = costs[flight.origin] + flight.price;
              paths[flight.destination] = [...paths[flight.origin], flight.destination];
              updated = true;
          }
      });

      if (!updated) break;
  }

  return Object.keys(paths).filter(key => paths[key].includes(destination))
      .map(key => ({
          route: paths[key],
          totalCost: costs[key]
      })).sort((a, b) => a.totalCost - b.totalCost);
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
