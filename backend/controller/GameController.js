
const mongoose = require('mongoose');
const GameService = require('../service/GameService');
const TableDao = require('../model/TableDao');
const GameDao = require('../model/GameDao');
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

    return res.status(201).json({
      message: 'Game started successfully',
      gameId: game._id,
      tableId: game.TableId,
      street: game.Street,
      status: game.Status,
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
    const players = getVisiblePlayers(game.Players, userId);

    return res.status(200).json({
      gameId: game._id,
      tableId: game.TableId,
      street: game.Street,
      status: game.Status,
      players,
    });
  } catch (error) {
    console.error('Error retrieving game:', error);

    return res.status(500).json({
      error: 'Unable to retrieve game',
    });
  }
};
