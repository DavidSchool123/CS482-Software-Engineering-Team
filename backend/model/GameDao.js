
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
  },

  // Chips contributed to the pot through antes and bets
  TotalContribution: {
    type: Number,
    default: 0,
    min: 0
  },

  // Amount contributed during the current betting round
  RoundContribution: {
    type: Number,
    default: 0,
    min: 0
  },

  // Whether the player has folded this hand
  HasFolded: {
    type: Boolean,
    default: false
  },

  // Whether the player has acted since the last bet or raise
  HasActed: {
    type: Boolean,
    default: false
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
  },

  // Total chips currently in the pot
  Pot: {
    type: Number,
    default: 0,
    min: 0
  },

  // Ante amount required from each player
  Ante: {
    type: Number,
    default: 0,
    min: 0
  },

  // Required bring-in amount
  BringIn: {
    type: Number,
    default: 0,
    min: 0
  },

  // Player responsible for posting the bring-in
  BringInPlayerId: {
    type: String,
    default: null
  },

  // Highest amount a player must match in the current round
  CurrentBet: {
    type: Number,
    default: 0,
    min: 0
  },

  // Player whose turn it is to act
  CurrentTurnPlayerId: {
    type: String,
    default: null
  },

  // Size of the last full bet or raise
  LastRaiseAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Number of full raises during the current betting round
  RaiseCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Whether the current betting round has finished
  BettingRoundFinished: {
    type: Boolean,
    default: false
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
exports.findById = async function(gameId, session=null) {
  return await GameModel.findById(gameId).session(session);
};

// Export model for testing and future game operations
exports.GameModel = GameModel;
