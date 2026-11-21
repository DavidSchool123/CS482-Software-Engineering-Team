
const { leaveTable } = require('../service/LeaveTableService');
const { runBotTurns } = require('../service/BotService');
const {
  cancelTurnTimer,
  scheduleTurnTimer
} = require('../service/PlayerActivityService');

const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const UserDao = require('../model/UserDao');
const { joinTable } = require('../service/JoinTableService');
const crypto = require('crypto');

// Format table information for the poker-table screen.
// Public spectators do not need the table's private join code.
function formatTableForViewing(table, userId, includeJoinCode = false) {
  const isPlayer = Boolean(
    userId &&
    table.UserIds?.some(
      (id) => id.toString() === userId.toString()
    )
  );

  return {
    id: table._id.toString(),
    filledSeats:
      (table.UserIds?.length ?? 0) + (table.BotCount ?? 0),
    capacity: table.Capacity,
    humanCount: table.UserIds?.length ?? 0,
    botCount: table.BotCount ?? 0,
    level: table.Level,
    name: table.Name,
    status: table.Status,
    playerCount:
      (table.UserIds?.length ?? 0) + (table.BotCount ?? 0),
    stakes: TABLE_LEVELS[table.Level],
    currentGameId: table.CurrentGameID
      ? table.CurrentGameID.toString()
      : null,
    isPlayer,
    isPublic: table.IsPublic,
    ...(includeJoinCode ? { joinCode: table.JoinCode } : {}),
  };
}

// Get public tables and their betting information for the Lobby.
exports.getAllTables = async function(req, res) {
  try {
    const tables = await TableDao.findPublicTables();

    const formattedTables = tables.map((table) => {
      const levelConfig = TABLE_LEVELS[table.Level];

      return {
        id: table._id,
        name: table.Name,
        level: table.Level,
        capacity: table.Capacity,
        humanCount: table.UserIds?.length ?? 0,
        botCount: table.BotCount ?? 0,
        playerCount:
          (table.UserIds?.length ?? 0) + (table.BotCount ?? 0),
        status: table.Status,
        stakes: levelConfig
          ? {
              smallBet: levelConfig.smallBet,
              bigBet: levelConfig.bigBet,
              minBuyIn: levelConfig.minBuyIn,
              maxBuyIn: levelConfig.maxBuyIn,
            }
          : null,
      };
    });

    return res.status(200).json(formattedTables);
  } catch (error) {
    console.error('Error retrieving public tables:', error);

    return res.status(500).json({
      message: 'Unable to retrieve tables',
    });
  }
};

// Create a new table.
exports.createTable = async function(req, res) {
  const hostId = req.session?.userId;

  if (!hostId) {
    return res.status(401).json({
      message: 'You must be logged in to create a table',
    });
  }

  const levelConfig = TABLE_LEVELS[req.body.Level];

  if (!levelConfig) {
    return res.status(400).json({
      message: 'Invalid table level',
    });
  }

  const { Capacity: capacity, BotCount: botCount } = req.body;

  if (
    !Number.isInteger(capacity) ||
    capacity < 2 ||
    capacity > 6
  ) {
    return res.status(400).json({
      message: 'Table capacity must be between 2 and 6 players',
    });
  }

  if (
    !Number.isInteger(botCount) ||
    botCount < 0 ||
    botCount > capacity - 1
  ) {
    return res.status(400).json({
      message: 'Bot count must fit in the table after the host is seated',
    });
  }

  const buyIn = req.body.buyIn;

  if (
    !Number.isInteger(buyIn) ||
    buyIn < levelConfig.minBuyIn ||
    buyIn > levelConfig.maxBuyIn
  ) {
    return res.status(400).json({
      message:
        `Buy-in must be between ${levelConfig.minBuyIn} ` +
        `and ${levelConfig.maxBuyIn} chips`,
    });
  }

  const session = await mongoose.startSession();

  try {
    let table;

    await session.withTransaction(async () => {
      const updatedUser = await UserDao.deductChips(
        hostId,
        buyIn,
        session
      );

      if (!updatedUser) {
        const error = new Error(
          'Insufficient chips or user not found'
        );
        error.status = 400;
        throw error;
      }

      const generatedJoinCode = crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase();

      const tableData = {
        Name: req.body.Name,
        JoinCode: generatedJoinCode,
        Capacity: capacity,
        UserIds: [hostId],
        PlayerStacks: [
          {
            PlayerId: hostId.toString(),
            Chips: buyIn,
          },
        ],
        BotCount: botCount,
        IsPublic: req.body.IsPublic,
        Level: req.body.Level,
      };

      table = await TableDao.create(tableData, session);
    });

    return res.status(201).json({
      id: table._id.toString(),
      name: table.Name,
      joinCode: table.JoinCode,
      buyIn,
    });
  } catch (error) {
    console.error('Error creating table:', error);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : 'Unable to create table',
    });
  } finally {
    await session.endSession();
  }
};

