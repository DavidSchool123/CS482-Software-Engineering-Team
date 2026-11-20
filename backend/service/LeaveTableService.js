
const mongoose = require('mongoose');

const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const UserDao = require('../model/UserDao');
const GameActionEvent = require('../model/GameActionEvent');

const {
  nextPlayer,
  isBettingRoundComplete
} = require('./BettingService');

const { advanceRoundInGame } = require('./NextStreetService');
const { findWinners } = require('./HandEvaluationService');
const { settleHand } = require('./SettlementService');

function makeError(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Cancel an unfinished hand when the last human leaves.
// Return contributions to table stacks before refunding humans.

function cancelUnfinishedHand(game, table) {
  for (const player of game.Players) {
    const stack = table.PlayerStacks.find(
      item => item.PlayerId === player.PlayerId
    );

    // A player who left earlier no longer has a table stack.
    if (!stack) continue;

    stack.Chips += player.TotalContribution;
  }

  game.Pot = 0;
  game.Status = 'Completed';
  game.CompletedAt = new Date();
  game.NextHandAt = null;
  game.CurrentTurnPlayerId = null;
  game.BettingRoundComplete = true;
  game.AwaitingNextRound = false;
  game.WinnerIds = [];
  game.HandResults = [];
}


// Fold a player without requiring it to be their turn.
async function foldDepartingPlayer(game, table, playerId, session) {
  const player = game.Players.find(
    item => item.PlayerId === playerId
  );

  if (!player || player.HasFolded) {
    return;
  }

  const wasCurrentTurn =
    game.CurrentTurnPlayerId === playerId;

  player.HasFolded = true;
  player.HasActed = true;

  await GameActionEvent.create([{
    gameId: game._id,
    playerId,
    action: 'fold',
    amount: 0,
    street: game.Street,
    createdAt: new Date()
  }], { session });

  const remaining = game.Players.filter(
    item => !item.HasFolded
  );

  if (remaining.length === 1) {
    await settleHand(
      game,
      table,
      [remaining[0].PlayerId],
      session
    );
    return;
  }

  if (remaining.length === 0) {
    throw new Error('No players remain in the hand');
  }

  // The fold might finish the current betting round.
  const roundComplete = isBettingRoundComplete(
    game.Players,
    game.CurrentBet
  );

  if (roundComplete) {
    game.CurrentTurnPlayerId = null;
    game.BettingRoundComplete = true;

    if (game.Street === 7) {
      const winners = findWinners(game.Players);
      await settleHand(game, table, winners, session);
    } else {
      advanceRoundInGame(game);
    }

    return;
  }

  // Preserve another player's turn if they are still acting.
  if (wasCurrentTurn) {
    game.CurrentTurnPlayerId = nextPlayer(
      game.Players,
      playerId,
      game.CurrentBet
    );
  }
}

/**
 * Remove a seated player from a table.
 *
 * Explicit leave:
 *   leaveTable(tableId, userId)
 *
 * Automatic inactivity removal:
 *   leaveTable(tableId, userId, { inactiveBefore: cutoff })
 *
 * The inactivity check happens inside the transaction.
 */
async function leaveTable(tableId, userId, options = {}) {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const table = await TableDao.findById(
        tableId,
        session
      );

      if (!table) {
        throw makeError('Table not found', 404);
      }

      const playerId = String(userId);

      const isSeated = table.UserIds.some(
        id => String(id) === playerId
      );

      if (!isSeated) {
        throw makeError(
          'You are not seated at this table',
          403
        );
      }

      // Only used for automatic inactivity removal.
      // A normal Leave Table request skips this check.
      if (options.inactiveBefore) {
        const presence = table.PlayerPresence.find(
          item => item.PlayerId === playerId
        );

        // Player reconnected, or has no valid presence
        // record. Do not remove them.
        if (
          !presence ||
          !presence.LastSeenAt ||
          presence.LastSeenAt > options.inactiveBefore
        ) {
          return;
        }
      }

      const stack = table.PlayerStacks.find(
        item => item.PlayerId === playerId
      );

      if (!stack) {
        throw new Error('Player chip stack not found');
      }

      const isLastHuman = table.UserIds.length === 1;
      let game = null;

      if (table.CurrentGameID) {
        game = await GameDao.findById(
          table.CurrentGameID,
          session
        );

        if (!game) {
          throw new Error('Current game not found');
        }
      }

      if (
        table.Status === 'In Progress' &&
        game?.Status === 'In Progress'
      ) {
        if (isLastHuman) {
          cancelUnfinishedHand(game, table);
        } else {
          await foldDepartingPlayer(
            game,
            table,
            playerId,
            session
          );
        }

        await game.save({ session });
      }

      // Settlement/cancellation may have changed the stack.
      const remainingStack = table.PlayerStacks.find(
        item => item.PlayerId === playerId
      );

      const refund = remainingStack.Chips;

      if (!Number.isInteger(refund) || refund < 0) {
        throw new Error('Invalid remaining chip stack');
      }

      // Credit the player's account in this transaction.
      const updatedUser = await UserDao.creditChips(
        userId,
        refund,
        session
      );

      if (!updatedUser) {
        throw new Error('User not found');
      }

      // Remove the player from the table.
      table.UserIds = table.UserIds.filter(
        id => String(id) !== playerId
      );

      // Remove their table stack.
      table.PlayerStacks = table.PlayerStacks.filter(
        item => item.PlayerId !== playerId
      );

      // Remove their presence record.
      table.PlayerPresence = table.PlayerPresence.filter(
        item => item.PlayerId !== playerId
      );

      if (isLastHuman) {
        table.Status = 'Closed';
      }

      await table.save({ session });

      result = {
        message: 'Left table successfully',
        tableId: String(table._id),
        gameId: game ? String(game._id) : null,
        refundedChips: refund,
        accountBalance: updatedUser.chipBalance,
        tableClosed: isLastHuman,
        gameStatus: game?.Status || null
      };
    });

    // Null means the player reconnected before removal.
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { leaveTable };
