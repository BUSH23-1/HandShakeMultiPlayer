import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { connectDB } from './db/connect.js';
import { apiRouter } from './routes/apiRoutes.js';
import { setupGameSocket } from './socket/gameSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function createBackendServer() {
  const app = express();
  const server = http.createServer(app);

  // Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json());

  // Connect to MongoDB asynchronously
  connectDB().catch((err) => {
    console.warn('[MongoDB] Initial connection error:', err.message);
  });

  // REST API Routes
  app.use('/api', apiRouter);

  // Initialize Socket.IO game handlers
  setupGameSocket(io);

  // Full-Stack frontend integration
  const isProduction = config.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  return { app, server };
}

export async function startBackendServer() {
  const { server } = await createBackendServer();
  server.listen(Number(config.PORT), '0.0.0.0', () => {
    console.log(`[Backend] Express + Socket.IO server running on port ${config.PORT}`);
  });
  return server;
}
