
/**
 * P21 — Context-aware Seven-Card Stud tips.
 *
 * Acts as both a poker coach and a beginner-friendly tutor.
 *
 * Analyzes the privacy-filtered game state to provide:
 * - Hand-strength observations
 * - Drawing-hand guidance
 * - Opponent awareness
 * - Betting recommendations
 * - Pot and stack awareness
 * - Street-specific poker education
 *
 * Does not modify game state or perform betting actions.
 * Never assumes knowledge of opponents' hidden cards.
 */

// ---------------------------------------------------------------
// Card normalization
// ---------------------------------------------------------------

const FACE_RANKS = {
  A: 14, ACE: 14,
  K: 13, KING: 13,
  Q: 12, QUEEN: 12,
  J: 11, JACK: 11,
  T: 10, TEN: 10
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

  return {
    rank,
    suit,
    faceUp: card.faceUp === true
  };
}

function countBy(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return counts;
}

// ---------------------------------------------------------------
// Straight analysis
// ---------------------------------------------------------------

function getStraightWindows(ranks) {
  const unique = new Set(ranks);

  // An ace can be high or low.
  if (unique.has(14)) unique.add(1);

  const windows = [];

  for (let start = 1; start <= 10; start++) {
    const sequence = Array.from(
      { length: 5 },
      (_, index) => start + index
    );

    const present = sequence.filter(rank => unique.has(rank));

    const missing = sequence
      .filter(rank => !unique.has(rank))
      .map(rank => rank === 1 ? 14 : rank);

    windows.push({
      sequence,
      present,
      missing
    });
  }

  return windows;
}

function hasStraight(ranks) {
  return getStraightWindows(ranks)
    .some(window => window.missing.length === 0);
}

/**
 * Returns missing ranks for potential one-card straight draws.
 * The window must contain four distinct ranks already held.
 */
function getStraightDraws(ranks) {
  const missing = new Set();

  for (const window of getStraightWindows(ranks)) {
    if (window.present.length === 4) {
      missing.add(window.missing[0]);
    }
  }

  return [...missing];
}

// ---------------------------------------------------------------
// Hand evaluation
// ---------------------------------------------------------------

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

  if (frequencies[0] >= 3) {
    return { strength: 4, name: 'Three of a kind' };
  }

  if (frequencies.filter(count => count >= 2).length >= 2) {
    return { strength: 3, name: 'Two pair' };
  }

  if (frequencies[0] >= 2) {
    const pairRank = [...rankCounts.entries()]
      .find(([, count]) => count >= 2)?.[0];

    return {
      strength: 2,
      name: pairRank >= 11 ? 'High pair' : 'Pair'
    };
  }

  return { strength: 1, name: 'High card' };
}

// ---------------------------------------------------------------
// Tip helpers
// ---------------------------------------------------------------

function makeTip(id, title, message, detail, category, priority) {
  return {
    id,
    title,
    message,
    detail,
    category,
    priority
  };
}

function safeNumber(value) {
  if (value == null || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function formatHandName(hand) {
  return hand.name.toLowerCase();
}

// ---------------------------------------------------------------
// Visible and dead-card analysis
// ---------------------------------------------------------------

function getExposedCards(players, myPlayerId) {
  return players
    .filter(player => String(player.playerId) !== String(myPlayerId))
    .flatMap(player =>
      (player.cards || [])
        .filter(card => card?.faceUp === true)
        .map(normalizeCard)
        .filter(Boolean)
    );
}

function countExposedSuit(cards, suit) {
  return cards.filter(card => card.suit === suit).length;
}

function countExposedRank(cards, rank) {
  return cards.filter(card => card.rank === rank).length;
}

function getFlushDraw(cards, exposedCards) {
  const suitCounts = countBy(cards.map(card => card.suit));

  const flushDraw = [...suitCounts.entries()]
    .find(([, count]) => count === 4);

  if (!flushDraw) return null;

  const [suit] = flushDraw;

  const exposedMatching = countExposedSuit(exposedCards, suit);

  const unseenMatching = Math.max(
    0,
    13 - 4 - exposedMatching
  );

  return {
    suit,
    exposedMatching,
    unseenMatching
  };
}

function getStraightDraw(cards, exposedCards) {
  const neededRanks = getStraightDraws(
    cards.map(card => card.rank)
  );

  if (neededRanks.length === 0) return null;

  const exposedNeeded = exposedCards.filter(
    card => neededRanks.includes(card.rank)
  ).length;

  let unseenHelpful = 0;

  for (const rank of neededRanks) {
    const held = cards.filter(card => card.rank === rank).length;
    const exposed = countExposedRank(exposedCards, rank);

    unseenHelpful += Math.max(0, 4 - held - exposed);
  }

  return {
    neededRanks,
    exposedNeeded,
    unseenHelpful
  };
}

// ---------------------------------------------------------------
// Opponent analysis
// ---------------------------------------------------------------

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

    const showingTrips = rankCounts.some(count => count >= 3);
    const showingPair = rankCounts.some(count => count >= 2);
    const showingFourSuit = suitCounts.some(count => count >= 4);

    const straightPotential = getStraightWindows(ranks)
      .some(window => window.present.length >= 4);

    if (showingTrips) {
      threats.push({
        type: 'trips',
        priority: 80,
        title: 'An opponent is showing three of a kind',
        message: 'Three exposed cards share a rank. That opponent already has at least three of a kind.'
      });
    } else if (showingPair) {
      threats.push({
        type: 'pair',
        priority: 50,
        title: 'An opponent is showing a pair',
        message: 'An opponent has two exposed cards of the same rank. Their hidden cards could make the hand stronger.'
      });
    }

    if (showingFourSuit) {
      threats.push({
        type: 'flush',
        priority: 75,
        title: 'An opponent is showing a possible flush',
        message: 'Four exposed cards share a suit. A hidden card could already complete their flush.'
      });
    }

    if (straightPotential) {
      threats.push({
        type: 'straight',
        priority: 70,
        title: 'An opponent is showing straight potential',
        message: 'Four exposed ranks could form part of a straight. Their hidden cards may complete it.'
      });
    }
  }

  return threats;
}

