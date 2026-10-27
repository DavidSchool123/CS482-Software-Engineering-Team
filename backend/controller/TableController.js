
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');
const UserDao  = require('../model/UserDao');
const crypto = require('crypto');

// Get public tables and their betting information for the Lobby
exports.getAllTables = async function(req, res) {
    try {
        const tables = await TableDao.findPublicTables();

        const formattedTables = tables.map((table) => {
            const levelConfig = TABLE_LEVELS[table.Level];

            return {
                id: table._id,
                name: table.Name,
                level: table.Level,
                capacity: table.Capacity,
                playerCount: (table.UserIds?.length ?? 0) + (table.BotCount ?? 0),
                status: table.Status,
                stakes: levelConfig
                    ? {
                        smallBet: levelConfig.smallBet,
                        bigBet: levelConfig.bigBet,
                        minBuyIn: levelConfig.minBuyIn,
                        maxBuyIn: levelConfig.maxBuyIn,
                      }
                    : null,
            };
        });

        res.status(200).json(formattedTables);
    } catch (error) {
        console.error('Error retrieving public tables:', error);

        res.status(500).json({
            message: 'Unable to retrieve tables',
        });
    }
};

//Create a new table
exports.createTable = async function(req, res){ //needs test
    try {

            //random join code -- currently no duplicate protection - will need eventually
            const generatedJoinCode = crypto.randomBytes(4).toString('hex').toUpperCase();

            //get host ID -- update when have persistent user ID!!!
            const hostId =  (await UserDao.readAll())[0];

            const tableData = {
                Name: req.body.Name,
                JoinCode: generatedJoinCode,
                Capacity: req.body.Capacity,
                UserIds: [hostId],
                BotCount: req.body.BotCount,
                IsPublic: req.body.IsPublic,
                Level: req.body.Level,
            }

            //handle buy-in

            //create the table
            const table = await TableDao.create(tableData);

            //create associated bots?

            //send the user to a page with the appropriate table info
            // Return the new table ID so the frontend can navigate to it.
            return res.status(201).json({
                id: table._id.toString(),
                name: table.Name,
                joinCode: table.JoinCode,
            });
        } catch (error) {
            console.error('Error creating table:', error);

            res.status(500).json({
                message: 'Unable to create table',
            });
        }
}


//find a table using its join code
exports.findTableByCode = async function(req, res){ //needs test
    try {

        //create the table
        const table = await TableDao.findTableByCode(req);

        //error, couldn't find table
        if (!table) {
            return res.status(404).json({
                message: 'Table not found',
            });
        }

        //send the user to a page with the appropriate table info
        return res.status(200).json({
            id: table._id.toString(),
            filledSeats: (table.UserIds.length + table.BotCount),
            capacity: table.Capacity,
            botCount: table.BotCount,
            level: table.Level,
            name: table.Name,
            joinCode: table.JoinCode,
        });
    } catch (error) {
        console.error('Error finding table:', error);

        res.status(500).json({
            message: 'Unable to find table',
        });
    }
}


exports.leaveTable = async function(req,res){ //needs test
    try {

        //DELETE THIS! TEMPORARY, removes first (and only, since we don't have join in yet) user
        const existingTable = await TableDao.findTableByCode(req);

        if (!existingTable) {
            return res.status(404).json({
                message: 'Table not found',
            });
        }

        if (!existingTable.UserIds || existingTable.UserIds.length === 0) {
            return res.status(400).json({
                message: 'There are no users to remove from this table',
            });
        }

        const userId = existingTable.UserIds[0];

        // Build a request-like object for the DAO methods
        const req1 = {
            params: {
                joinCode: req.params.joinCode,
                userId: userId,
            },
        };

        // Remove the user from the table
        const table = await TableDao.UpdateRemovePlayer(req1);

        if (!table) {
            return res.status(404).json({
                message: 'Table not found',
            });
        }


        if (table.UserIds.length === 0){
            const table1 = await TableDao.deleteTableByCode(req1)//req
            //probably also want to delete associated bots

            return res.status(200).json({
                message: 'User left; empty table deleted',
                joinCode: req.params.joinCode,
                deleted: true,
            });

        }



        //send the user to a page with the appropriate table info
        // Return the new table ID so the frontend can navigate to it.
        return res.status(200).json({
            id: table._id.toString(),
            filledSeats: (table.UserIds.length + table.BotCount),
            capacity: table.Capacity,
            botCount: table.BotCount,
            level: table.Level,
            name: table.Name,
            joinCode: table.JoinCode,
            deleted: false,
        });
    } catch (error) {
        console.error('Error leaving table:', error);

        res.status(500).json({
            message: 'Unable to find table to leave',
        });
    }
}