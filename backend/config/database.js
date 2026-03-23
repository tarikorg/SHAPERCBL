/**
 * MongoDB Database Connection
 * 
 * Initializes MongoDB connection using Mongoose
 * Called at server startup
 * 
 * Connection string from .env:
 * - Development: mongodb://localhost:27017/cobol_shaper
 * - Production: mongodb+srv://user:pass@cluster.mongodb.net/cobol_shaper
 */

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
 * Establishes connection and sets up event listeners
 * 
 * @returns {Promise<void>}
 * @throws {Error} If connection fails
 */
async function connectDB() {
    try {
        console.log('📡 Attempting MongoDB connection...');
        console.log(`   URI: ${MONGO_URI.replace(/:[^:]*@/, ':****@')}`); // Hide password

        await mongoose.connect(MONGO_URI, mongoOptions);
        console.log('✓ MongoDB connection established');

        // Set up event listeners for connection lifecycle
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
        });

        mongoose.connection.on('connected', () => {
            console.log('✓ MongoDB re-connected');
        });

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        throw err;  // Re-throw so server startup catches it
    }
}

module.exports = connectDB;
