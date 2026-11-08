const UserDao = require('../model/UserDao');

async function settleHand(game, table, winnerIds, session) {
  if (!winnerIds.length) {
    throw new Error('Cannot settle a hand without a winner');
  }

  const winnerStacks = winnerIds.map((playerId) => {
    const stack = table.PlayerStacks.find(
      (item) => item.PlayerId === playerId
    );

    if (!stack) {
      throw new Error(`Missing chip stack for winner ${playerId}`);
    }

    return stack;
  });

  const share = Math.floor(game.Pot / winnerStacks.length);
  let remainder = game.Pot % winnerStacks.length;

  for (const stack of winnerStacks) {
    stack.Chips += share + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }

  const humanIds = new Set(
    table.UserIds.map((userId) => userId.toString())
  );

  for (const userId of humanIds) {
    const stack = table.PlayerStacks.find(
      (item) => item.PlayerId === userId
    );

    if (!stack) {
      throw new Error(`Missing chip stack for player ${userId}`);
    }

    if (stack.Chips > 0) {
      const updatedUser = await UserDao.creditChips(
        userId,
        stack.Chips,
        session
      );

      if (!updatedUser) {
        throw new Error(`Unable to return chips to player ${userId}`);
      }
    }
  }

  for (const stack of table.PlayerStacks) {
    stack.Chips = 0;
  }

  table.Status = 'Closed';
  game.WinnerIds = winnerIds;
  game.Status = 'Completed';
  game.CurrentTurnPlayerId = null;
  game.BettingRoundComplete = true;
  game.AwaitingNextRound = false;

  await table.save({ session });

  return {
    winnerIds,
    pot: game.Pot,
  };
}

module.exports = { settleHand };
