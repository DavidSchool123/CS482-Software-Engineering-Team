require('dotenv').config();

const http = require('node:http');
const app = require('./app');
const connectDB = require('./model/DbConnection');
const createMessageSockets = require('./service/MessageSockets');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    const server = http.createServer(app);
    createMessageSockets(server, app.locals.sessionMiddleware);
    server.listen(PORT, () => {
      console.log(`Poker Face server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Could not start Poker Face server.');
    process.exit(1);
  }
}

startServer();
