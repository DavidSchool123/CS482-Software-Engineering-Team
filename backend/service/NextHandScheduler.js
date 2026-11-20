
const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');
const GameService = require('./GameService');
const { runBotTurns } = require('./BotService');
const { scheduleTurnTimer } = require('./PlayerActivityService');

const CHECK_INTERVAL_MS = 1000;

let scheduler = null;
let checking = false;

async function checkCompletedHands() {
  if (checking) return;

  checking = true;

  try {
    const startTime = Date.now();
    const now = new Date();

    // Only consider tables that are currently running.
    const activeTables = await TableDao.TableModel.find({
      Status: 'In Progress',
      CurrentGameID: { $ne: null }
    }).select('_id CurrentGameID');

    if (activeTables.length === 0) {
      return;
    }

    // Check only the current games of active tables.
    const currentGameIds = activeTables.map(
      table => table.CurrentGameID
    );

    const completedGames = await GameDao.GameModel.find({
      _id: { $in: currentGameIds },
      Status: 'Completed',
      NextHandAt: { $lte: now }
    }).select('_id TableId NextHandAt');

    for (const completedGame of completedGames) {
      try {
        // Confirm that the table still references this game.
        const table = await TableDao.findById(
          completedGame.TableId
        );

        if (
          !table ||
          table.Status !== 'In Progress' ||
          String(table.CurrentGameID) !==
            String(completedGame._id)
        ) {
          continue;
        }

        const handStartTime = Date.now();

        console.log(
          '[Next Hand] Countdown expired:',
          completedGame._id.toString()
        );

        // Create the next hand transactionally.
        const { game } = await GameService.startNextHand(
          table._id
        );

        console.log(
          '[Next Hand] New game created:',
          game._id.toString(),
          '| Time:',
          `${Date.now() - handStartTime}ms`
        );

        // Allow bots to act until a human turn or hand completion.
        const botStartTime = Date.now();

        const { game: activeGame } = await runBotTurns(
          game._id
        );

        console.log(
          '[Next Hand] Bot processing completed:',
          `${Date.now() - botStartTime}ms`
        );

        // Schedule the next human turn.
        if (activeGame.Status === 'In Progress') {
          scheduleTurnTimer(activeGame);
        }

        console.log(
          '[Next Hand] Total hand processing:',
          `${Date.now() - handStartTime}ms`
        );

      } catch (error) {
        if (
          error.message ===
          'Not enough players with chips to start another hand'
        ) {
          continue;
        }

        if (
          error.message ===
          'Another request has already started the next hand'
        ) {
          continue;
        }

        console.error(
          '[Next Hand] Error advancing game:',
          completedGame._id,
          error
        );
      }
    }

    // Log only when there was work to process.
    if (completedGames.length > 0) {
      console.log(
        '[SCHEDULER] Total cycle time:',
        `${Date.now() - startTime}ms`
      );
    }

  } catch (error) {
    console.error(
      '[SCHEDULER] Error:',
      error
    );
  } finally {
    checking = false;
  }
}

function startNextHandScheduler() {
  if (scheduler) return;

  scheduler = setInterval(() => {
    checkCompletedHands().catch(error => {
      console.error('[SCHEDULER] Error:', error);
    });
  }, CHECK_INTERVAL_MS);

  console.log('[SCHEDULER] Started');
}

function stopNextHandScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }

  console.log('[SCHEDULER] Stopped');
}

module.exports = {
  checkCompletedHands,
  startNextHandScheduler,
  stopNextHandScheduler
};
