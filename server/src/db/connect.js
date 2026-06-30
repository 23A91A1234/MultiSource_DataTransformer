import mongoose from 'mongoose';

export async function connectDB(uri) {
  const mongodbUri = uri || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/candidate_transformer';
  
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Redact credentials in logs to maintain database security
  const redactedUri = typeof mongodbUri === 'string'
    ? mongodbUri.replace(/:([^@/:]+)@/, ':****@')
    : 'unknown';

  try {
    await mongoose.connect(mongodbUri);
    console.log(`Connected to MongoDB successfully at: ${redactedUri}`);
    return mongoose.connection;
  } catch (error) {
    console.error(`Failed to connect to MongoDB at ${redactedUri}. Error:`, error.message);
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}
