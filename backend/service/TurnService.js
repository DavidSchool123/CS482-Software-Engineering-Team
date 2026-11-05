
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
  A: 14
};

/**
 * Evaluate only the cards visible to other players.
 * Seven-card stud has at most four exposed cards,
 * so five-card straights and flushes cannot occur here.
 */
function evaluateVisibleHand(cards) {
  const visibleCards = cards.filter(card => card.faceUp);

  const ranks = visibleCards
    .map(card => RANK_VALUES[card.rank])
    .sort((a, b) => b - a);

  const counts = new Map();

  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) || 0) + 1);
  }

  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) =>
      b.count - a.count || b.rank - a.rank
    );

  // Four of a kind
  if (groups[0]?.count === 4) {
    return [4, groups[0].rank];
  }

  // Three of a kind
  if (groups[0]?.count === 3) {
    const kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.rank);

    return [3, groups[0].rank, ...kickers];
  }

  // Two pair
  const pairs = groups
    .filter(group => group.count === 2)
    .map(group => group.rank)
    .sort((a, b) => b - a);

  if (pairs.length === 2) {
    const kicker = groups
      .filter(group => group.count === 1)
      .map(group => group.rank);

    return [2, ...pairs, ...kicker];
  }

  // One pair
  if (pairs.length === 1) {
    const kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.rank)
      .sort((a, b) => b - a);

    return [1, pairs[0], ...kickers];
  }

  // High card
  return [0, ...ranks];
}

/**
 * Compare two evaluated exposed hands.
 * Positive: A wins
 * Negative: B wins
 * Zero: Tie
 */
function compareHands(handA, handB) {
  const length = Math.max(handA.length, handB.length);

  for (let i = 0; i < length; i++) {
    const difference = (handA[i] || 0) - (handB[i] || 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

/**
 * Determine which active player acts first.
 * Ties use the game's randomized seating order.
 */
function determineFirstPlayer(players) {
  const activePlayers = players.filter(
    player => !player.HasFolded
  );

  if (activePlayers.length === 0) {
    throw new Error('No active players');
  }

  let firstPlayer = activePlayers[0];
  let bestHand = evaluateVisibleHand(firstPlayer.Cards);

  for (let i = 1; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    const hand = evaluateVisibleHand(player.Cards);

    if (compareHands(hand, bestHand) > 0) {
      firstPlayer = player;
      bestHand = hand;
    }
  }

  return firstPlayer.PlayerId;
}

/**
 * P49 - Initialize betting after P40 deals a new street.
 */
function initializeBettingRound(game) {
  if (!game.AwaitingNextRound) {
    throw new Error('No new betting round is pending');
  }

  if (game.Street < 4 || game.Street > 7) {
    throw new Error('Invalid street for betting initialization');
  }

  const firstPlayerId = determineFirstPlayer(game.Players);

  // Reset each player's betting state
  for (const player of game.Players) {
    player.RoundContribution = 0;
    player.HasActed = false;
  }

  // Reset betting state for the new street
  game.CurrentBet = 0;
  game.RaiseCount = 0;
  game.LastRaiseAmount = 0;

  game.CurrentTurnPlayerId = firstPlayerId;
  game.BettingRoundComplete = false;
  game.AwaitingNextRound = false;

  return game;
}

module.exports = {
  evaluateVisibleHand,
  compareHands,
  determineFirstPlayer,
  initializeBettingRound
};
