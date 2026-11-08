
const mongoose = require('mongoose');
const GameService = require('../service/GameService');
const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
const { performBettingAction } = require('../service/BettingService');
const { runBotTurns } = require('../service/BotService');
const { getVisiblePlayers } = require('../service/GameViewService');

// Start a new Seven-Card Stud game
exports.startGame = async function (req, res) {
  try {
    // Check if the user is logged in
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to start a game',
      });
    }

    const { tableId } = req.params;

    // Validate the table ID
    if (!mongoose.isValidObjectId(tableId)) {
      return res.status(400).json({
        error: 'Invalid table ID',
      });
    }

    // Find the table
    const table = await TableDao.findById(tableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found',
      });
    }

    // Verify that the logged-in user belongs to this table
    const isPlayer = table.UserIds.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table',
      });
    }

    // Start the game
    const game = await GameService.startGame(tableId);
    const { game: activeGame, actions: botActions } =
      await runBotTurns(game._id);

    return res.status(201).json({
      message: 'Game started successfully',
      gameId: activeGame._id,
      tableId: activeGame.TableId,
      street: activeGame.Street,
      status: activeGame.Status,
      botActions,
      winnerIds: activeGame.WinnerIds || [],
    });
  } catch (error) {
    if (error.message === 'Table not found') {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error.message === 'Table is not waiting for a game') {
      return res.status(409).json({
        error: error.message,
      });
    }

    if (error.message === 'A game must have between 2 and 6 players') {
      return res.status(400).json({
        error: error.message,
      });
    }

    console.error('Error starting game:', error);

    return res.status(500).json({
      error: 'Unable to start game',
    });
  }
};

// Retrieve game state with private cards protected
exports.getGame = async function (req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to view a game',
      });
    }

    const { gameId } = req.params;

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID',
      });
    }

    // Find the game
    const game = await GameDao.findById(gameId);

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
      });
    }

    // Find the table associated with the game
    const table = await TableDao.findById(game.TableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found',
      });
    }

    // Only seated players can retrieve game information
    const isPlayer = table.UserIds.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table',
      });
    }

    // Show the viewer's cards while protecting opponents' private cards
    const winnerIds = game.WinnerIds || [];
    const players = getVisiblePlayers(
      game.Players,
      userId,
      winnerIds
    );

    return res.status(200).json({
      gameId: game._id,
      tableId: game.TableId,
      street: game.Street,
      status: game.Status,

      // P42: Ante and bring-in information
      pot: game.Pot,
      ante: game.Ante,
      bringIn: game.BringIn,
      bringInPlayerId: game.BringInPlayerId,

      // Betting information
      currentBet: game.CurrentBet,
      currentTurnPlayerId: game.CurrentTurnPlayerId,
      lastRaiseAmount: game.LastRaiseAmount,
      raiseCount: game.RaiseCount,
      bettingRoundComplete: game.BettingRoundComplete,
      winnerIds,

      // Player cards with private cards protected
      players,

      // Remaining chips at the table for each player
        playerStacks: table.PlayerStacks.map((stack) => ({
          playerId: stack.PlayerId,
          chips: stack.Chips
        }))
    });
  } catch (error) {
    console.error('Error retrieving game:', error);

    return res.status(500).json({
      error: 'Unable to retrieve game',
    });
  }
};


/**
 * P16 - Player Bets, Raises, Checks, and Folds
 * POST /api/games/:gameId/action
 */
exports.performBettingAction = async function (req, res) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to perform a betting action',
      });
    }

    const { gameId } = req.params;
    const { action } = req.body || {};

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID',
      });
    }

    const validActions = ['fold', 'check', 'call', 'bet', 'raise'];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Invalid betting action',
      });
    }

    const game = await GameDao.findById(gameId);

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
      });
    }

    const table = await TableDao.findById(game.TableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found',
      });
    }

    // Verify the logged-in user is seated at this table.
    const isPlayer = table.UserIds.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table',
      });
    }

    // BettingService validates turns, chip balances,
    // betting rules, and updates the game transactionally.
    await performBettingAction(
      gameId,
      userId.toString(),
      action
    );
    const { game: activeGame, actions: botActions } =
      await runBotTurns(gameId);

    return res.status(200).json({
      message: 'Betting action completed successfully',
      action,
      gameId: activeGame._id,
      status: activeGame.Status,
      pot: activeGame.Pot,
      currentBet: activeGame.CurrentBet,
      currentTurnPlayerId: activeGame.CurrentTurnPlayerId,
      bettingRoundComplete: activeGame.BettingRoundComplete,
      raiseCount: activeGame.RaiseCount,
      botActions,
      winnerIds: activeGame.WinnerIds || [],
    });
  } catch (error) {
    const badRequestErrors = [
      'Invalid betting action',
      'Cannot check when facing a bet',
      'Nothing to call',
      'Cannot bet when a bet already exists',
      'Cannot raise without an existing bet',
      'Insufficient chips',
      'Player cannot act',
    ];

    const conflictErrors = [
      'Game is not in progress',
      'Betting round is complete',
      'It is not this player’s turn',
      'Maximum raises reached',
    ];

    if (badRequestErrors.includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    if (conflictErrors.includes(error.message)) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message === 'Game not found' ||
        error.message === 'Table not found') {
      return res.status(404).json({ error: error.message });
    }

    console.error('Error performing betting action:', error);

    return res.status(500).json({
      error: 'Unable to perform betting action',
    });
  }
};
