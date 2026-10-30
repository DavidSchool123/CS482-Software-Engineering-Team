
const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');

const { createDeck, shuffleDeck } = require('./DeckService');
const { dealInitialCards } = require('./DealingService');

async function startGame(tableId) {
  const session = await mongoose.startSession();

  try {
    let game;

    await session.withTransaction(async () => {
      // 1. Find the table
      const table = await TableDao.findById(tableId, session);

      if (!table) {
        throw new Error('Table not found');
      }

      if (table.Status !== 'Waiting') {
        throw new Error('Table is not waiting for a game');
      }

      // 2. Collect players
      const players = table.UserIds.map(userId => ({
        id: userId.toString()
      }));

      // Include bots
      for (let i = 0; i < table.BotCount; i++) {
        players.push({
          id: `bot-${table._id}-${i + 1}`
        });
      }

      if (players.length < 2 || players.length > 6) {
        throw new Error('A game must have between 2 and 6 players');
      }

      // 3. Reserve the table atomically
      const reservedTable = await TableDao.reserveForGame(
        tableId,
        session
      );

      if (!reservedTable) {
        throw new Error('Table is not waiting for a game');
      }

      // 4. Create and shuffle the deck
      const deck = shuffleDeck(createDeck());

      // 5. Deal initial cards
      const hands = dealInitialCards(deck, players);

      // 6. Save the game
      game = await GameDao.create({
        TableId: table._id,
        Players: hands.map(hand => ({
          PlayerId: hand.playerId,
          Cards: hand.cards
        })),
        Deck: deck,
        Street: 3,
        Status: 'In Progress'
      }, session);

      // 7. Associate the game with the table
      const updatedTable = await TableDao.setCurrentGame(
        tableId,
        game._id,
        session
      );

      if (!updatedTable) {
        throw new Error('Failed to link game to table');
      }
    });

    return game;

  } finally {
    await session.endSession();
  }
}

module.exports = { startGame };
