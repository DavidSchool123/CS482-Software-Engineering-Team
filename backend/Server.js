
require('dotenv').config();

const http = require('node:http');
const app = require('./app');
const connectDB = require('./model/DbConnection');
const createMessageSockets = require('./service/MessageSockets');

const {
  startNextHandScheduler,
  stopNextHandScheduler
} = require('./service/NextHandScheduler');

const {
  startPlayerPresenceScheduler,
  stopPlayerPresenceScheduler
} = require('./service/PlayerPresenceScheduler');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    const server = http.createServer(app);

    createMessageSockets(server, app.locals.sessionMiddleware);

    server.listen(PORT, () => {
      console.log(`Poker Face server running on port ${PORT}`);
      startNextHandScheduler();
      startPlayerPresenceScheduler();
    });

    function shutdown() {
      console.log('Shutting down Poker Face server...');

      stopNextHandScheduler();
      stopPlayerPresenceScheduler();

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
