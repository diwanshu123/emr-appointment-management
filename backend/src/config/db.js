const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  // Make sure every index (especially the unique slot index that prevents
  // double booking) exists BEFORE the server accepts traffic.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  logger.info('MongoDB connected and indexes ensured');
}

module.exports = connectDB;
