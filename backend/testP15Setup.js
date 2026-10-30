
require('dotenv').config();

const mongoose = require('mongoose');
const crypto = require('node:crypto');
const TableDao = require('./model/TableDao');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const table = await TableDao.create({
      Name: 'P15 Test Table',
      JoinCode: `P15-${crypto.randomUUID()}`,
      Capacity: 2,
      UserIds: [
        '6ae43c6208f4386ff6ee2806'
      ],
      BotCount: 1,
      IsPublic: false,
      Level: 'Low',
      Status: 'Waiting'
    });

    console.log('Test table created!');
    console.log('Table ID:', table._id.toString());
    console.log('Status:', table.Status);
    console.log('Players:', table.UserIds.length);
    console.log('Bots:', table.BotCount);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();

