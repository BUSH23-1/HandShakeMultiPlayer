import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT ? Number(process.env.PORT) === 8080 ? 3000 : Number(process.env.PORT) : 3000,
  MONGODB_URI:
    process.env.MONGODB_URI ||
    'mongodb+srv://shaikbushra569_db_user:bushu%4023@bushra.47criid.mongodb.net/tictactoe?appName=Bushra',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
