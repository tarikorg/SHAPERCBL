const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cobol_shaper';


// Connection options
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, mongoOptions);
        console.log('✓ MongoDB connection established');

        // Set up event listeners
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
        });

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        throw err;  // Re-throw so server startup catches it
    }
}
