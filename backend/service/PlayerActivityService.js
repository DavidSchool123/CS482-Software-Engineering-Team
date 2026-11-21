
const GameDao = require('../model/GameDao');
const { performBettingAction } = require('./BettingService');
const { runBotTurns } = require('./BotService');

const DEFAULT_TURN_TIMEOUT_MS = 30 * 1000;

// Active timers, indexed by game ID.
const turnTimers = new Map();

// Tracks timer generations so cancelled callbacks
// cannot continue after a newer timer is created.
const timerVersions = new Map();

function getTurnTimeoutMs() {
  const configured = Number(process.env.PLAYER_TURN_TIMEOUT_MS);

  return Number.isFinite(configured) && configured >= 1000
    ? configured
    : DEFAULT_TURN_TIMEOUT_MS;
}

function nextTimerVersion(gameId) {
  const key = String(gameId);
  const version = (timerVersions.get(key) || 0) + 1;

  timerVersions.set(key, version);
  return version;
}

function cancelTurnTimer(gameId) {
  const key = String(gameId);
  const entry = turnTimers.get(key);

  // Invalidate any callback that has already started.
  nextTimerVersion(key);

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

function getTurnIdentity(game) {
  return [
    String(game._id),
    String(game.Street),
    String(game.CurrentTurnPlayerId),
    String(game.CurrentBet),
    ...game.Players.map((player) => [
      player.PlayerId,
      player.HasFolded,
      player.HasActed,
      player.RoundContribution,
    ].join(':')),
  ].join('|');
}

/**
 * Schedule a human turn timeout.
 *
 * A repeated schedule for the same game state
 * preserves the existing deadline.
 *
 * A different turn state receives a new timer.
 */
function scheduleTurnTimer(game) {
  if (!game?._id) return;

  const gameId = String(game._id);

  if (!isHumanTurn(game)) {
    cancelTurnTimer(gameId);
    return;
  }

  const playerId = String(game.CurrentTurnPlayerId);
  const turnIdentity = getTurnIdentity(game);

  const existing = turnTimers.get(gameId);

  if (
    existing &&
    existing.playerId === playerId &&
    existing.turnIdentity === turnIdentity
  ) {
    return;
  }

  cancelTurnTimer(gameId);

  const timeoutMs = getTurnTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  const version = nextTimerVersion(gameId);

  const entry = {
    handle: null,
    playerId,
    turnIdentity,
    deadline,
    version,
  };

  console.log(
    `[TURN TIMER] Started | Game: ${gameId}` +
    ` | Player: ${playerId}` +
    ` | Street: ${game.Street}` +
    ` | Duration: ${timeoutMs}ms` +
    ` | Deadline: ${new Date(deadline).toISOString()}`
  );

  entry.handle = setTimeout(async () => {
    if (
      turnTimers.get(gameId) !== entry ||
      timerVersions.get(gameId) !== version
    ) {
      return;
    }

    try {
      const currentGame = await GameDao.findById(gameId);

      // Recheck after the asynchronous database read.
      if (
        turnTimers.get(gameId) !== entry ||
        timerVersions.get(gameId) !== version
      ) {
        return;
      }

      if (
        !isHumanTurn(currentGame) ||
        String(currentGame.CurrentTurnPlayerId) !== playerId ||
        getTurnIdentity(currentGame) !== turnIdentity
      ) {
        console.log(
          `[TURN TIMER] Skipped stale timeout | Game: ${gameId}`
        );

        if (turnTimers.get(gameId) === entry) {
          turnTimers.delete(gameId);
        }

        return;
      }

      // Guard against an early callback.
      const remainingMs = deadline - Date.now();

      if (remainingMs > 0) {
        entry.handle = setTimeout(
          () => scheduleTurnTimer(currentGame),
          remainingMs
        );
        return;
      }

      console.log(
        `[TURN TIMER] Expired | Game: ${gameId}` +
        ` | Player: ${playerId}` +
        ` | Street: ${currentGame.Street}` +
        ` | Deadline: ${new Date(deadline).toISOString()}`
      );

      // Remove this timer before processing the fold.
      turnTimers.delete(gameId);

      await performBettingAction(gameId, playerId, 'fold');

      console.log(
        `[TURN TIMER] Auto-fold completed | Game: ${gameId}` +
        ` | Player: ${playerId}`
      );

      const { game: updatedGame } = await runBotTurns(gameId);

      scheduleTurnTimer(updatedGame);
    } catch (error) {
      console.error(
        `[GAME ${gameId}] Turn timeout could not be applied:`,
        error
      );
    }
  }, timeoutMs);

  turnTimers.set(gameId, entry);
}

/**
 * Return the deadline for the active human turn.
 */
function getTurnDeadline(gameId) {
  const entry = turnTimers.get(String(gameId));

  return entry
    ? new Date(entry.deadline).toISOString()
    : null;
}

function clearAllTurnTimers() {
  for (const entry of turnTimers.values()) {
    clearTimeout(entry.handle);
  }

  turnTimers.clear();
  timerVersions.clear();
}

module.exports = {
  scheduleTurnTimer,
  cancelTurnTimer,
  clearAllTurnTimers,
  getTurnTimeoutMs,
  getTurnDeadline,
};
