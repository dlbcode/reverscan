const express = require('express');
const Amadeus = require('amadeus');
const MongoClient = require('mongodb').MongoClient;
const app = express();
const port = 3000;
const cors = require('cors');
const mongodbPassword = process.env.MONGO_RSUSER_PASSWORD;

// Amadeus client setup
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_TEST_API_KEY,
  clientSecret: process.env.AMADEUS_TEST_API_SECRET
});

// use it before all route definitions
app.use(cors({
  origin: ['http://yonderhop.com:8002', 'http://localhost:8002']
}));

const mongoUrl = `mongodb://rsuser:${mongodbPassword}@mongodb:27017/rsdb`;
const dbName = 'rsdb';

let db;
let airportsCollection;
let routesCollection;

// Connect to MongoDB
MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  db = client.db(dbName);
  airportsCollection = db.collection('airports');
  routesCollection = db.collection('directRoutes');
  flightsCollection = db.collection('flights');
  console.log('Connected to MongoDB');

// Import endpoint modules within the MongoDB connection callback
  const atcd = require('./api/atcd');
  atcd(app, amadeus, flightsCollection);

  const atdRoutes = require('./api/atdRoutes');
  atdRoutes(app, amadeus, routesCollection);

  const airports = require('./api/airports');
  airports(app, airportsCollection);

  const directRoutes = require('./api/directRoutes');
  directRoutes(app, airportsCollection, routesCollection);

  const flights = require('./api/flights');
  flights(app, flightsCollection);

  const cheapestRoutes = require('./api/cheapestRoutes');
  cheapestRoutes(app, routesCollection);
}); 

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
