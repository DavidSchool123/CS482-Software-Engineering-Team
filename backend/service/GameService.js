
const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const TABLE_LEVELS = require('../model/tableLevels');

const { createDeck, shuffleDeck } = require('./DeckService');
const { dealInitialCards } = require('./DealingService');
const { determineBringInPlayer } = require('./BringInService');

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

      // 2. Get stakes for the table level
      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      const { ante, bringIn, smallBet, minBuyIn } = stakes;

      // 3. Collect human players
      const players = table.UserIds.map(userId => ({
        id: userId.toString()
      }));

      // 4. Include bots
      for (let i = 0; i < table.BotCount; i++) {
        players.push({
          id: `bot-${table._id}-${i + 1}`
        });
      }

      // Randomize player seating order at the start of each game
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }

      if (players.length < 2 || players.length > 6) {
        throw new Error('A game must have between 2 and 6 players');
      }

      // 5. Initialize bot stacks if they don't exist
      const existingStacks = new Set(
        table.PlayerStacks.map(stack => stack.PlayerId)
      );

      for (const player of players) {
        if (
          player.id.startsWith('bot-') &&
          !existingStacks.has(player.id)
        ) {
          table.PlayerStacks.push({
            PlayerId: player.id,
            Chips: minBuyIn
          });
        }
      }

      // Save bot stacks within the transaction
      await table.save({ session });

      // 6. Check that everyone can afford the ante
      // and potentially the bring-in
      for (const player of players) {
        const stack = table.PlayerStacks.find(
          stack => stack.PlayerId === player.id
        );

        if (!stack || stack.Chips < ante + bringIn) {
          throw new Error(
            `Player ${player.id} does not have enough chips to start`
          );
        }
      }

      // 7. Reserve the table atomically
      const reservedTable = await TableDao.reserveForGame(
        tableId,
        session
      );

      if (!reservedTable) {
        throw new Error('Table is not waiting for a game');
      }

      // 8. Collect antes
      let pot = 0;
      const contributions = new Map();

      for (const player of players) {
        const updatedTable = await TableDao.deductPlayerChips(
          tableId,
          player.id,
          ante,
          session
        );

        if (!updatedTable) {
          throw new Error(
            `Failed to collect ante from ${player.id}`
          );
        }

        pot += ante;

        contributions.set(player.id, {
          total: ante,
          round: 0
        });
      }

      // 9. Create and shuffle deck
      const deck = shuffleDeck(createDeck());

      // 10. Deal initial cards
      const hands = dealInitialCards(deck, players);

      // 11. Determine bring-in player
      const bringInPlayerId = determineBringInPlayer(hands);

      // 12. Collect bring-in
      const updatedTable = await TableDao.deductPlayerChips(
        tableId,
        bringInPlayerId,
        bringIn,
        session
      );

      if (!updatedTable) {
        throw new Error('Failed to collect bring-in');
      }

      pot += bringIn;

      const bringInContribution = contributions.get(
        bringInPlayerId
      );

      bringInContribution.total += bringIn;
      bringInContribution.round += bringIn;

      // 13. Initialize betting state
      // The bring-in establishes the amount to match.
      const currentBet = bringIn;

      // Find the bring-in player's position in seating order.
      const bringInIndex = hands.findIndex(
        hand => hand.playerId === bringInPlayerId
      );

      // The next player clockwise acts first.
      const currentTurnPlayerId =
        hands[(bringInIndex + 1) % hands.length].playerId;

      // Third Street uses the small betting limit.
      const lastRaiseAmount = smallBet;

      // 14. Save game
      game = await GameDao.create({
        TableId: table._id,

        Players: hands.map(hand => ({
          PlayerId: hand.playerId,
          Cards: hand.cards,

          TotalContribution:
            contributions.get(hand.playerId).total,

          RoundContribution:
            contributions.get(hand.playerId).round,

          HasFolded: false,
          HasActed: false
        })),

        Deck: deck,
        Street: 3,
        Status: 'In Progress',

        Pot: pot,
        Ante: ante,
        BringIn: bringIn,
        BringInPlayerId: bringInPlayerId,

        CurrentBet: currentBet,
        CurrentTurnPlayerId: currentTurnPlayerId,
        LastRaiseAmount: lastRaiseAmount,
        RaiseCount: 0,
        BettingRoundComplete: false,

        // P40: No new street is waiting for betting initialization.
        AwaitingNextRound: false
      }, session);

      // 15. Associate game with table
      const linkedTable = await TableDao.setCurrentGame(
        tableId,
        game._id,
        session
      );

      if (!linkedTable) {
        throw new Error('Failed to link game to table');
      }
    });

    return game;

  } finally {
    await session.endSession();
  }
}

module.exports = { startGame };