// Join a table.
// The service handles validation, chip deduction,
// and adding the player in one transaction.
exports.joinTable = async function(req, res) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      message: 'You must be logged in to join a table',
    });
  }

  const { tableId } = req.params;

  if (!mongoose.isValidObjectId(tableId)) {
    return res.status(400).json({
      message: 'Invalid table ID',
    });
  }

  try {
    const result = await joinTable(
      tableId,
      userId,
      req.body?.buyIn
    );

    return res.status(200).json(result);
  } catch (error) {
    const knownErrors = {
      'Table not found': 404,
      'Invalid buy-in amount': 400,
      'Invalid table level': 400,
      'Insufficient account chips': 400,
      'Cannot join a game already in progress': 409,
      'Unable to join table. It may be full or already started.': 409,
      'Table is closed': 409,
      'Table is not available': 409,
      'Table is full': 409,
      'Please wait until the current hand finishes': 409,
      'Unable to join table. Please try again between hands.': 409,
      'Unable to join table': 409,
    };

    const status =
      error.status ||
      (error.message.startsWith('Buy-in must be between')
        ? 400
        : knownErrors[error.message] || 500);

    if (status === 500) {
      console.error('Error joining table:', error);
    }

    return res.status(status).json({
      message:
        status === 500
          ? 'Unable to join table'
          : error.message,
    });
  }
};

// Find a table using its join code.
exports.findTableByCode = async function(req, res) {
  try {
    const table = await TableDao.findTableByCode(req);

    if (!table) {
      return res.status(404).json({
        message: 'Table not found',
      });
    }

    return res.status(200).json(
      formatTableForViewing(
        table,
        req.session?.userId,
        true
      )
    );
  } catch (error) {
    console.error('Error finding table:', error);

    return res.status(500).json({
      message: 'Unable to find table',
    });
  }
};

// Leave a table. If the player is in a game,
// the game may continue with bots.
exports.leaveTable = async function(req, res) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      message: 'You must be logged in to leave a table'
    });
  }

  const { tableId } = req.params;

  if (!mongoose.isValidObjectId(tableId)) {
    return res.status(400).json({
      message: 'Invalid table ID'
    });
  }

  try {
    const result = await leaveTable(tableId, userId);

    if (result.gameId) {
      cancelTurnTimer(result.gameId);

      if (
        !result.tableClosed &&
        result.gameStatus === 'In Progress'
      ) {
        try {
          const { game } = await runBotTurns(result.gameId);

          if (game.Status === 'In Progress') {
            scheduleTurnTimer(game);
          }
        } catch (error) {
          console.error(
            'Unable to resume game after departure:',
            error
          );
        }
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error leaving table:', error);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : 'Unable to leave table'
    });
  }
};

// Retrieve a table by ID for spectator access.
// Non-players may only observe public tables.
exports.getTableForSpectating = async function(req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        message: 'You must be logged in to observe a table',
      });
    }

    const { tableId } = req.params;

    if (!mongoose.isValidObjectId(tableId)) {
      return res.status(400).json({
        message: 'Invalid table ID',
      });
    }

    const table = await TableDao.findById(tableId);

    if (!table) {
      return res.status(404).json({
        message: 'Table not found',
      });
    }

    const isPlayer = table.UserIds.some(
      (id) => id.toString() === userId.toString()
    );

    if (!table.IsPublic && !isPlayer) {
      return res.status(403).json({
        message: 'You cannot observe this private table',
      });
    }

    return res.status(200).json(
      formatTableForViewing(table, userId)
    );
  } catch (error) {
    console.error(
      'Error retrieving table for spectating:',
      error
    );

    return res.status(500).json({
      message: 'Unable to retrieve table',
    });
  }
};

// Update player presence for the reconnect grace period.
exports.heartbeat = async function(req, res) {
  const userId = req.session?.userId;
  const { tableId } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: 'You must be logged in.'
    });
  }

  if (!mongoose.isValidObjectId(tableId)) {
    return res.status(400).json({
      message: 'Invalid table ID.'
    });
  }

  try {
    const table = await TableDao.updatePlayerPresence(
      tableId,
      userId
    );

    if (!table) {
      return res.status(403).json({
        message: 'You are not seated at this table.'
      });
    }

    return res.status(200).json({
      message: 'Heartbeat received.'
    });
  } catch (error) {
    console.error('Heartbeat failed:', error);

    return res.status(500).json({
      message: 'Unable to update player presence.'
    });
  }
};
