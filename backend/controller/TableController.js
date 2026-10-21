
const TableDao = require('../model/TableDao');

// Get all tables for the Lobby
exports.getAllTables = async function(req, res) {
    try {
        const tables = await TableDao.findAll();

        res.status(200).json(tables);
    } catch (error) {
        console.error('Error retrieving tables:', error);

        res.status(500).json({
            message: 'Unable to retrieve tables',
        });
    }
};
