
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

  // Tracks when each seated human player was last active.
  // Used for the 60-second reconnect grace period.
  PlayerPresence: {
    type: [
      {
        _id: false,

        PlayerId: { 
          type: String,
          required: true, 
        },

        LastSeenAt: {
          type: Date,
          required: true,
        },
      },
    ],
    default: [],
  },

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

  SpectatorIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: [],
    },
  ],

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
 * P53 - Atomically link the next hand to an existing table.
 *
 * Only replaces the expected completed game.
 * Prevents two requests from advancing the same table
 * to different games.
 */
exports.setNextGame = async function(
  tableId,
  previousGameId,
  nextGameId,
  session = null
) {
  return await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      Status: 'In Progress',
      CurrentGameID: previousGameId
    },
    {
      $set: {
        CurrentGameID: nextGameId
      }
    },
    {
      new: true,
      session,
      runValidators: true
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
 * Add a player to a waiting table.
 * Prevents duplicate joins and joining a full table.
 */

exports.addPlayer = async function(
  tableId,
  userId,
  buyIn,
  session
) {
  const table = await TableModel.findById(tableId).session(session);

  if (!table || table.Status === 'Closed') {
    return null;
  }

  const isAlreadySeated = table.UserIds.some(
    id => id.toString() === userId.toString()
  );

  if (isAlreadySeated) {
    return null;
  }

  // Only allow joining a waiting table or between hands.
  if (table.Status === 'In Progress') {
    const GameDao = require('./GameDao');

    const game = await GameDao.findById(
      table.CurrentGameID,
      session
    );

    if (
      !game ||
      game.Status !== 'Completed' ||
      !game.NextHandAt ||
      new Date(game.NextHandAt).getTime() <= Date.now()
    ) {
      return null;
    }
  } else if (table.Status !== 'Waiting') {
    return null;
  }

  const humanCount = table.UserIds.length;
  const totalSeats = humanCount + table.BotCount;

  if (humanCount >= table.Capacity) {
    return null;
  }

  // If a seat is empty, use it first.
  // Otherwise, replace the highest-numbered bot.
  if (totalSeats >= table.Capacity) {
    if (table.BotCount === 0) {
      return null;
    }

    const removedBotId =
      `bot-${table._id}-${table.BotCount}`;

    table.PlayerStacks = table.PlayerStacks.filter(
      stack => stack.PlayerId !== removedBotId
    );

    table.BotCount -= 1;
  }

  table.UserIds.push(userId);

  table.PlayerStacks.push({
    PlayerId: userId.toString(),
    Chips: buyIn
  });

  table.PlayerPresence.push({
    PlayerId: userId.toString(),
    LastSeenAt: new Date()
  });

  await table.save({ session });

  return table;
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

/**
 * Update a seated player's last-seen timestamp.
 * Returns null if the player is no longer seated.
 */
exports.updatePlayerPresence = async function(tableId, userId) {
  const playerId = String(userId);
  const now = new Date();

  const updated = await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      UserIds: userId,
      'PlayerPresence.PlayerId': playerId,
      Status: { $ne: 'Closed' }
    },
    {
      $set: {
        'PlayerPresence.$.LastSeenAt': now
      }
    },
    { new: true }
  );

  if (updated) return updated;

  // Initialize presence for existing tables created
  // before this field was introduced.
  return await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      UserIds: userId,
      Status: { $ne: 'Closed' },
      'PlayerPresence.PlayerId': { $ne: playerId }
    },
    {
      $push: {
        PlayerPresence: {
          PlayerId: playerId,
          LastSeenAt: now
        }
      }
    },
    { new: true }
  );
};


/**
 * Find active tables containing at least one
 * expired player presence timestamp.
 */
exports.findTablesWithInactivePlayers = async function(cutoff) {
  return await TableModel.find({
    Status: { $ne: 'Closed' },
    PlayerPresence: {
      $elemMatch: {
        LastSeenAt: { $lte: cutoff }
      }
    }
  });
};


module.exports.TableModel = TableModel;
