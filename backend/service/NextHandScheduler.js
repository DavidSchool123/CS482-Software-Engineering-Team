
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
    const now = new Date();

    // Find completed hands whose countdown has expired.
    const completedGames = await GameDao.GameModel.find({
      Status: 'Completed',
      NextHandAt: { $lte: now }
    }).select('_id TableId');

    for (const completedGame of completedGames) {
      try {
        // Only advance the game currently linked to its table.
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

        // The service validates the countdown and
        // creates the next hand transactionally.
        const { game } = await GameService.startNextHand(
          table._id
        );

        // Allow bots to take their turns.
        const { game: activeGame } = await runBotTurns(
          game._id
        );

        // Start the timer for the human player's turn.
        if (activeGame.Status === 'In Progress') {
          scheduleTurnTimer(activeGame);
        }

      } catch (error) {
        // If there are insufficient eligible players,
        // the completed hand remains available.
        if (
          error.message ===
          'Not enough players with chips to start another hand'
        ) {
          continue;
        }

        // Another scheduler instance may have already
        // advanced this table.
        if (
          error.message ===
          'Another request has already started the next hand'
        ) {
          continue;
        }

        console.error(
          'Error advancing hand:',
          completedGame._id,
          error
        );
      }
    }

  } catch (error) {
    console.error('Next-hand scheduler error:', error);

  } finally {
    checking = false;
  }
}

function startNextHandScheduler() {
  if (scheduler) return;

  scheduler = setInterval(() => {
    checkCompletedHands().catch(error => {
      console.error('Next-hand scheduler error:', error);
    });
  }, CHECK_INTERVAL_MS);
}

function stopNextHandScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}

module.exports = {
  checkCompletedHands,
  startNextHandScheduler,
  stopNextHandScheduler
};
