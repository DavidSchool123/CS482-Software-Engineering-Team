
const TableDao = require('../model/TableDao');
const { leaveTable } = require('./LeaveTableService');
const { runBotTurns } = require('./BotService');
const {
  cancelTurnTimer,
  scheduleTurnTimer
} = require('./PlayerActivityService');

const GRACE_PERIOD_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000;

let intervalId = null;
let checking = false;

/**
 * Remove players who have not sent a heartbeat
 * within the last 60 seconds.
 */
async function checkInactivePlayers() {
  if (checking) return;

  checking = true;

  try {
    const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

    const tables = await TableDao.findTablesWithInactivePlayers(
      cutoff
    );

    for (const table of tables) {
      for (const presence of table.PlayerPresence) {
        if (presence.LastSeenAt > cutoff) continue;

        const playerId = presence.PlayerId;

        const isSeated = table.UserIds.some(
          id => String(id) === playerId
        );

        if (!isSeated) continue;

        try {
          // Recheck inactivity inside the transaction.
          const result = await leaveTable(
            table._id,
            playerId,
            { inactiveBefore: cutoff }
          );

          // Player reconnected before removal.
          if (!result) continue;

          console.log(
            `Inactive player ${playerId} removed from table ${table._id}`
          );

          // Handle game activity after departure.
          if (result.gameId) {
            if (
              result.tableClosed ||
              result.gameStatus !== 'In Progress'
            ) {
              cancelTurnTimer(result.gameId);
            } else {
              try {
                const { game } = await runBotTurns(
                  result.gameId
                );

                if (game.Status === 'In Progress') {
                  scheduleTurnTimer(game);
                }
              } catch (error) {
                console.error(
                  'Unable to resume game after inactivity removal:',
                  error
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `Unable to remove inactive player ${playerId}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error('Player presence check failed:', error);
  } finally {
    checking = false;
  }
}

/**
 * Start checking every 10 seconds.
 */
function startPlayerPresenceScheduler() {
  if (intervalId) return;

  console.log('Player presence scheduler started.');

  intervalId = setInterval(
    checkInactivePlayers,
    CHECK_INTERVAL_MS
  );
}

/**
 * Stop checking during server shutdown.
 */
function stopPlayerPresenceScheduler() {
  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = null;
}

module.exports = {
  startPlayerPresenceScheduler,
  stopPlayerPresenceScheduler
};
