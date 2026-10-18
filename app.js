
const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Poker Face API is running!"
  });
});

module.exports = app;
