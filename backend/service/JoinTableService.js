
const mongoose = require('mongoose');

const UserDao = require('../model/UserDao');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');

async function joinTable(tableId, userId, buyIn) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const table = await TableDao.findById(tableId, session);

      if (!table) {
        throw new Error('Table not found');
      }

      // If already seated, do not deduct chips again.
      const isAlreadySeated = table.UserIds.some(
        id => id.toString() === userId.toString()
      );

      if (isAlreadySeated) {
        result = {
          joinCode: table.JoinCode,
          alreadySeated: true
        };
        return;
      }

      // Players can only join waiting tables.
      if (table.Status !== 'Waiting') {
        throw new Error('Cannot join a game already in progress');
      }

      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      // Validate the requested buy-in.
      if (
        !Number.isInteger(buyIn) ||
        buyIn < stakes.minBuyIn ||
        buyIn > stakes.maxBuyIn
      ) {
        throw new Error(
          `Buy-in must be between ${stakes.minBuyIn} and ${stakes.maxBuyIn} chips`
        );
      }

      // Deduct chips from the user's account.
      const updatedUser = await UserDao.deductChips(
        userId,
        buyIn,
        session
      );

      if (!updatedUser) {
        throw new Error('Insufficient account chips');
      }

      // Add player and create their table chip stack.
      const updatedTable = await TableDao.addPlayer(
        tableId,
        userId,
        buyIn,
        session
      );

      if (!updatedTable) {
        throw new Error(
          'Unable to join table. It may be full or already started.'
        );
      }

      result = {
        joinCode: updatedTable.JoinCode,
        alreadySeated: false
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { joinTable };
