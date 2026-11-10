
const GameDao = require('../model/GameDao');
const { performBettingAction } = require('./BettingService');
const { runBotTurns } = require('./BotService');

// Default turn timeout: 60 seconds.
// Can be overridden using PLAYER_TURN_TIMEOUT_MS in the environment.
const DEFAULT_TURN_TIMEOUT_MS = 60 * 1000;

// Stores active timers, indexed by game ID.
const turnTimers = new Map();

/**
 * Returns the configured player turn timeout.
 */
function getTurnTimeoutMs() {
  const configuredTimeout = Number(process.env.PLAYER_TURN_TIMEOUT_MS);

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TURN_TIMEOUT_MS;
}

/**
 * Cancels an existing timer for a game.
 */
function cancelTurnTimer(gameId) {
  const key = gameId.toString();
  const timer = turnTimers.get(key);

  if (timer) {
    clearTimeout(timer.handle);
    turnTimers.delete(key);
  }
}

/**
 * Schedules an automatic fold for the current human player.
 *
 * Bot turns are excluded because BotService handles them.
 * The database is checked again when the timer expires to
 * prevent outdated timers from affecting subsequent turns.
 */
function scheduleTurnTimer(game) {
  if (!game || !game._id) return;

  const gameId = game._id.toString();

  // Remove any previous timer before scheduling another.
  cancelTurnTimer(gameId);

  const playerId = game.CurrentTurnPlayerId;

  const player = game.Players?.find(
    (item) => item.PlayerId === playerId
  );

  // Do not schedule timers for invalid or inactive turns.
  if (
    game.Status !== 'In Progress' ||
    game.BettingRoundComplete ||
    game.AwaitingNextRound ||
    typeof playerId !== 'string' ||
    playerId.startsWith('bot-') ||
    !player ||
    player.HasFolded
  ) {
    return;
  }

  // Each timer gets a unique entry to prevent stale callbacks.
  const entry = { handle: null };

  entry.handle = setTimeout(async () => {
    if (turnTimers.get(gameId) !== entry) return;

    turnTimers.delete(gameId);

    try {
      // Retrieve the latest game state before applying the fold.
      const currentGame = await GameDao.findById(gameId);

      if (
        !currentGame ||
        currentGame.Status !== 'In Progress' ||
        currentGame.CurrentTurnPlayerId !== playerId ||
        currentGame.BettingRoundComplete ||
        currentGame.AwaitingNextRound
      ) {
        return;
      }

      // Automatically fold the inactive player.
      await performBettingAction(gameId, playerId, 'fold');

      // Allow bots to complete any subsequent turns.
      const { game: updatedGame } = await runBotTurns(gameId);

      // Schedule the next human player's timer.
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
 * Clears every active turn timer.
 * Useful during server shutdown and automated testing.
 */
function clearAllTurnTimers() {
  for (const timer of turnTimers.values()) {
    clearTimeout(timer.handle);
  }

  turnTimers.clear();
}

module.exports = {
  scheduleTurnTimer,
  cancelTurnTimer,
  clearAllTurnTimers,
  getTurnTimeoutMs
};
