const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const { performBettingAction } = require('./BettingService');

function getHandStrength(cards) {
  const rankCounts = new Map();
  const suitCounts = new Map();

  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
  }

  const groups = [...rankCounts.values()].sort((a, b) => b - a);
  const pairs = groups.filter((count) => count === 2).length;

  if (groups[0] >= 3) return 4;
  if (pairs >= 2) return 3;
  if (pairs === 1) return 2;
  if ([...suitCounts.values()].some((count) => count >= 3)) return 1;

  const highCards = cards.filter((card) =>
    ['10', 'J', 'Q', 'K', 'A'].includes(card.rank)
  ).length;

  return highCards >= 2 ? 1 : 0;
}

function chooseBotAction(game, player, table) {
  const stack = table.PlayerStacks.find(
    (item) => item.PlayerId === player.PlayerId
  );

  if (!stack) {
    throw new Error(`Missing chip stack for bot ${player.PlayerId}`);
  }

  const amountToCall = Math.max(
    0,
    game.CurrentBet - player.RoundContribution
  );

  if (amountToCall > stack.Chips) {
    return 'fold';
  }

  const strength = getHandStrength(player.Cards);

  if (amountToCall > 0) {
    const potOdds = amountToCall / Math.max(1, game.Pot + amountToCall);

    return strength >= 2 || potOdds <= 0.22 ? 'call' : 'fold';
  }

  const stakes = TABLE_LEVELS[table.Level];

  if (!stakes) {
    throw new Error('Invalid table level');
  }

  const betSize = game.Street <= 4 ? stakes.smallBet : stakes.bigBet;

  if (
    game.CurrentBet === 0 &&
    strength >= 3 &&
    stack.Chips >= betSize &&
    game.RaiseCount < 3
  ) {
    return 'bet';
  }

  return 'check';
}

async function runBotTurns(gameId) {
  const maxActions = 36;
  const actions = [];

  for (let actionCount = 0; actionCount < maxActions; actionCount++) {
    const game = await GameDao.findById(gameId);

    if (!game) {
      throw new Error('Game not found');
    }

    const currentPlayerId = game.CurrentTurnPlayerId;

    if (
      game.Status !== 'In Progress' ||
      typeof currentPlayerId !== 'string' ||
      !currentPlayerId.startsWith('bot-')
    ) {
      return { game, actions };
    }

    const table = await TableDao.findById(game.TableId);

    if (!table) {
      throw new Error('Table not found');
    }

    const player = game.Players.find(
      (item) => item.PlayerId === currentPlayerId
    );

    if (!player || player.HasFolded) {
      throw new Error('Current bot cannot act');
    }

    const action = chooseBotAction(game, player, table);
    await performBettingAction(gameId, currentPlayerId, action);
    actions.push({ playerId: currentPlayerId, action });
  }

  throw new Error('Automated player action limit exceeded');
}

module.exports = {
  chooseBotAction,
  runBotTurns,
};