// ---------------------------------------------------------------
// Betting and pot analysis
// ---------------------------------------------------------------

function getBettingContext({
  potSize,
  amountToCall,
  myChips,
  raiseLimitReached
}) {
  const pot = safeNumber(potSize);
  const callCost = safeNumber(amountToCall) ?? 0;
  const stack = safeNumber(myChips);

  const canAffordCall = stack !== null && stack >= callCost;

  const callFraction = stack !== null && stack > 0
    ? callCost / stack
    : null;

  const canConsiderRaise =
    !raiseLimitReached &&
    stack !== null &&
    stack > callCost;

  return {
    pot,
    callCost,
    stack,
    canAffordCall,
    callFraction,
    canConsiderRaise
  };
}

/**
 * Pot odds require the backend pot to include all currently
 * committed chips but exclude the player's pending call.
 *
 * We do not display an exact percentage until that accounting
 * convention has been verified.
 */
function getPotContextText(pot, callCost) {
  if (pot === null) {
    return `Calling costs ${callCost} chips.`;
  }

  return `Calling costs ${callCost} chips. The displayed pot contains ${pot} chips.`;
}

// ---------------------------------------------------------------
// Main strategic tip engine
// ---------------------------------------------------------------

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
  potSize = null,
  amountToCall = 0,
  myChips = null,
  isMyTurn = false,
  canAct = false,
  raiseLimitReached = false
} = {}) {
  if (!game || game.status !== 'In Progress') return null;

  const players = Array.isArray(game.players) ? game.players : [];

  const me = players.find(
    player => player.isCurrentPlayer
  );

  if (!me || me.hasFolded) return null;

  const cards = (me.cards || [])
    .map(normalizeCard)
    .filter(Boolean);

  if (cards.length < 3) return null;

  const opponents = players.filter(
    player => !player.isCurrentPlayer && !player.hasFolded
  );

  const exposedOpponentCards = getExposedCards(
    players,
    me.playerId
  );

  const street = Number(game.street);
  const hand = evaluateHand(cards);
  const tips = [];

  const addTip = (...args) => tips.push(makeTip(...args));

  const cardsRemaining =
    Number.isInteger(street) && street >= 3 && street <= 7
      ? 7 - street
      : 0;

  const canDraw = cardsRemaining > 0;

  const betting = getBettingContext({
    potSize: potSize ?? game.pot,
    amountToCall,
    myChips,
    raiseLimitReached
  });

  const {
    pot,
    callCost,
    stack,
    canAffordCall,
    callFraction,
    canConsiderRaise
  } = betting;

  const myTurn = isMyTurn && canAct;

  // --------------------------------------------------
  // 1. Made-hand observations
  // --------------------------------------------------

  if (hand.strength >= 5) {
    addTip(
      `made-${hand.name.toLowerCase().replaceAll(' ', '-')}`,
      `You have a ${formatHandName(hand)}!`,
      `Your cards currently make a ${formatHandName(hand)}. This is a strong made hand, but compare it with opponents' exposed cards before betting aggressively.`,
      'A made hand already forms a recognized poker combination. Your opponents may still hold hidden cards that make a stronger hand.',
      'Your hand',
      hand.strength >= 7 ? 90 : 78
    );
  } else if (hand.strength >= 2) {
    addTip(
      `made-${hand.name.toLowerCase().replaceAll(' ', '-')}`,
      `You have ${hand.name === 'Two pair' ? 'two pair' : hand.name === 'High pair' ? 'a high pair' : `a ${formatHandName(hand)}`}`,
      `Your current hand is ${formatHandName(hand)}. ${canDraw ? `You still have ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'} to receive.` : 'Your hand is complete.'}`,
      'Pairs and other made hands can win, but their strength depends on what opponents hold. Look for improvements and visible threats.',
      'Your hand',
      hand.strength >= 4 ? 72 : hand.strength === 3 ? 60 : 40
    );
  }

  // --------------------------------------------------
  // 2. Flush draws and dead cards
  // --------------------------------------------------

  const flushDraw = getFlushDraw(cards, exposedOpponentCards);

  if (canDraw && flushDraw && hand.strength < 6) {
    const {
      suit,
      exposedMatching,
      unseenMatching
    } = flushDraw;

    addTip(
      `flush-draw-${suit}`,
      'You are one card away from a flush',
      `You have four ${suit}. ${exposedMatching} matching card${exposedMatching === 1 ? ' is' : 's are'} exposed, leaving ${unseenMatching} unaccounted for. You have ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'} left to receive.`,
      'A flush needs five cards of the same suit. Exposed matching cards are unavailable to you. Unseen cards may still be hidden in opponents’ hands, so they are not guaranteed outs.',
      'Drawing hand',
      82
    );
  }

  // --------------------------------------------------
  // 3. Straight draws and dead cards
  // --------------------------------------------------

  const straightDraw = getStraightDraw(
    cards,
    exposedOpponentCards
  );

  if (canDraw && straightDraw && hand.strength < 5) {
    const {
      neededRanks,
      exposedNeeded,
      unseenHelpful
    } = straightDraw;

    addTip(
      'straight-draw',
      'You are drawing to a straight',
      `Your cards are one rank away from a straight. ${exposedNeeded} potentially helpful card${exposedNeeded === 1 ? ' is' : 's are'} already exposed, leaving ${unseenHelpful} unaccounted for.`,
      `A straight requires five consecutive ranks. You have ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'} left to receive. Aces can be high or low, but cannot wrap around.`,
      'Drawing hand',
      74
    );
  }

  // --------------------------------------------------
  // 4. Opponent observations
  // --------------------------------------------------

  const opponentThreats = getOpponentThreats(opponents);

  for (const threat of opponentThreats) {
    addTip(
      `opponent-${threat.type}`,
      threat.title,
      threat.message,
      'Only exposed cards are considered. Opponents may have stronger hidden cards than their visible cards suggest.',
      'Opponent awareness',
      threat.priority
    );
  }

  const dangerousOpponent = opponentThreats.some(
    threat => threat.priority >= 70
  );

  // --------------------------------------------------
  // 5. Betting strategy — facing a bet
  // --------------------------------------------------

  if (myTurn && callCost > 0) {
    if (!canAffordCall) {
      addTip(
        'insufficient-stack',
        'You cannot afford the full call',
        `Calling costs ${callCost} chips, but you have ${stack ?? 'an unknown number of'} chips. Check which betting actions are enabled.`,
        'The game controls determine which actions are legal. This assistant does not override betting rules or automatically place bets.',
        'Betting strategy',
        110
      );
    } else if (
      callFraction !== null &&
      callFraction >= 0.4 &&
      hand.strength <= 2
    ) {
      addTip(
        'consider-folding',
        'Consider folding this expensive hand',
        `You currently have ${formatHandName(hand)}, and calling would cost ${Math.round(callFraction * 100)}% of your remaining chips. ${getPotContextText(pot, callCost)} Folding may help protect your stack.`,
        'A weak hand can improve, but continuing at a high cost may not be worthwhile. Compare the price of calling with your chances of improving and the strength of exposed opposing cards.',
        'Betting strategy',
        105
      );
    } else if (hand.strength >= 5 && !dangerousOpponent) {
      addTip(
        'strong-hand-call',
        canConsiderRaise
          ? 'Calling or raising may be worth considering'
          : 'Calling may be worth considering',
        `You have a ${formatHandName(hand)}. ${getPotContextText(pot, callCost)} ${canConsiderRaise ? 'A raise might also be an option if the fixed-limit betting rules allow it.' : 'Consider the cost before committing more chips.'}`,
        'Strong made hands can justify continuing, but they are not unbeatable. Opponents may hold stronger hidden cards. Only use actions enabled by the game.',
        'Betting strategy',
        100
      );
    } else if (canDraw && (flushDraw || straightDraw)) {
      addTip(
        'drawing-hand-call',
        'Consider the cost of chasing your draw',
        `${getPotContextText(pot, callCost)} You have ${cardsRemaining} card${cardsRemaining === 1 ? '' : 's'} left to receive, and some helpful cards may already be exposed.`,
        'Drawing hands can improve, but a draw is not a guaranteed winning hand. Consider how many helpful cards remain unaccounted for and how expensive it is to continue.',
        'Betting strategy',
        96
      );
    } else {
      addTip(
        'facing-bet',
        dangerousOpponent
          ? 'Be cautious about calling'
          : 'Decide whether this call is worthwhile',
        `${getPotContextText(pot, callCost)} You currently have ${formatHandName(hand)}${dangerousOpponent ? ', and an opponent is showing a potentially strong hand' : ''}.`,
        'Calling matches the outstanding bet and keeps you in the hand. Folding gives up the hand without committing more chips. Compare your hand, the pot, and opponents’ exposed cards.',
        'Betting strategy',
        92
      );
    }
  }

  // --------------------------------------------------
  // 6. Betting strategy — no outstanding bet
  // --------------------------------------------------

  if (myTurn && callCost === 0) {
    if (hand.strength >= 5 && stack !== null && stack > 0) {
      addTip(
        'strong-hand-bet',
        'A bet may be worth considering',
        `You have a ${formatHandName(hand)}, and there is no outstanding bet to match. Betting may build the pot, while checking costs nothing.`,
        'Betting with a strong hand can gain value from weaker opponents. However, you should only bet if the game allows it and your stack can cover the required amount.',
        'Betting strategy',
        98
      );
    } else {
      addTip(
        'check-available',
        'Checking is a free option',
        `There is no outstanding bet to match. You currently have ${formatHandName(hand)}, and checking lets you remain in the hand without adding chips.`,
        'Checking passes the action without committing more chips. You may also be able to bet, depending on the betting rules and your remaining stack.',
        'Betting strategy',
        92
      );
    }
  }

  // --------------------------------------------------
  // 7. Street-specific poker education
  // --------------------------------------------------

  if (street === 3) {
    addTip(
      'third-street',
      'Third street: evaluate your starting hand',
      'You have three cards. Consider your starting hand and compare the exposed cards before committing more chips.',
      'Third street begins the first betting round in Seven-Card Stud. The bring-in is a forced opening wager.',
      'Poker lesson',
      30
    );
  }

  if (street === 4) {
    addTip(
      'fourth-street',
      'Fourth street: watch the new exposed cards',
      'A fourth card has been dealt. Look for improving hands and changes in opponents’ visible cards.',
      'Fourth street gives you more information about your opponents while leaving three cards still to come.',
      'Poker lesson',
      30
    );
  }

  if (street === 5) {
    addTip(
      'fifth-street',
      'Fifth street: reassess your commitment',
      'You now have five cards. Consider whether your hand is strong enough to continue as betting becomes more expensive.',
      'In fixed-limit Seven-Card Stud, the betting increment typically increases on fifth street. Your game uses its configured betting limits.',
      'Poker lesson',
      35
    );
  }

  if (street === 6) {
    addTip(
      'sixth-street',
      'Sixth street: one card remains',
      'Only one card remains to be dealt. Unfinished draws have fewer opportunities to improve.',
      'With just one card left, exposed cards and the cost of continuing become especially important.',
      'Poker lesson',
      40
    );
  }

  if (street === 7) {
    addTip(
      'seventh-street',
      'Seventh street: your hand is complete',
      'All seven cards have been dealt. No additional cards will improve your hand.',
      'Compare your best five-card hand with opponents’ exposed cards. The final card in Seven-Card Stud is normally dealt face down.',
      'Poker lesson',
      58
    );
  }

  // --------------------------------------------------
  // 8. General fallback
  // --------------------------------------------------

  if (tips.length === 0) {
    addTip(
      'general',
      'Watch the cards and the betting',
      'Consider your hand, your opponents’ exposed cards, and the cost of continuing.',
      'Poker Tips offers suggestions, not guaranteed winning moves. It only uses information available to the current player.',
      'Poker lesson',
      10
    );
  }

  // --------------------------------------------------
  // 9. Choose the most relevant observation
  // --------------------------------------------------

  tips.sort((a, b) => b.priority - a.priority);

  const primary = tips[0];

  const secondary = tips.find(
    tip =>
      tip.id !== primary.id &&
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
