
/**
 * P21 — Context-aware Seven-Card Stud tips.
 *
 * Analyzes the privacy-filtered game state and returns
 * the most relevant strategic observation.
 *
 * Does not modify game state or perform betting actions.
 */

const FACE_RANKS = {
  A: 14, ACE: 14,
  K: 13, KING: 13,
  Q: 12, QUEEN: 12,
  J: 11, JACK: 11,
  T: 10
};

function rankValue(rank) {
  if (rank == null) return null;

  const key = String(rank).trim().toUpperCase();

  if (FACE_RANKS[key]) return FACE_RANKS[key];

  const number = Number(key);

  return Number.isInteger(number) && number >= 2 && number <= 14
    ? number
    : null;
}

function normalizeSuit(suit) {
  const key = String(suit ?? '').trim().toLowerCase();

  const suits = {
    h: 'hearts', heart: 'hearts', hearts: 'hearts', '♥': 'hearts',
    d: 'diamonds', diamond: 'diamonds', diamonds: 'diamonds', '♦': 'diamonds',
    c: 'clubs', club: 'clubs', clubs: 'clubs', '♣': 'clubs',
    s: 'spades', spade: 'spades', spades: 'spades', '♠': 'spades'
  };

  return suits[key] || null;
}

function normalizeCard(card) {
  if (!card || card.rank == null || card.suit == null) return null;

  const rank = rankValue(card.rank);
  const suit = normalizeSuit(card.suit);

  if (rank == null || suit == null) return null;

  return { rank, suit, faceUp: card.faceUp === true };
}

function countBy(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return counts;
}

