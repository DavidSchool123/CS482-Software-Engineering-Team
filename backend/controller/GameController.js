
const mongoose = require('mongoose');
const GameService = require('../service/GameService');
const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const GameActionEvent = require('../model/GameActionEvent');
const UserDao = require('../model/UserDao');
const { performBettingAction } = require('../service/BettingService');
const { runBotTurns } = require('../service/BotService');
const { getVisiblePlayers } = require('../service/GameViewService');
const { scheduleTurnTimer, cancelTurnTimer, getTurnDeadline } = require('../service/PlayerActivityService');

// --------------------------------------------------
// P15 / P42 - Start a new Seven-Card Stud game
// --------------------------------------------------

exports.startGame = async function (req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to start a game'
      });
    }

    const { tableId } = req.params;

    if (!mongoose.isValidObjectId(tableId)) {
      return res.status(400).json({
        error: 'Invalid table ID'
      });
    }

    const table = await TableDao.findById(tableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found'
      });
    }

    const isPlayer = table.UserIds.some(
      id => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table'
      });
    }

    const game = await GameService.startGame(tableId);

    const { game: activeGame, actions: botActions } =
      await runBotTurns(game._id);

    if (activeGame.Status === 'In Progress') {
      scheduleTurnTimer(activeGame);
    }

    return res.status(201).json({
      message: 'Game started successfully',
      gameId: activeGame._id,
      tableId: activeGame.TableId,
      street: activeGame.Street,
      status: activeGame.Status,
      botActions,
      winnerIds: activeGame.WinnerIds || []
    });

  } catch (error) {
    if (error.message === 'Table not found') {
      return res.status(404).json({
        error: error.message
      });
    }

    if (error.message === 'Table is not waiting for a game') {
      return res.status(409).json({
        error: error.message
      });
    }

    if (error.message === 'A game must have between 2 and 6 players') {
      return res.status(400).json({
        error: error.message
      });
    }

    console.error('Error starting game:', error);

    return res.status(500).json({
      error: 'Unable to start game'
    });
  }
};

// --------------------------------------------------
// P37 / P50 / P51 / P53 / View Results
// GET /api/games/:gameId
// --------------------------------------------------

