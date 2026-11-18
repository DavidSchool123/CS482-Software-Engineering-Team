
const GameDao = require('../model/GameDao');
const { performBettingAction } = require('./BettingService');
const { runBotTurns } = require('./BotService');

// Default human turn timeout: 30 seconds.
const DEFAULT_TURN_TIMEOUT_MS = 30 * 1000;

// Active timers indexed by game ID.
const turnTimers = new Map();

function getTurnTimeoutMs() {
  const configured = Number(process.env.PLAYER_TURN_TIMEOUT_MS);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TURN_TIMEOUT_MS;
}

function cancelTurnTimer(gameId) {
  const key = String(gameId);
  const entry = turnTimers.get(key);

  if (entry) {
    clearTimeout(entry.handle);
    turnTimers.delete(key);
  }
}

function isHumanTurn(game) {
  if (!game) return false;

  const playerId = game.CurrentTurnPlayerId;

  const player = game.Players?.find(
    (item) => String(item.PlayerId) === String(playerId)
  );

  return (
    game.Status === 'In Progress' &&
    !game.BettingRoundComplete &&
    !game.AwaitingNextRound &&
    typeof playerId === 'string' &&
    !playerId.startsWith('bot-') &&
    Boolean(player) &&
    !player.HasFolded
  );
}

/**
 * Schedule an automatic fold when a human player's
 * turn expires.
 *
 * Repeated scheduling for the same turn does not
 * reset its countdown.
 */
function scheduleTurnTimer(game) {
  if (!game?._id) return;

  const gameId = String(game._id);
  const playerId = game.CurrentTurnPlayerId;

  if (!isHumanTurn(game)) {
    cancelTurnTimer(gameId);
    return;
  }

  const existing = turnTimers.get(gameId);

  // Preserve an existing countdown for the same player.
  if (existing && existing.playerId === playerId) {
    return;
  }

  cancelTurnTimer(gameId);

  const deadline = Date.now() + getTurnTimeoutMs();

  const entry = {
    handle: null,
    playerId,
    deadline,
  };

  entry.handle = setTimeout(async () => {
    if (turnTimers.get(gameId) !== entry) return;

    turnTimers.delete(gameId);

    try {
      const currentGame = await GameDao.findById(gameId);

      if (
        !isHumanTurn(currentGame) ||
        currentGame.CurrentTurnPlayerId !== playerId
      ) {
        return;
      }

      await performBettingAction(gameId, playerId, 'fold');

      const { game: updatedGame } = await runBotTurns(gameId);

      scheduleTurnTimer(updatedGame);
    } catch (error) {
      console.error(
        `[GAME ${gameId}] Turn timeout could not be applied:`,
        error
      );
    }
  }, getTurnTimeoutMs());

  turnTimers.set(gameId, entry);
}

/**
 * Returns the deadline of the active human turn.
 * This can be exposed by the game API.
 */
function getTurnDeadline(gameId) {
  const entry = turnTimers.get(String(gameId));

  return entry ? new Date(entry.deadline).toISOString() : null;
}

function clearAllTurnTimers() {
  for (const entry of turnTimers.values()) {
    clearTimeout(entry.handle);
  }

  turnTimers.clear();
}

module.exports = {
  scheduleTurnTimer,
  cancelTurnTimer,
  clearAllTurnTimers,
  getTurnTimeoutMs,
  getTurnDeadline,
};
