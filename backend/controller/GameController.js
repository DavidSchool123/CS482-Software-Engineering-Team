
const mongoose = require('mongoose');
const GameService = require('../service/GameService');
const TableDao = require('../model/TableDao');

exports.startGame = async function(req, res) {
  try {
    // Check if the user is logged in
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'You must be logged in to start a game'
      });
    }

    const { tableId } = req.params;

    // Validate the table ID
    if (!mongoose.isValidObjectId(tableId)) {
      return res.status(400).json({
        error: 'Invalid table ID'
      });
    }

    // Find the table
    const table = await TableDao.findById(tableId);

    if (!table) {
      return res.status(404).json({
        error: 'Table not found'
      });
    }

    // Verify that the logged-in user belongs to this table
    const isPlayer = table.UserIds.some(
      id => id.toString() === userId.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({
        error: 'You are not a player at this table'
      });
    }

    // Start the game
    const game = await GameService.startGame(tableId);

    return res.status(201).json({
      message: 'Game started successfully',
      gameId: game._id,
      tableId: game.TableId,
      street: game.Street,
      status: game.Status
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
