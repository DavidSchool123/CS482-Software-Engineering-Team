
const mongoose = require('mongoose');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const UserDao = require('../model/UserDao');
const crypto = require('crypto');

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
        Capacity: req.body.Capacity,
        UserIds: [hostId],
        PlayerStacks: [
          {
            PlayerId: hostId.toString(),
            Chips: buyIn,
          },
        ],
        BotCount: req.body.BotCount,
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

// Find a table using its join code
exports.findTableByCode = async function(req, res) {
  try {
    const table = await TableDao.findTableByCode(req);

    if (!table) {
      return res.status(404).json({
        message: 'Table not found',
      });
    }

    return res.status(200).json({
      id: table._id.toString(),
      filledSeats: table.UserIds.length + table.BotCount,
      capacity: table.Capacity,
      botCount: table.BotCount,
      level: table.Level,
      name: table.Name,
      joinCode: table.JoinCode,
      status: table.Status,
      currentGameId: table.CurrentGameID,
    });
  } catch (error) {
    console.error('Error finding table:', error);

    return res.status(500).json({
      message: 'Unable to find table',
    });
  }
};