function hasStraight(ranks) {
  const unique = new Set(ranks);

  if (unique.has(14)) unique.add(1);

  for (let start = 1; start <= 10; start++) {
    if (
      Array.from({ length: 5 }, (_, index) => start + index)
        .every(rank => unique.has(rank))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Returns missing ranks for potential one-card straight draws.
 * The window must contain four distinct ranks already held.
 */
function getStraightDraws(ranks) {
  const unique = new Set(ranks);

  if (unique.has(14)) unique.add(1);

  const missing = new Set();

  for (let start = 1; start <= 10; start++) {
    const sequence = Array.from(
      { length: 5 },
      (_, index) => start + index
    );

    const present = sequence.filter(rank => unique.has(rank));

    if (present.length === 4) {
      const needed = sequence.find(rank => !unique.has(rank));
      missing.add(needed === 1 ? 14 : needed);
    }
  }

  return [...missing];
}

function evaluateHand(cards) {
  const ranks = cards.map(card => card.rank);
  const suits = cards.map(card => card.suit);

  const rankCounts = countBy(ranks);
  const suitCounts = countBy(suits);

  const frequencies = [...rankCounts.values()]
    .sort((a, b) => b - a);

  const flushSuit = [...suitCounts.entries()]
    .find(([, count]) => count >= 5)?.[0];

  const flushCards = flushSuit
    ? cards.filter(card => card.suit === flushSuit)
    : [];

  if (flushSuit && hasStraight(flushCards.map(card => card.rank))) {
    return { strength: 9, name: 'Straight flush' };
  }

  if (frequencies[0] === 4) {
    return { strength: 8, name: 'Four of a kind' };
  }

  if (
    frequencies[0] >= 3 &&
    frequencies.slice(1).some(count => count >= 2)
  ) {
    return { strength: 7, name: 'Full house' };
  }

  if (flushSuit) {
    return { strength: 6, name: 'Flush' };
  }

  if (hasStraight(ranks)) {
    return { strength: 5, name: 'Straight' };
  }

  if (frequencies[0] === 3) {
    return { strength: 4, name: 'Three of a kind' };
  }

  if (frequencies.filter(count => count >= 2).length >= 2) {
    return { strength: 3, name: 'Two pair' };
  }

  if (frequencies[0] === 2) {
    const pairRank = [...rankCounts.entries()]
      .find(([, count]) => count === 2)?.[0];

    return {
      strength: 2,
      name: pairRank >= 11 ? 'High pair' : 'Pair'
    };
  }

  return { strength: 1, name: 'High card' };
}

function makeTip(id, title, message, detail, category, priority) {
  return { id, title, message, detail, category, priority };
}

function getOpponentThreats(opponents) {
  const threats = [];

  for (const opponent of opponents) {
    const exposed = (opponent.cards || [])
      .filter(card => card?.faceUp === true)
      .map(normalizeCard)
      .filter(Boolean);

    const ranks = exposed.map(card => card.rank);
    const suits = exposed.map(card => card.suit);

    const rankCounts = [...countBy(ranks).values()];
    const suitCounts = [...countBy(suits).values()];

    if (rankCounts.some(count => count >= 3)) {
      threats.push({
        type: 'trips',
        priority: 75,
        title: 'An opponent is showing three of a kind',
        message: 'Three exposed cards share a rank. That opponent has at least three of a kind.'
      });
    } else if (rankCounts.some(count => count >= 2)) {
      threats.push({
        type: 'pair',
        priority: 48,
        title: 'An opponent is showing a pair',
        message: 'An opponent has two exposed cards of the same rank. Their hidden cards could make their hand stronger.'
      });
    }

    if (suitCounts.some(count => count >= 4)) {
      threats.push({
        type: 'flush',
        priority: 65,
        title: 'An opponent is showing four cards of one suit',
        message: 'They may already have a flush using a hidden card, or may be drawing toward one.'
      });
    }
  }

  return threats;
}

/**
 * @returns {{
 *   id: string,
 *   title: string,
 *   message: string,
 *   detail: string,
 *   category: string,
 *   secondary: string|null
 * } | null}
 */
export function getStrategicTip({
  game,
  amountToCall = 0,
  myChips = null,
  isMyTurn = false,
  canAct = false,
  raiseLimitReached = false
} = {}) {
  if (!game || game.status !== 'In Progress') return null;

  const me = (game.players || []).find(
    player => player.isCurrentPlayer
  );

  if (!me || me.hasFolded) return null;

  const cards = (me.cards || [])
    .map(normalizeCard)
    .filter(Boolean);

  if (cards.length === 0) return null;

  const opponents = (game.players || []).filter(
    player => !player.isCurrentPlayer && !player.hasFolded
  );

  const exposedOpponentCards = opponents.flatMap(player =>
    (player.cards || [])
      .filter(card => card?.faceUp === true)
      .map(normalizeCard)
      .filter(Boolean)
  );

  const street = Number(game.street);
  const hand = evaluateHand(cards);
  const tips = [];

  const addTip = (...args) => tips.push(makeTip(...args));

  const callCost = Math.max(0, Number(amountToCall) || 0);
  const stack = myChips == null ? null : Number(myChips);

  const canDraw = street >= 3 && street < 7;

  // --------------------------------------------------
  // 1. Made-hand observations
  // --------------------------------------------------

  if (hand.strength >= 5) {
    addTip(
      `made-${hand.name.toLowerCase().replaceAll(' ', '-')}`,
      `You have a ${hand.name.toLowerCase()}!`,
      `Your cards currently make a ${hand.name.toLowerCase()}. Consider how your hand compares with the exposed cards around the table.`,
      'A strong hand can still lose. Opponents may have hidden cards that complete an even stronger hand.',
      'Your hand',
      hand.strength >= 7 ? 90 : 76
    );
  } else if (hand.strength >= 2) {
    addTip(
      `made-${hand.name.toLowerCase().replaceAll(' ', '-')}`,
      `You have ${hand.name === 'High pair' ? 'a high pair' : hand.name === 'Two pair' ? 'two pair' : `a ${hand.name.toLowerCase()}`}`,
      `Your current hand is ${hand.name.toLowerCase()}. Watch for improvements and consider what your opponents are showing.`,
      'As additional cards are dealt, other players may improve their hands too.',
      'Your hand',
      hand.strength >= 4 ? 68 : hand.strength === 3 ? 56 : 35
    );
  }

  // --------------------------------------------------
  // 2. Flush draws
  // --------------------------------------------------

  const suitCounts = countBy(cards.map(card => card.suit));

  const flushDraw = [...suitCounts.entries()]
    .find(([, count]) => count === 4);

  if (canDraw && flushDraw && hand.strength < 6) {
    const [suit] = flushDraw;

    const exposedMatching = exposedOpponentCards
      .filter(card => card.suit === suit).length;

    addTip(
      `flush-draw-${suit}`,
      'You are one card away from a flush',
      `You have four ${suit}. ${
        exposedMatching > 0
          ? `${exposedMatching} matching card${exposedMatching === 1 ? ' is' : 's are'} visible in opponents' hands.`
          : 'Watch for matching cards exposed by opponents.'
      }`,
      'One more card of the same suit would complete your flush. Consider how many cards remain and the cost of continuing.',
      'Drawing hand',
      80
    );
  }

  // --------------------------------------------------
  // 3. Straight draws
  // --------------------------------------------------

  if (canDraw && hand.strength < 5) {
    const neededRanks = getStraightDraws(
      cards.map(card => card.rank)
    );

    if (neededRanks.length > 0) {
      const exposedNeeded = exposedOpponentCards
        .filter(card => neededRanks.includes(card.rank)).length;

      addTip(
        'straight-draw',
        'You are drawing to a straight',
        `Your cards are one rank away from a straight. ${
          exposedNeeded > 0
            ? `${exposedNeeded} potentially helpful card${exposedNeeded === 1 ? ' is' : 's are'} already exposed.`
            : 'Watch the exposed cards for ranks that could complete it.'
        }`,
        'A straight requires five consecutive ranks. Aces can be high or low, but cannot wrap around.',
        'Drawing hand',
        72
      );
    }
  }

  // --------------------------------------------------
  // 4. Opponent observations
  // --------------------------------------------------

  for (const threat of getOpponentThreats(opponents)) {
    addTip(
      `opponent-${threat.type}`,
      threat.title,
      threat.message,
      'Only exposed cards are considered. Opponents may have stronger or weaker hidden cards than their visible cards suggest.',
      'Opponent awareness',
      threat.priority
    );
  }

  // --------------------------------------------------
  // 5. Betting decisions
  // --------------------------------------------------

  if (isMyTurn && canAct) {
    if (callCost > 0 && stack !== null && callCost > stack) {
      addTip(
        'insufficient-stack',
        'Your stack cannot cover the call',
        `Calling costs ${callCost} chips, but you have ${stack}.`,
        'Your betting controls determine which actions are permitted.',
        'Betting',
        100
      );
    } else if (
      callCost > 0 &&
      stack !== null &&
      stack > 0 &&
      callCost >= stack * 0.4
    ) {
      addTip(
        'expensive-call',
        'This is a costly call',
        `Calling costs ${callCost} of your ${stack} remaining chips. Consider your hand strength before committing.`,
        'A promising hand or draw does not guarantee that you will win the pot.',
        'Betting',
        95
      );
    } else if (callCost > 0) {
      addTip(
        'facing-bet',
        'Consider the cost of calling',
        `You need ${callCost} chips to call. Compare that cost with your hand, the pot, and opponents' exposed cards.`,
        raiseLimitReached
          ? 'The raise limit has been reached for this betting round.'
          : 'A raise may also be available if your stack and the betting rules permit it.',
        'Betting',
        60
      );
    } else {
      addTip(
        'check-available',
        'You can check without adding chips',
        'There is no outstanding bet for you to match. Checking lets you remain in the hand without adding chips.',
        'You may also be able to bet, depending on your remaining chips and the betting rules.',
        'Betting',
        42
      );
    }
  }

  // --------------------------------------------------
  // 6. Street-specific guidance
  // --------------------------------------------------

  if (street === 3) {
    addTip(
      'third-street',
      'Third street: evaluate your starting hand',
      'You have three cards. Look at your starting hand and the exposed cards before committing more chips.',
      'The bring-in begins the first betting round in Seven-Card Stud.',
      'Game stage',
      25
    );
  }

  if (street === 7) {
    addTip(
      'seventh-street',
      'Final street: your hand is complete',
      'All seven cards have been dealt. No additional cards will improve your hand.',
      'Compare your best five-card hand with the opponents’ exposed cards and the current betting cost.',
      'Game stage',
      55
    );
  }

  if (tips.length === 0) {
    addTip(
      'general',
      'Watch the cards and the betting',
      'Consider your hand, your opponents’ exposed cards, and the cost of continuing.',
      'Only cards available to you are used to generate these hints.',
      'Strategy',
      10
    );
  }

  // --------------------------------------------------
  // 7. Choose the most relevant observation
  // --------------------------------------------------

  tips.sort((a, b) => b.priority - a.priority);

  const primary = tips[0];

  const secondary = tips.find(
    tip => tip.id !== primary.id &&
      tip.category !== primary.category
  );

  return {
    id: primary.id,
    title: primary.title,
    message: primary.message,
    detail: primary.detail,
    category: primary.category,
    secondary: secondary
      ? `${secondary.title}: ${secondary.message}`
      : null
  };
}
