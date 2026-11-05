
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

  TotalContribution: {
    type: Number,
    default: 0,
    min: 0
  },

  RoundContribution: {
    type: Number,
    default: 0,
    min: 0
  },

  HasFolded: {
    type: Boolean,
    default: false
  },

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
    enum: ['Waiting', 'In Progress', 'Showdown', 'Completed'],
    default: 'Waiting'
  },

  Pot: {
    type: Number,
    default: 0,
    min: 0
  },

  Ante: {
    type: Number,
    default: 0,
    min: 0
  },

  BringIn: {
    type: Number,
    default: 0,
    min: 0
  },

  BringInPlayerId: {
    type: String,
    default: null
  },

  CurrentBet: {
    type: Number,
    default: 0,
    min: 0
  },

  CurrentTurnPlayerId: {
    type: String,
    default: null
  },

  LastRaiseAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  RaiseCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Whether the current betting round has finished
  BettingRoundComplete: {
    type: Boolean,
    default: false
  },

  // P40: Cards for the next street have been dealt,
  // but P49 has not initialized the new betting round.
  AwaitingNextRound: {
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
exports.findById = async function(gameId, session = null) {
  return await GameModel.findById(gameId).session(session);
};

/**
 * P40 - Atomically save the next street and its cards.
 */
exports.advanceStreet = async function(
  gameId,
  expectedStreet,
  updatedPlayers,
  remainingDeck,
  session = null
) {
  return await GameModel.findOneAndUpdate(
    {
      _id: gameId,
      Street: expectedStreet,
      Status: 'In Progress',
      BettingRoundComplete: true,

      // Prevent dealing again while waiting for P49
      AwaitingNextRound: false
    },
    {
      $set: {
        Players: updatedPlayers,
        Deck: remainingDeck,
        Street: expectedStreet + 1,

        // P49 will initialize the next betting round
        BettingRoundComplete: true,
        AwaitingNextRound: true,
        CurrentTurnPlayerId: null
      }
    },
    {
      new: true,
      runValidators: true,
      session
    }
  );
};

// Export model for testing and future game operations
exports.GameModel = GameModel;
