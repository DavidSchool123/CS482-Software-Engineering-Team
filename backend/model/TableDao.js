
const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({


    Name: {
        type: String,
        required: true,
        trim: true,
    },

    JoinCode: {
        type: String,
        required: true,
        unique: true,
    },

    Capacity: {
        type: Number,
        required: true,
    },

    UserIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],

    BotCount: {
        type: Number,
        required: true,
    },

    IsPublic: {
        type: Boolean,
        required: true,
    },

    Level: { 
        type: String,
        enum: ['Low', 'Medium', 'High'],
        required: true,
    },

    Status: {
        type: String,
        enum: ['Waiting', 'In Progress', 'Closed'],
        default: 'Waiting',
    },

    CurrentGameID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        // not required
    },

});

const TableModel = mongoose.model('Table', tableSchema);

// Create a table
exports.create = async function(TableData) {
    let newTable = new TableModel(TableData);
    await newTable.save();
    return newTable;
};

// Retrieve all tables
exports.findAll = async function() {
    return await TableModel.find()
        .select('Name Capacity UserIds BotCount IsPublic Level Status');
};

// Retrieve public tables for the Lobby
exports.findPublicTables = async function () {
  return await TableModel.find({
    IsPublic: true,
    Status: { $ne: 'Closed' },
  }).select(
    'Name Capacity UserIds BotCount Level Status'
  );
};

exports.findTableByCode = async function(req) {
  let code = req.params.joinCode;
  return await TableModel.findOne({ JoinCode: code })
    .select('Name Capacity UserIds BotCount Level Status JoinCode CurrentGameID');
};

exports.deleteTableByCode = async function (req) { //needs test
    let tableId = TableModel.findOne({
      JoinCode:code,
    }).select(
      '_ID'
    )

    const table  = TableModel.findByIdAndDelete(tableId);
    return table;
}


/**
 * Find a table by its MongoDB ID.
 * Used when starting a new poker game.
 */
exports.findById = async function(tableId, session = null) {
  return await TableModel.findById(tableId).session(session);
};

/**
 * Associate a game with its table and update its status.
 */
exports.setCurrentGame = async function(tableId, gameId, session) {
  return await TableModel.findByIdAndUpdate(
    tableId,
    { $set: { CurrentGameID: gameId } },
    { new: true, session }
  );
};


/**
 * Reserve a waiting table before starting a game.
 * Only one request can change Waiting to In Progress.
 */

exports.reserveForGame = async function(tableId, session) {
  return await TableModel.findOneAndUpdate(
    {
      _id: tableId,
      Status: 'Waiting'
    },
    {
      $set: { Status: 'In Progress' }
    },
    {
      new: true,
      session
    }
  );
};

