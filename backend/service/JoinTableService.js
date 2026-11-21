
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

      if (table.Status === 'Closed') {
        throw new Error('Table is closed');
      }

      const playerId = String(userId);

      // Reconnecting does not require another buy-in.
      const alreadySeated = table.UserIds.some(
        id => String(id) === playerId
      );

      if (alreadySeated) {
        result = {
          joinCode: table.JoinCode,
          alreadySeated: true
        };
        return;
      }

      if (
        table.Status !== 'Waiting' &&
        table.Status !== 'In Progress'
      ) {
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
          `Buy-in must be between ${stakes.minBuyIn} ` +
          `and ${stakes.maxBuyIn} chips`
        );
      }

      // Human capacity is independent of bot occupancy.
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
        throw new Error('Unable to join table');
      }

      result = {
        joinCode: updatedTable.JoinCode,
        alreadySeated: false,
        waitingForNextHand:
          updatedTable.Status === 'In Progress'
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { joinTable };
