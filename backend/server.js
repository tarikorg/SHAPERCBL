/**
 * COBOL File Shaper Backend Server
 * 
 * Entry point for Express.js application
 * - Loads environment variables
 * - Connects to MongoDB
 * - Registers middleware and routes
 * - Handles errors gracefully
 * 
 * Run: npm run dev (development with nodemon)
 * Or:  npm start (production)
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables FIRST
dotenv.config();

// Configuration from .env (with fallbacks)
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cobol_shaper';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Import configuration
const connectDB = require('./config/database');

// Initialize Express app
const app = express();

// ========== MIDDLEWARE ==========
// Parse incoming request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS (allow React frontend to make requests)
app.use(cors());

// Log HTTP requests in Apache combined format
app.use(morgan('combined'));

// ========== SERVER STARTUP ==========
async function startServer() {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✓ MongoDB connected at:', MONGO_URI);

    // Log startup info
    console.log(`
╔════════════════════════════════════════╗
║  🚀 COBOL File Shaper Backend          ║
║  Environment: ${NODE_ENV.toUpperCase().padEnd(19)}║
║  Port: ${String(PORT).padEnd(30)}║
║  MongoDB: Connected              ║
║  Metrics: Enabled                ║
╚════════════════════════════════════════╝
    `);

    // ========== ROUTES ==========
      // Import routes
    const schemaRouter = require('./routes/schema');
    
    // Register routes (all prefixed with /api)
    app.use('/api', schemaRouter);
    
    // Routes now available:
    // POST   /api/schema         (create)
    // GET    /api/schema/:id     (read one)
    // PUT    /api/schema/:id     (update)
    // DELETE /api/schema/:id     (delete)
    // GET    /api/schemas        (list all)
    // Placeholder:
    // app.use('/api/schema', require('./routes/schema'));
    // app.use('/api/transform', require('./routes/transform'));
    // app.use('/api/metrics', require('./routes/metrics'));

    // Health check endpoint (for testing)
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        environment: NODE_ENV,
        mongodb: 'connected'
      });
    });

    // ========== ERROR HANDLING ==========
   // Import error handler middleware
    const errorHandler = require('./middleware/errorHandler');
    
    // Register error handler (MUST BE LAST)
    // Must be after all routes
    app.use(errorHandler);

    // ========== START LISTENING ==========
    const server = app.listen(PORT, () => {
      console.log(`✓ Server listening on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n📛 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

// Start the server
startServer();
