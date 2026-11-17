
const mongoose = require('mongoose');

const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const { advanceRoundInGame } = require('./NextStreetService');
const { findWinners } = require('./HandEvaluationService');
const { settleHand } = require('./SettlementService');

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise'];
const MAX_RAISES = 3;

function getBetSize(stakes, street) {
  return street <= 4 ? stakes.smallBet : stakes.bigBet;
}

function nextPlayer(players, currentPlayerId, currentBet) {
  const index = players.findIndex(
    p => p.PlayerId === currentPlayerId
  );

  if (index === -1) {
    throw new Error('Current player not found');
  }

  for (let offset = 1; offset <= players.length; offset++) {
    const player = players[(index + offset) % players.length];

    if (
      !player.HasFolded &&
      (!player.HasActed || player.RoundContribution < currentBet)
    ) {
      return player.PlayerId;
    }
  }

  return null;
}

function isBettingRoundComplete(players, currentBet) {
  const activePlayers = players.filter(p => !p.HasFolded);

  return activePlayers.every(
    p => p.HasActed && p.RoundContribution >= currentBet
  );
}

async function performBettingAction(gameId, playerId, action) {
  if (!ACTIONS.includes(action)) {
    throw new Error('Invalid betting action');
  }

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

      if (game.BettingRoundComplete || game.AwaitingNextRound) {
        throw new Error('Betting round is not accepting actions');
      }

      if (game.CurrentTurnPlayerId !== playerId) {
        throw new Error('It is not this player’s turn');
      }

      const player = game.Players.find(
        p => p.PlayerId === playerId
      );

      if (!player || player.HasFolded) {
        throw new Error('Player cannot act');
      }

      const table = await TableDao.findById(
        game.TableId,
        session
      );

      if (!table) {
        throw new Error('Table not found');
      }

      const stakes = TABLE_LEVELS[table.Level];

      if (!stakes) {
        throw new Error('Invalid table level');
      }

      const betSize = getBetSize(stakes, game.Street);

      const amountToCall =
        game.CurrentBet - player.RoundContribution;

      let amount = 0;
      let isFullRaise = false;

      switch (action) {
        case 'fold':
          player.HasFolded = true;
          break;

        case 'check':
          if (amountToCall !== 0) {
            throw new Error('Cannot check when facing a bet');
          }
          break;

        case 'call':
          if (amountToCall <= 0) {
            throw new Error('Nothing to call');
          }

          amount = amountToCall;
          break;

        case 'bet':
          if (game.CurrentBet !== 0) {
            throw new Error(
              'Cannot bet when a bet already exists'
            );
          }

          amount = betSize;
          game.CurrentBet = betSize;
          break;

        case 'raise':
          if (game.CurrentBet === 0) {
            throw new Error(
              'Cannot raise without an existing bet'
            );
          }

          // Complete the Third Street bring-in.
          if (
            game.Street === 3 &&
            game.CurrentBet < stakes.smallBet
          ) {
            amount =
              stakes.smallBet - player.RoundContribution;

            game.CurrentBet = stakes.smallBet;
          } else {
            if ((game.RaiseCount || 0) >= MAX_RAISES) {
              throw new Error('Maximum raises reached');
            }

            amount = amountToCall + betSize;

            game.CurrentBet += betSize;
            game.RaiseCount = (game.RaiseCount || 0) + 1;
          }

          isFullRaise = true;
          break;
      }

      // Deduct chips once through TableDao.
      if (amount > 0) {
        const updatedTable = await TableDao.deductPlayerChips(
          game.TableId,
          playerId,
          amount,
          session
        );

        if (!updatedTable) {
          throw new Error('Insufficient chips');
        }

        player.RoundContribution += amount;
        player.TotalContribution += amount;
        game.Pot += amount;
      }

      // A new bet or raise requires other players
      // to respond again.
      if (isFullRaise || action === 'bet') {
        game.Players.forEach(p => {
          if (!p.HasFolded && p.PlayerId !== playerId) {
            p.HasActed = false;
          }
        });
      }

      player.HasActed = true;

      const activePlayers = game.Players.filter(
        p => !p.HasFolded
      );

      let winnerIds = null;

      if (activePlayers.length === 1) {
        // All other players folded.
        game.CurrentTurnPlayerId = null;
        game.BettingRoundComplete = true;
        winnerIds = [activePlayers[0].PlayerId];
      } else {
        const complete = isBettingRoundComplete(
          game.Players,
          game.CurrentBet
        );

        if (complete) {
          game.CurrentTurnPlayerId = null;
          game.BettingRoundComplete = true;

          if (game.Street === 7) {
            // Showdown: determine the winning hand.
            winnerIds = findWinners(game.Players);
          } else {
            // Deal the next street and initialize betting.
            advanceRoundInGame(game);
          }
        } else {
          // Continue the current betting round.
          game.CurrentTurnPlayerId = nextPlayer(
            game.Players,
            playerId,
            game.CurrentBet
          );

          game.BettingRoundComplete = false;
        }
      }

      if (winnerIds) {
        // Reload the table after any chip deductions
        // so settlement uses the latest balances.
        const currentTable = await TableDao.findById(
          game.TableId,
          session
        );

        if (!currentTable) {
          throw new Error('Table not found during settlement');
        }

        await settleHand(
          game,
          currentTable,
          winnerIds,
          session
        );
      }

      // Save the game within the same transaction.
      await game.save({ session });

      updatedGame = game;
    });

    console.log(
      `[GAME ${gameId}] ` +
      `Street ${updatedGame.Street} | ` +
      `${playerId.startsWith('bot-') ? 'Bot' : 'Human'} ` +
      `${playerId} -> ${action} | ` +
      `Pot: ${updatedGame.Pot} | ` +
      `Next: ${updatedGame.CurrentTurnPlayerId || 'None'} | ` +
      `Status: ${updatedGame.Status}`
    );

    return updatedGame;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  performBettingAction,
  getBetSize,
  nextPlayer,
  isBettingRoundComplete
};
