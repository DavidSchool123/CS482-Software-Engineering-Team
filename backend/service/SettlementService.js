const UserDao = require('../model/UserDao');

const { evaluateSevenCardHand, getHandName } = require('./HandEvaluationService');

const NEXT_HAND_DELAY_MS = 30 * 1000;

async function settleHand(game, table, winnerIds, session) {
  if (game.Status !== 'In Progress') {
    throw new Error('Hand has already been settled');
  }

  if (!winnerIds.length) {
    throw new Error('Cannot settle a hand without a winner');
  }

  if (!Number.isInteger(game.Pot) || game.Pot < 0) {
    throw new Error('Invalid pot amount');
  }

  const activePlayerIds = new Set(
    game.Players
      .filter(player => !player.HasFolded)
      .map(player => player.PlayerId)
  );

  if (
    new Set(winnerIds).size !== winnerIds.length ||
    winnerIds.some(id => !activePlayerIds.has(id))
  ) {
    throw new Error('Invalid winner IDs');
  }

  const winnerStacks = winnerIds.map(playerId => {
    const stack = table.PlayerStacks.find(
      item => item.PlayerId === playerId
    );

    if (!stack) {
      throw new Error(`Missing chip stack for winner ${playerId}`);
    }

    return stack;
  });

  // Distribute the pot among the winners.
  const pot = game.Pot;
  const share = Math.floor(pot / winnerStacks.length);
  let remainder = pot % winnerStacks.length;

  const payouts = [];

  for (const stack of winnerStacks) {
    const amount = share + (remainder > 0 ? 1 : 0);

    stack.Chips += amount;

    payouts.push({
      playerId: stack.PlayerId,
      amount
    });

    if (remainder > 0) {
      remainder--;
    }
  }

  // P53: Save the results for the completed-hand screen.
  const handResults = payouts.map(payout => {
    const player = game.Players.find(
      item => item.PlayerId === payout.playerId
    );

    let handName = null;

        // A player may win because everyone else folded,
    // even before all seven cards have been dealt.
    if (player && player.Cards.length === 7) {
      const evaluation = evaluateSevenCardHand(
        player.Cards
      );

      handName = getHandName(evaluation);
    }

    return {
      PlayerId: payout.playerId,
      AmountWon: payout.amount,
      HandName: handName
    };
  });

  // Update statistics for every human player in the completed game.
  const winnerSet = new Set(winnerIds.map(String));
  const payoutByPlayer = new Map(
    payouts.map(payout => [
      String(payout.playerId),
      payout.amount,
    ])
  );

  for (const player of game.Players) {
    const playerId = String(player.PlayerId);

    // Bots do not have registered user accounts.
    if (!require('mongoose').isValidObjectId(playerId)) {
      continue;
    }

    const payout = payoutByPlayer.get(playerId) || 0;
    const contribution = player.TotalContribution || 0;

    await UserDao.updateGameStats(
      playerId,
      {
        wins: winnerSet.has(playerId) ? 1 : 0,
        losses: winnerSet.has(playerId) ? 0 : 1,
        totalChipsWon: payout,
        netWinnings: payout - contribution,
      },
      session,
    );
  }

  // P53: Start the countdown when the hand finishes.
  const completedAt = new Date();
  const nextHandAt = new Date(
    completedAt.getTime() + NEXT_HAND_DELAY_MS
  );

  // Complete the hand without closing the table.
  game.WinnerIds = winnerIds;
  game.HandResults = handResults;
  game.CompletedAt = completedAt;
  game.NextHandAt = nextHandAt;

  game.Status = 'Completed';
  game.CurrentTurnPlayerId = null;
  game.BettingRoundComplete = true;
  game.AwaitingNextRound = false;

  // Keep chip stacks at the table for the next hand.
  // The caller saves the game in the same transaction.
  await table.save({ session });

  return {
    winnerIds,
    pot,
    payouts,
    handResults,
    completedAt,
    nextHandAt
  };
}

module.exports = { settleHand };
