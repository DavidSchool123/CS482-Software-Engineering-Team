
const mongoose = require('mongoose');
const GameDao = require('../model/GameDao');
const { dealNextStreet } = require('./DealingService');

/**
 * P40 - Deal and persist the next street.
 *
 * P49 will handle starting the new betting round.
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

      // Prevent dealing again before P49 initializes
      // the betting round for the newly dealt street.
      if (game.AwaitingNextRound) {
        throw new Error('Next betting round has not started');
      }

      if (game.Street >= 7) {
        throw new Error('No more streets to deal');
      }

      const nextStreet = game.Street + 1;

      // Deal one new card to each active player.
      dealNextStreet(game.Deck, game.Players, nextStreet);

      // Atomically save the updated hands, deck, and street.
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

module.exports = { advanceToNextStreet };
