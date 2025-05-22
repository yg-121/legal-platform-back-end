import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Removed deprecated options
      retryWrites: true, // Enable retryable writes for reliability
      w: 'majority', // Ensure write acknowledgment
    });
    console.log('✅ MongoDB Connected...');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;