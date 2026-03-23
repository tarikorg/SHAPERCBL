const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

const connectDB = require('./config/database');


dotenv.config();
//config from env with fallbacks
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cobol_shaper'
const NODE_ENV = process.env.NODE_ENV || 'development';



const app = express();
//========MIDDLEWARE =========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('combined'))


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
╚════════════���═══════════════════════════╝
    `);

    // ========== ROUTES ==========
    // (To be added in Phase 1)
    // Example:
    // app.use('/api/schema', require('./routes/schema'));
    // app.use('/api/transform', require('./routes/transform'));
    // app.use('/api/metrics', require('./routes/metrics'));

    // ========== ERROR HANDLING ==========
    app.use((err, req, res, next) => {
      console.error('❌ Error:', err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message,
        ...(NODE_ENV === 'development' && { stack: err.stack })
      });
    });

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
