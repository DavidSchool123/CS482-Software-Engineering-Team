
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
exports.createTable = async function(req, res){
    try {

            //random join code -- currently no duplicate protection - will need eventually
            const generatedJoinCode = crypto.randomBytes(4).toString('hex').toUpperCase();

            //get host ID -- update when have persistent user ID
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

            //send the user to a page with the appropriate table info
            res.redirect('')//replace with correct link

        } catch (error) {
            console.error('Error creating table:', error);

            res.status(500).json({
                message: 'Unable to create table',
            });
        }
}