require('dotenv').config();

const app = require('./app');
const connectDB = require('./model/DbConnection');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Poker Face server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Could not start Poker Face server.');
    process.exit(1);
  }
}

startServer();
