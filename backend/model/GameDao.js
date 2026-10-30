
const mongoose = require('mongoose');

// Schema for cards that have been dealt to players
const cardSchema = new mongoose.Schema({
  rank: {
    type: String,
    required: true
  },

  suit: {
    type: String,
    required: true
  },

  faceUp: {
    type: Boolean,
    required: true
  }
}, { _id: false });

// Schema for cards remaining in the deck
const deckCardSchema = new mongoose.Schema({
  rank: {
    type: String,
    required: true
  },

  suit: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema for each player participating in the game
const gamePlayerSchema = new mongoose.Schema({
  PlayerId: {
    type: String,
    required: true
  },

  Cards: {
    type: [cardSchema],
    default: []
  }
}, { _id: false });

// Main Game schema
const gameSchema = new mongoose.Schema({
  TableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },

  Players: {
    type: [gamePlayerSchema],
    default: []
  },

  Deck: {
    type: [deckCardSchema],
    default: []
  },

  Street: {
    type: Number,
    default: 3
  },

  Status: {
    type: String,
    enum: ['Waiting', 'In Progress', 'Completed'],
    default: 'Waiting'
  }
});

const GameModel = mongoose.model('Game', gameSchema);

// Create a new game

exports.create = async function(gameData, session) {
  const game = new GameModel(gameData);

  await game.save({ session });

  return game;
};


// Find a game by its ID
exports.findById = async function(gameId) {
  return await GameModel.findById(gameId);
};

// Export model for testing and future game operations
exports.GameModel = GameModel;
