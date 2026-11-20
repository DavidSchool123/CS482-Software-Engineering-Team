
const mongoose = require('mongoose');

const UserDao = require('../model/UserDao');
const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
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

      // Reconnecting players keep their existing seat and chips.
      const isAlreadySeated = table.UserIds.some(
        id => id.toString() === userId.toString()
      );

      if (isAlreadySeated && table.Status !== 'Closed') {
        result = {
          joinCode: table.JoinCode,
          alreadySeated: true
        };
        return;
      }

      if (table.Status === 'Closed') {
        throw new Error('Table is closed');
      }

      if (table.Status === 'In Progress') {
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
          throw new Error(
            'Please wait until the current hand finishes'
          );
        }
      } else if (table.Status !== 'Waiting') {
        throw new Error('Table is not available');
      }

      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      if (
        !Number.isInteger(buyIn) ||
        buyIn < stakes.minBuyIn ||
        buyIn > stakes.maxBuyIn
      ) {
        throw new Error(
          `Buy-in must be between ${stakes.minBuyIn} and ${stakes.maxBuyIn} chips`
        );
      }

      // Check whether any human seat is available.
      // Bots may be replaced when the table is full.
      if (table.UserIds.length >= table.Capacity) {
        throw new Error('Table is full');
      }

      const updatedUser = await UserDao.deductChips(
        userId,
        buyIn,
        session
      );

      if (!updatedUser) {
        throw new Error('Insufficient account chips');
      }

      const updatedTable = await TableDao.addPlayer(
        tableId,
        userId,
        buyIn,
        session
      );

      if (!updatedTable) {
        throw new Error(
          'Unable to join table. Please try again between hands.'
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
