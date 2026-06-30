import mongoose from 'mongoose';

export async function connectDB(uri) {
  const mongodbUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/candidate_transformer';
  
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(mongodbUri);
    console.log(`Connected to MongoDB at ${mongodbUri}`);
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}