exports.getGame = async function (req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to view a game'
      });
    }

    const { gameId } = req.params;

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID'
      });
    }

    const game = await GameDao.findById(gameId);

    if (!game) {
      return res.status(404).json({
        error: 'Game not found'
      });
    }

    const table = await TableDao.findById(game.TableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found'
      });
    }

    const isPlayer = table.UserIds.some(
      id => id.toString() === userId.toString()
    );

    if (!isPlayer && !table.IsPublic) {
      return res.status(403).json({
        error: 'You cannot observe this private table'
      });
    }

    // ----------------------------------------------
    // P50 / P51 - Winner information
    // ----------------------------------------------

    const winnerIds = game.WinnerIds || [];

    // ----------------------------------------------
    // View Results - Showdown card visibility
    // ----------------------------------------------

    const remainingPlayers = game.Players.filter(
      player => !player.HasFolded
    );

    // Reveal non-folded players at showdown.
    // If everyone else folded, private cards
    // remain hidden.
    const isShowdown =
      game.Status === 'Showdown' ||
      (
        game.Status === 'Completed' &&
        remainingPlayers.length > 1
      );

    const revealPlayerIds = isShowdown
      ? remainingPlayers.map(
          player => String(player.PlayerId)
        )
      : [];

    const players = getVisiblePlayers(
      game.Players,
      userId,
      revealPlayerIds
    );

    // ----------------------------------------------
    // View Results - Player usernames
    // ----------------------------------------------

    // Human players have MongoDB ObjectIds.
    // Bots have IDs such as "bot-1".
    const humanPlayerIds = game.Players
      .map(player => String(player.PlayerId))
      .filter(id => mongoose.isValidObjectId(id));

    // Fetch all human usernames in one query.
    // Only retrieve public identification fields.
    const users = humanPlayerIds.length > 0
      ? await UserDao.find({
          _id: { $in: humanPlayerIds }
        }).select('_id username')
      : [];

    const usernameById = new Map(
      users.map(user => [
        String(user._id),
        user.username
      ])
    );

    // Names for everyone participating in this hand.
    const playerNames = game.Players.map(player => {
      const playerId = String(player.PlayerId);

      let username;

      if (playerId.startsWith('bot-')) {
        username = `Bot ${playerId.split('-').pop()}`;
      } else {
        username =
          usernameById.get(playerId) || 'Unknown player';
      }

      return {
        playerId,
        username
      };
    });

    // ----------------------------------------------
    // P53 - Sitting-out players
    // ----------------------------------------------

    const activePlayerIds = new Set(
      game.Players.map(
        player => String(player.PlayerId)
      )
    );

    const sittingOutPlayerIds = table.UserIds
      .map(id => String(id))
      .filter(id => !activePlayerIds.has(id));

    // Recent, committed actions shared by players and spectators.
    // Limit history and return in chronological order for the UI.
    const actionEvents = (await GameActionEvent.find({ gameId: game._id })
      .sort({ _id: -1 }).limit(40).lean()).reverse().map(event => ({
        id: String(event._id),
        playerId: event.playerId,
        action: event.action,
        amount: event.amount,
        street: event.street,
        at: event.createdAt
      }));

    // ----------------------------------------------
    // Return game state
    // ----------------------------------------------

    return res.status(200).json({
      gameId: game._id,
      tableId: game.TableId,
      street: game.Street,
      status: game.Status,

      // P42 - Ante and bring-in
      pot: game.Pot,
      ante: game.Ante,
      bringIn: game.BringIn,
      bringInPlayerId: game.BringInPlayerId,

      // P16 - Betting
      currentBet: game.CurrentBet,
      currentTurnPlayerId: game.CurrentTurnPlayerId,
      lastRaiseAmount: game.LastRaiseAmount,
      turnDeadline: getTurnDeadline(game._id),
      raiseCount: game.RaiseCount,
      bettingRoundComplete: game.BettingRoundComplete,

      // P50 / P51 - Winners
      winnerIds,

      // View Results - Showdown information
      isShowdown,

      // View Results - Player names
      playerNames,
      actionEvents,

      // P50 / P51 - Winning hands and payouts
      handResults: (game.HandResults || []).map(
        result => ({
          playerId: result.PlayerId,
          amountWon: result.AmountWon,
          handName: result.HandName
        })
      ),

      // P53 - Countdown
      completedAt: game.CompletedAt || null,
      nextHandAt: game.NextHandAt || null,

      // P53 - Detect hand changes
      currentGameId: table.CurrentGameID || null,

      // P53 - Sitting-out players
      sittingOutPlayerIds,

      // P37 - Cards with privacy enforced
      players,

      // P52 / P53 - Table chip stacks
      playerStacks: table.PlayerStacks.map(
        stack => ({
          playerId: stack.PlayerId,
          chips: stack.Chips
        })
      )
    });

  } catch (error) {
    console.error('Error retrieving game:', error);

    return res.status(500).json({
      error: 'Unable to retrieve game'
    });
  }
};

// --------------------------------------------------
// P16 - Player Bets, Raises, Checks, and Folds
// POST /api/games/:gameId/action
// --------------------------------------------------

