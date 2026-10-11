/**
 * Root Server Entry Point
 * Starts backend from backend/server.ts
 */
import { startBackendServer } from './backend/server.js';

startBackendServer().catch((err) => {
  console.error('Failed to start server:', err);
});
