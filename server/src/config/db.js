import mongoose from 'mongoose';

export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGO_URI is not set');
    }
    await mongoose.connect(uri);
    console.log('[db] connected to MongoDB');
}