exports.performBettingAction = async function (req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to perform a betting action'
      });
    }

    const { gameId } = req.params;
    const { action } = req.body || {};

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID'
      });
    }

    const validActions = [
      'fold',
      'check',
      'call',
      'bet',
      'raise'
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid betting action'
      });
    }

    const game = await GameDao.findById(gameId);

    if (!game) {
      return res.status(404).json({
        error: 'Game not found'
      });
    }

    const table = await TableDao.findById(game.TableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found'
      });
    }

    const isPlayer = table.UserIds.some(
      id => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table'
      });
    }

    // BettingService validates the action and
    // updates the game transactionally.
    await performBettingAction(
      gameId,
      userId.toString(),
      action
    );

    // The player has acted, so their previous turn is over.
    cancelTurnTimer(gameId);

    // Continue any bot turns.
    const { game: activeGame, actions: botActions } =
      await runBotTurns(gameId);

    // Start the next human turn timer.
    if (activeGame.Status === 'In Progress') {
      scheduleTurnTimer(activeGame);
    }

    return res.status(200).json({
      message: 'Betting action completed successfully',
      action,
      gameId: activeGame._id,
      status: activeGame.Status,
      pot: activeGame.Pot,
      currentBet: activeGame.CurrentBet,
      currentTurnPlayerId: activeGame.CurrentTurnPlayerId,
      turnDeadline: getTurnDeadline(activeGame._id),
      bettingRoundComplete: activeGame.BettingRoundComplete,
      raiseCount: activeGame.RaiseCount,
      botActions,
      winnerIds: activeGame.WinnerIds || [],

      // View Results / P53
      handResults: (activeGame.HandResults || []).map(
        result => ({
          playerId: result.PlayerId,
          amountWon: result.AmountWon,
          handName: result.HandName
        })
      ),
      completedAt: activeGame.CompletedAt || null,
      nextHandAt: activeGame.NextHandAt || null
    });

  } catch (error) {
    const badRequestErrors = [
      'Invalid betting action',
      'Cannot check when facing a bet',
      'Nothing to call',
      'Cannot bet when a bet already exists',
      'Cannot raise without an existing bet',
      'Insufficient chips',
      'Player cannot act'
    ];

    const conflictErrors = [
      'Game is not in progress',
      'Betting round is complete',
      'It is not this player’s turn',
      'Maximum raises reached'
    ];

    if (badRequestErrors.includes(error.message)) {
      return res.status(400).json({
        error: error.message
      });
    }

    if (conflictErrors.includes(error.message)) {
      return res.status(409).json({
        error: error.message
      });
    }

    if (
      error.message === 'Game not found' ||
      error.message === 'Table not found'
    ) {
      return res.status(404).json({
        error: error.message
      });
    }

    console.error('Error performing betting action:', error);

    return res.status(500).json({
      error: 'Unable to perform betting action'
    });
  }
};

// --------------------------------------------------
// P53 - Start the next hand
// --------------------------------------------------

// Intended for trusted backend use only.
// Do not register as an unrestricted public route.
exports.startNextHand = async function (req, res) {
  try {
    const { tableId } = req.params;

    if (!mongoose.isValidObjectId(tableId)) {
      return res.status(400).json({
        error: 'Invalid table ID'
      });
    }

    const result = await GameService.startNextHand(tableId);

    // Run bot turns for the new hand.
    const { game: activeGame, actions: botActions } =
      await runBotTurns(result.game._id);

    // Schedule the next human player's timer.
    if (activeGame.Status === 'In Progress') {
      scheduleTurnTimer(activeGame);
    }

    return res.status(201).json({
      message: 'Next hand started successfully',
      gameId: activeGame._id,
      tableId: activeGame.TableId,
      street: activeGame.Street,
      status: activeGame.Status,
      sittingOutPlayerIds: result.sittingOutPlayerIds,
      botActions,
      winnerIds: activeGame.WinnerIds || []
    });

  } catch (error) {
    const conflictErrors = [
      'Table is not in progress',
      'Table has no current game',
      'Previous hand is not completed',
      'Next hand countdown has not finished',
      'Not enough players with chips to start another hand',
      'Another request has already started the next hand'
    ];

    if (conflictErrors.includes(error.message)) {
      return res.status(409).json({
        error: error.message
      });
    }

    if (error.message === 'Table not found') {
      return res.status(404).json({
        error: error.message
      });
    }

    console.error('Error starting next hand:', error);

    return res.status(500).json({
      error: 'Unable to start next hand'
    });
  }
};
