
require('dotenv').config();

const http = require('node:http');
const app = require('./app');
const connectDB = require('./model/DbConnection');
const createMessageSockets = require('./service/MessageSockets');

const {
  startNextHandScheduler,
  stopNextHandScheduler
} = require('./service/NextHandScheduler');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB first.
    await connectDB();

    // Create HTTP server and initialize messaging sockets.
    const server = http.createServer(app);
    createMessageSockets(server, app.locals.sessionMiddleware);

    server.listen(PORT, () => {
      console.log(`Poker Face server running on port ${PORT}`);

      // P53: Automatically advance completed hands
      // after their 30-second countdown.
      startNextHandScheduler();
    });

    // Stop the scheduler and close the server gracefully.
    function shutdown() {
      console.log('Shutting down Poker Face server...');

      stopNextHandScheduler();

      server.close((error) => {
        if (error) {
          console.error('Error closing server:', error);
          process.exitCode = 1;
        }

        process.exit();
      });
    }

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

  } catch (error) {
    console.error('Could not start Poker Face server.', error);
    process.exit(1);
  }
}

startServer();
