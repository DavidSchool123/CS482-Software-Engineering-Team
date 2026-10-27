
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

exports.findTableByCode = async function (req) { //needs test
    const code = req.params.joinCode;
    return await TableModel.findOne({
      JoinCode: code,
    }).select(
      'Name Capacity UserIds BotCount Level Status JoinCode'
    )
}

exports.UpdateRemovePlayer = async function (req){ //needs test
    const joinCode = req.params.joinCode;
    const userId = req.body.userId;

    return await TableModel.findOneAndUpdate(
        { JoinCode: joinCode },
        { $pull: { UserIds: userId } },
        { new: true }
    );
}

exports.deleteTableByCode = async function (req) { //needs test
    const joinCode = req.params.joinCode;

    return await TableModel.findOneAndDelete({
        JoinCode: joinCode,
    });
}

exports.deleteAll = async function () { //needs test
    return await TableModel.deleteMany({});
}
