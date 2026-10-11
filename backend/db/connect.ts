import mongoose from 'mongoose';
import { config } from '../config.js';

let isConnected = false;
let retryInterval: NodeJS.Timeout | null = null;

export async function connectDB(): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    console.log('[MongoDB] Connecting to MongoDB Atlas cluster...');
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    isConnected = true;
    console.log('[MongoDB] Successfully connected to MongoDB Atlas database!');

    if (retryInterval) {
      clearInterval(retryInterval);
      retryInterval = null;
    }

    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.warn('[MongoDB] Notice:', err.message);
    isConnected = false;

    // Start background reconnection retry every 30s
    if (!retryInterval) {
      retryInterval = setInterval(async () => {
        if (!isConnected) {
          try {
            await mongoose.connect(config.MONGODB_URI, {
              serverSelectionTimeoutMS: 4000,
            });
            isConnected = true;
            console.log('[MongoDB] Background reconnection succeeded!');
            if (retryInterval) {
              clearInterval(retryInterval);
              retryInterval = null;
            }
          } catch {
            // will retry on next tick
          }
        }
      }, 30000);
    }

    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
