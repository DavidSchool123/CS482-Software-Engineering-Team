
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

// Join an existing public table
exports.joinTable = async function(req, res) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      message: 'You must be logged in to join a table',
    });
  }

  const { tableId } = req.params;
  const { buyIn } = req.body;

  const session = await mongoose.startSession();

  try {
    let joinedTable;

    await session.withTransaction(async () => {
      const existingTable = await TableDao.findById(
        tableId,
        session
      );

      if (!existingTable) {
        const error = new Error('Table not found');
        error.status = 404;
        throw error;
      }

      if (existingTable.Status !== 'Waiting') {
        const error = new Error('This table is not accepting players');
        error.status = 400;
        throw error;
      }

      if (existingTable.UserIds.some(
        id => id.toString() === userId.toString()
      )) {
        const error = new Error('You are already at this table');
        error.status = 409;
        throw error;
      }

      const levelConfig = TABLE_LEVELS[existingTable.Level];

      if (
        !Number.isInteger(buyIn) ||
        buyIn < levelConfig.minBuyIn ||
        buyIn > levelConfig.maxBuyIn
      ) {
        const error = new Error(
          `Buy-in must be between ${levelConfig.minBuyIn} and ${levelConfig.maxBuyIn} chips`
        );
        error.status = 400;
        throw error;
      }

      const updatedUser = await UserDao.deductChips(
        userId,
        buyIn,
        session
      );

      if (!updatedUser) {
        const error = new Error('Insufficient chips');
        error.status = 400;
        throw error;
      }

      joinedTable = await TableDao.addPlayer(
        tableId,
        userId,
        buyIn,
        session
      );

      if (!joinedTable) {
        const error = new Error(
          'Unable to join. The table may be full or no longer available.'
        );
        error.status = 409;
        throw error;
      }
    });

    return res.status(200).json({
      message: 'Successfully joined table',
      id: joinedTable._id.toString(),
      joinCode: joinedTable.JoinCode,
      name: joinedTable.Name,
    });

  } catch (error) {
    console.error('Error joining table:', error);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : 'Unable to join table',
    });
  } finally {
    await session.endSession();
  }
};


exports.findTableByCode = async function(req, res) {
  try {
    const table = await TableDao.findTableByCode(req);

    if (!table) {
      return res.status(404).json({
        message: 'Table not found',
      });
    }

    const levelConfig = TABLE_LEVELS[table.Level];

    return res.status(200).json({
      id: table._id.toString(),
      name: table.Name,
      level: table.Level,
      capacity: table.Capacity,
      playerCount:
        (table.UserIds?.length ?? 0) + (table.BotCount ?? 0),
      status: table.Status,
      joinCode: table.JoinCode,
      stakes: levelConfig
        ? {
            smallBet: levelConfig.smallBet,
            bigBet: levelConfig.bigBet,
            minBuyIn: levelConfig.minBuyIn,
            maxBuyIn: levelConfig.maxBuyIn,
          }
        : null,
    });
  } catch (error) {
    console.error('Error finding table:', error);

    return res.status(500).json({
      message: 'Unable to find table',
    });
  }
};

