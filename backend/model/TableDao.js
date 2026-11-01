
const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({

  Name: {
    type: String,
    required: true,
    trim: true,
  },

  JoinCode: {
    type: String,
    required: true,
    unique: true,
  },

  Capacity: {
    type: Number,
    required: true,
  },

  UserIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  // Tracks each player's remaining chips at the table.
  // Supports both registered/guest players and bots.
  PlayerStacks: {
    type: [
      {
        _id: false,

        PlayerId: {
          type: String,
          required: true,
        },

        Chips: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    default: [],
  },

  BotCount: {
    type: Number,
    required: true,
  },

  IsPublic: {
    type: Boolean,
    required: true,
  },

  Level: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true,
  },

  Status: {
    type: String,
    enum: ['Waiting', 'In Progress', 'Closed'],
    default: 'Waiting',
  },

  CurrentGameID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
  },

});

const TableModel = mongoose.model('Table', tableSchema);

// Retrieve all tables
exports.findAll = async function() {
  return await TableModel.find()
    .select('Name Capacity UserIds BotCount IsPublic Level Status');
};

// Retrieve public tables for the Lobby
exports.findPublicTables = async function() {
  return await TableModel.find({
    IsPublic: true,
    Status: { $ne: 'Closed' },
  }).select(
    'Name Capacity UserIds BotCount Level Status'
  );
};

// Find a table using its join code
exports.findTableByCode = async function(req) {
  const code = req.params.joinCode;

  return await TableModel.findOne({
    JoinCode: code,
  }).select(
    'Name Capacity UserIds BotCount Level Status JoinCode CurrentGameID PlayerStacks'
  );
};

// Delete a table using its join code
exports.deleteTableByCode = async function(req) {
  const code = req.params.joinCode;

  return await TableModel.findOneAndDelete({
    JoinCode: code,
  });
};

/**
 * Find a table by its MongoDB ID.
 * Used when starting a new poker game.
 */
exports.findById = async function(tableId, session = null) {
  return await TableModel.findById(tableId).session(session);
};

/**
 * Associate a game with its table.
 */
exports.setCurrentGame = async function(tableId, gameId, session) {
  return await TableModel.findByIdAndUpdate(
    tableId,
    {
      $set: {
        CurrentGameID: gameId,
      },
    },
    {
      new: true,
      session,
    }
  );
};

/**
 * Reserve a waiting table before starting a game.
 * Only one request can change Waiting to In Progress.
 */
exports.reserveForGame = async function(tableId, session) {
  return await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      Status: 'Waiting',
    },
    {
      $set: {
        Status: 'In Progress',
      },
    },
    {
      new: true,
      session,
    }
  );
};

/**
 * Create a table.
 * Supports MongoDB transactions.
 */
exports.create = async function(tableData, session = null) {
  const newTable = new TableModel(tableData);

  await newTable.save({ session });

  return newTable;
};

/**
 * Deduct chips from a player's table stack.
 * Used for antes, bring-ins, and future betting.
 *
 * Returns null if the player is missing
 * or does not have enough chips.
 */
exports.deductPlayerChips = async function(
  tableId,
  playerId,
  amount,
  session
) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Invalid chip amount');
  }

  return await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      PlayerStacks: {
        $elemMatch: {
          PlayerId: playerId,
          Chips: { $gte: amount },
        },
      },
    },
    {
      $inc: {
        'PlayerStacks.$.Chips': -amount,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );
};

module.exports.TableModel = TableModel;
