
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const UserDao = require('../model/UserDao');
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
    botCount: table.BotCount,
    level: table.Level,
    name: table.Name,
    status: table.Status,
    currentGameId: table.CurrentGameID
      ? table.CurrentGameID.toString()
      : null,

    // The frontend uses this to distinguish players from spectators.
    isPlayer,
    isPublic: table.IsPublic,

    // Only include the code when using the existing join-code lookup.
    ...(includeJoinCode ? { joinCode: table.JoinCode } : {}),
  };
}

// Get public tables and their betting information for the Lobby
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

// Create a new table
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

  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 6) {
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
      message: `Buy-in must be between ${levelConfig.minBuyIn} and ${levelConfig.maxBuyIn} chips`,
    });
  }

  const session = await mongoose.startSession();

  try {
    let table;

    await session.withTransaction(async () => {
      // Deduct the host's buy-in from their account.
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

      // Generate a join code.
      const generatedJoinCode = crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase();

      // Create the table with the host's chip stack.
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

// Join a waiting table and transfer the requested buy-in into the player's stack.
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

  const buyIn = req.body?.buyIn;
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const table = await TableDao.findById(tableId, session);

      if (!table) {
        const error = new Error('Table not found');
        error.status = 404;
        throw error;
      }

      const isAlreadySeated = table.UserIds.some(
        (id) => id.toString() === userId.toString()
      );

      if (isAlreadySeated) {
        result = {
          joinCode: table.JoinCode,
          alreadySeated: true,
        };
        return;
      }

      if (table.Status !== 'Waiting') {
        const error = new Error('This table is no longer waiting for players');
        error.status = 409;
        throw error;
      }

      if (table.UserIds.length + table.BotCount >= table.Capacity) {
        const error = new Error('This table is full');
        error.status = 409;
        throw error;
      }

      const levelConfig = TABLE_LEVELS[table.Level];

      if (
        !levelConfig ||
        !Number.isInteger(buyIn) ||
        buyIn < levelConfig.minBuyIn ||
        buyIn > levelConfig.maxBuyIn
      ) {
        const error = new Error('Invalid buy-in amount');
        error.status = 400;
        throw error;
      }

      const updatedUser = await UserDao.deductChips(
        userId,
        buyIn,
        session
      );

      if (!updatedUser) {
        const error = new Error('Insufficient chips or user not found');
        error.status = 400;
        throw error;
      }

      table.UserIds.push(userId);
      table.PlayerStacks.push({
        PlayerId: userId.toString(),
        Chips: buyIn,
      });
      await table.save({ session });

      result = {
        joinCode: table.JoinCode,
        alreadySeated: false,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    console.error('Error joining table:', error);
    return res.status(500).json({
      message: 'Unable to join table',
    });
  } finally {
    await session.endSession();
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

    // Do not allow spectators to access private tables by guessing IDs.
    if (!table.IsPublic && !isPlayer) {
      return res.status(403).json({
        message: 'You cannot observe this private table',
      });
    }

    return res.status(200).json(
      formatTableForViewing(table, userId)
    );
  } catch (error) {
    console.error('Error retrieving table for spectating:', error);

    return res.status(500).json({
      message: 'Unable to retrieve table',
    });
  }
};
