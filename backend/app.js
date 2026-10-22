const express = require('express');
const cors = require('cors');
const TableController = require('./controller/TableController');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'Poker Face API is running!',
  });
});

// Lobby endpoint
app.get('/api/tables', TableController.getAllTables);

module.exports = app;