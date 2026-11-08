const RANK_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function getStraightHigh(ranks) {
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

  if (uniqueRanks.includes(14)) {
    uniqueRanks.push(1);
  }

  for (let index = 0; index <= uniqueRanks.length - 5; index++) {
    if (uniqueRanks[index] - uniqueRanks[index + 4] === 4) {
      return uniqueRanks[index];
    }
  }

  return 0;
}

function evaluateFiveCards(cards) {
  const ranks = cards
    .map((card) => RANK_VALUES[card.rank])
    .sort((a, b) => b - a);
  const counts = new Map();

  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) || 0) + 1);
  }

  const groups = [...counts.entries()].sort(
    ([rankA, countA], [rankB, countB]) =>
      countB - countA || rankB - rankA
  );
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(ranks);

  if (flush && straightHigh) return [8, straightHigh];

  if (groups[0][1] === 4) {
    return [7, groups[0][0], groups[1][0]];
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return [6, groups[0][0], groups[1][0]];
  }

  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];

  if (groups[0][1] === 3) {
    const kickers = groups
      .slice(1)
      .map(([rank]) => rank)
      .sort((a, b) => b - a);
    return [3, groups[0][0], ...kickers];
  }

  const pairs = groups
    .filter(([, count]) => count === 2)
    .map(([rank]) => rank)
    .sort((a, b) => b - a);

  if (pairs.length === 2) {
    const kicker = groups.find(([, count]) => count === 1)[0];
    return [2, ...pairs, kicker];
  }

  if (pairs.length === 1) {
    const kickers = groups
      .filter(([, count]) => count === 1)
      .map(([rank]) => rank)
      .sort((a, b) => b - a);
    return [1, pairs[0], ...kickers];
  }

  return [0, ...ranks];
}

function compareHandRanks(handA, handB) {
  for (let index = 0; index < Math.max(handA.length, handB.length); index++) {
    const difference = (handA[index] || 0) - (handB[index] || 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function evaluateSevenCardHand(cards) {
  if (cards.length < 5) {
    throw new Error('At least five cards are required to evaluate a hand');
  }

  let bestHand = null;

  for (let first = 0; first < cards.length - 4; first++) {
    for (let second = first + 1; second < cards.length - 3; second++) {
      for (let third = second + 1; third < cards.length - 2; third++) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth++) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth++) {
            const hand = evaluateFiveCards([
              cards[first],
              cards[second],
              cards[third],
              cards[fourth],
              cards[fifth],
            ]);

            if (!bestHand || compareHandRanks(hand, bestHand) > 0) {
              bestHand = hand;
            }
          }
        }
      }
    }
  }

  return bestHand;
}

function findWinners(players) {
  const activePlayers = players.filter((player) => !player.HasFolded);

  if (activePlayers.length === 0) {
    throw new Error('No active players can win the pot');
  }

  if (activePlayers.length === 1) {
    return [activePlayers[0].PlayerId];
  }

  let bestHand = null;
  let winners = [];

  for (const player of activePlayers) {
    const hand = evaluateSevenCardHand(player.Cards);
    const comparison = bestHand
      ? compareHandRanks(hand, bestHand)
      : 1;

    if (comparison > 0) {
      bestHand = hand;
      winners = [player.PlayerId];
    } else if (comparison === 0) {
      winners.push(player.PlayerId);
    }
  }

  return winners;
}

module.exports = {
  compareHandRanks,
  evaluateSevenCardHand,
  findWinners,
};
