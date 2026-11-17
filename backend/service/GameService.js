
const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const TABLE_LEVELS = require('../model/tableLevels');

const { createDeck, shuffleDeck } = require('./DeckService');
const { dealInitialCards } = require('./DealingService');
const { determineBringInPlayer } = require('./BringInService');

// Collect human players and bots from the existing table.
function getTablePlayers(table) {
  const players = table.UserIds.map(userId => ({
    id: userId.toString()
  }));

  for (let i = 0; i < table.BotCount; i++) {
    players.push({
      id: `bot-${table._id}-${i + 1}`
    });
  }

  return players;
}

// Randomize seating order for each hand.
function shufflePlayers(players) {
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [players[i], players[j]] = [players[j], players[i]];
  }

  return players;
}

// Shared logic for creating a hand.
// Called inside an existing MongoDB transaction.
async function createHand(table, players, stakes, session) {
  const { ante, bringIn, smallBet } = stakes;

  if (players.length < 2 || players.length > 6) {
    throw new Error('A game must have between 2 and 6 players');
  }

  shufflePlayers(players);

  // Collect antes.
  let pot = 0;
  const contributions = new Map();

  for (const player of players) {
    const updatedTable = await TableDao.deductPlayerChips(
      table._id,
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

  // Create a fresh deck and deal initial cards.
  const deck = shuffleDeck(createDeck());
  const hands = dealInitialCards(deck, players);

  // Determine and collect the bring-in.
  const bringInPlayerId = determineBringInPlayer(hands);

  const updatedTable = await TableDao.deductPlayerChips(
    table._id,
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

  // The player after the bring-in acts first.
  const bringInIndex = hands.findIndex(
    hand => hand.playerId === bringInPlayerId
  );

  const currentTurnPlayerId =
    hands[(bringInIndex + 1) % hands.length].playerId;

  // Save the new game.
  return await GameDao.create({
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

    CurrentBet: bringIn,
    CurrentTurnPlayerId: currentTurnPlayerId,
    LastRaiseAmount: smallBet,
    RaiseCount: 0,
    BettingRoundComplete: false,
    AwaitingNextRound: false
  }, session);
}

// P15/P42: Start the first hand at a waiting table.
async function startGame(tableId) {
  const session = await mongoose.startSession();

  try {
    let game;

    await session.withTransaction(async () => {
      const table = await TableDao.findById(tableId, session);

      if (!table) {
        throw new Error('Table not found');
      }

      if (table.Status !== 'Waiting') {
        throw new Error('Table is not waiting for a game');
      }

      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      const players = getTablePlayers(table);

      if (players.length < 2 || players.length > 6) {
        throw new Error('A game must have between 2 and 6 players');
      }

      // Initialize bot stacks only for the first hand.
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
            Chips: stakes.minBuyIn
          });
        }
      }

      await table.save({ session });

      // Preserve the existing first-hand chip requirement.
      for (const player of players) {
        const stack = table.PlayerStacks.find(
          item => item.PlayerId === player.id
        );

        if (
          !stack ||
          stack.Chips < stakes.ante + stakes.bringIn
        ) {
          throw new Error(
            `Player ${player.id} does not have enough chips to start`
          );
        }
      }

      const reservedTable = await TableDao.reserveForGame(
        tableId,
        session
      );

      if (!reservedTable) {
        throw new Error('Table is not waiting for a game');
      }

      game = await createHand(
        table,
        players,
        stakes,
        session
      );

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

// P53: Start another hand after the countdown.
async function startNextHand(tableId) {
  const session = await mongoose.startSession();

  try {
    let game = null;
    let sittingOutPlayerIds = [];

    await session.withTransaction(async () => {
      const table = await TableDao.findById(tableId, session);

      if (!table) {
        throw new Error('Table not found');
      }

      if (table.Status !== 'In Progress') {
        throw new Error('Table is not in progress');
      }

      if (!table.CurrentGameID) {
        throw new Error('Table has no current game');
      }

      const previousGame = await GameDao.findById(
        table.CurrentGameID,
        session
      );

      if (!previousGame || previousGame.Status !== 'Completed') {
        throw new Error('Previous hand is not completed');
      }

      if (
        !previousGame.NextHandAt ||
        new Date(previousGame.NextHandAt).getTime() >
          Date.now()
      ) {
        throw new Error('Next hand countdown has not finished');
      }

      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      const allPlayers = getTablePlayers(table);

      // Players need enough chips for both the ante
      // and a possible bring-in.
      const minimumRequired = stakes.ante + stakes.bringIn;

      const eligiblePlayers = [];

      sittingOutPlayerIds = [];

      for (const player of allPlayers) {
        const stack = table.PlayerStacks.find(
          item => item.PlayerId === player.id
        );

        if (stack && stack.Chips >= minimumRequired) {
          eligiblePlayers.push(player);
        } else {
          sittingOutPlayerIds.push(player.id);
        }
      }

      // Do not start a hand with fewer than two players.
      if (eligiblePlayers.length < 2) {
        throw new Error(
          'Not enough players with chips to start another hand'
        );
      }

      game = await createHand(
        table,
        eligiblePlayers,
        stakes,
        session
      );

      // Only advance if the previous game is still current.
      const linkedTable = await TableDao.setNextGame(
        tableId,
        previousGame._id,
        game._id,
        session
      );

      if (!linkedTable) {
        throw new Error(
          'Another request has already started the next hand'
        );
      }
    });

    return {
      game,
      sittingOutPlayerIds
    };
  } finally {
    await session.endSession();
  }
}

module.exports = {
  startGame,
  startNextHand
};
