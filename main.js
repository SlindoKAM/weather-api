const express = require('express'); // Import express module for creating server
const axios = require('axios'); // Import axios module for making HTTP requests
const dotenv = require('dotenv'); // Import dotenv module for reading .env file
const app = express(); // Create express server

//Load environment variables from .env file
dotenv.config();

//Set up middleware to parse JSON data
app.use(express.json());

//Set API key from environment variable and Base URL for making requests