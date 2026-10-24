
const TableDao = require('../model/TableDao');
const TABLE_LEVELS = require('../model/tableLevels');

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
