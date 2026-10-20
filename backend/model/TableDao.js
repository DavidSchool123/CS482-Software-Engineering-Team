const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({

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
    }

    MaxBet: {
        type: Number,
        required: true,
    }

    CurrentGameID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
        //not required
    },



});

const TableModel = mongoose.model('Table', tableSchema);


exports.create = async function(TableData) {
    let newTable = new TableModel(TableData);
    await newTable.save;
    return newTable;
}








