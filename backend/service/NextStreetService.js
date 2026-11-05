
const mongoose = require('mongoose');
const GameDao = require('../model/GameDao');
const { dealNextStreet } = require('./DealingService');
const { initializeBettingRound } = require('./TurnService');

/**
 * P49 - Advance a game to its next street and
 * initialize the next betting round.
 *
 * This function only modifies the supplied game.
 * The caller is responsible for saving it.
 */
function advanceRoundInGame(game) {
  if (game.Status !== 'In Progress') {
    throw new Error('Game is not in progress');
  }

  if (!game.BettingRoundComplete) {
    throw new Error('Betting round is not complete');
  }

  if (game.AwaitingNextRound) {
    throw new Error('Next betting round has not started');
  }

  if (game.Street >= 7) {
    throw new Error('No more streets to deal');
  }

  const nextStreet = game.Street + 1;

  // Deal one card to each active player.
  dealNextStreet(game.Deck, game.Players, nextStreet);

  game.Street = nextStreet;
  game.AwaitingNextRound = true;
  game.CurrentTurnPlayerId = null;

  // Select the first player and reset betting state.
  initializeBettingRound(game);

  return game;
}

/**
 * P40 - Deal and persist the next street.
 *
 * Leaves the next betting round pending.
 */
async function advanceToNextStreet(gameId) {
  const session = await mongoose.startSession();

  try {
    let updatedGame;

    await session.withTransaction(async () => {
      const game = await GameDao.findById(gameId, session);

      if (!game) {
        throw new Error('Game not found');
      }

      if (game.Status !== 'In Progress') {
        throw new Error('Game is not in progress');
      }

      if (!game.BettingRoundComplete) {
        throw new Error('Betting round is not complete');
      }

      if (game.AwaitingNextRound) {
        throw new Error('Next betting round has not started');
      }

      if (game.Street >= 7) {
        throw new Error('No more streets to deal');
      }

      const nextStreet = game.Street + 1;

      dealNextStreet(game.Deck, game.Players, nextStreet);

      updatedGame = await GameDao.advanceStreet(
        gameId,
        game.Street,
        game.Players,
        game.Deck,
        session
      );

      if (!updatedGame) {
        throw new Error('Street has already advanced');
      }
    });

    return updatedGame;
  } finally {
    await session.endSession();
  }
}

/**
 * P49 - Progress to the next betting round
 * within a single transaction.
 */
async function progressToNextRound(gameId) {
  const session = await mongoose.startSession();

  try {
    let updatedGame;

    await session.withTransaction(async () => {
      const game = await GameDao.findById(gameId, session);

      if (!game) {
        throw new Error('Game not found');
      }

      advanceRoundInGame(game);

      await game.save({ session });

      updatedGame = game;
    });

    return updatedGame;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  advanceToNextStreet,
  progressToNextRound,
  advanceRoundInGame
};
