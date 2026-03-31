/**
 * Global Error Handler Middleware
 * 
 * Catches all errors from routes and returns consistent JSON response
 * 
 * CRITICAL: Must be registered LAST in server.js (after all other middleware and routes)
 * Express calls error middleware only when:
 * 1. A route/middleware throws an error
 * 2. A route/middleware calls next(err)
 * 
 * Examples of errors it catches:
 * - Validation errors (missing required fields)
 * - MongoDB errors (duplicate key, invalid ID)
 * - Custom errors (thrown by handlers)
 * - Unexpected errors (any uncaught exception)
 * 
 * Error handler response format:
 * {
 *   "success": false,
 *   "error": "Schema name must be unique",
 *   "code": 409
 * }
 * 
 * In development, also includes stack trace for debugging
 */

/**
 * Express error handler middleware
 * 
 * NOTE: 4-parameter signature (err, req, res, next) is required
 * Express detects error handlers by parameter count (arity)
 * 
 * @param {Error} err - The error object (with message, code, etc.)
 * @param {Object} req - Express request object (method, path, etc.)
 * @param {Object} res - Express response object (send, status, json)
 * @param {Function} next - Express next function (not used, but required)
 * 
 * @returns {void} Sends HTTP response via res.json()
 */
function errorHandler(err, req, res, next) {
  // ========== EXTRACT ERROR DETAILS ==========
  // Get status code from error, or default to 500 (internal server error)
  let statusCode = err.statusCode || err.status || 500;
  
  // Check if development environment (from NODE_ENV in .env)
  const isDevelopment = process.env.NODE_ENV === 'development';

  // ========== LOG ERROR ==========
  // Log to console with structured format
  console.error('❌ Error Caught by Global Handler:', {
    method: req.method,           // GET, POST, PUT, DELETE
    path: req.path,               // /api/schema, /api/schemas/:id, etc.
    statusCode: statusCode,       // HTTP status code
    message: err.message,         // Error message
    timestamp: new Date().toISOString()
  });

  // Show full stack trace only in development (hidden in production for security)
  if (isDevelopment) {
    console.error('Stack trace:\n', err.stack);
  }

  // ========== CATEGORIZE & HANDLE SPECIFIC ERROR TYPES ==========
  
  // Start with generic error response
  let errorResponse = {
    success: false,
    error: err.message || 'Internal server error',
    code: statusCode
  };

  // -------- MongoDB/Mongoose-Specific Errors --------

  // Error 11000: Duplicate key (e.g., schema name already exists)
  // Example: User tries to create EMPLOYEE schema, but EMPLOYEE already in DB
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]; // Extract field name: 'name', 'email', etc.
    errorResponse.error = `${field} must be unique. "${err.keyValue[field]}" already exists.`;
    statusCode = 409; // 409 = Conflict (resource already exists)
  }

  // Error: ValidationError (required fields missing or invalid)
  // Example: Mongoose requires 'name' field, but it's not provided
  if (err.name === 'ValidationError') {
    // Extract validation error messages
    const messages = Object.values(err.errors)
      .map(e => e.message) // Get message from each validation error
      .join(', ');         // Join with commas
    
    errorResponse.error = `Validation failed: ${messages}`;
    statusCode = 400; // 400 = Bad Request
  }

  // Error: CastError (invalid MongoDB ObjectID format)
  // Example: Frontend sends /api/schema/invalid123 (not a valid ObjectID)
  if (err.name === 'CastError') {
    errorResponse.error = `Invalid ID format: "${err.value}". Expected a valid MongoDB ObjectID.`;
    statusCode = 400; // 400 = Bad Request
  }

  // -------- Custom/Business Logic Errors --------

  // If error has a custom statusCode property (set by route handler)
  // Example: const error = new Error('...');
  //          error.statusCode = 422; throw error;
  if (err.isCustomError) {
    errorResponse.error = err.message;
    statusCode = err.statusCode || 400;
  }

  // ========== SEND RESPONSE ==========
  
  // Send HTTP response with appropriate status code and JSON body
  // Response format:
  // {
  //   "success": false,
  //   "error": "descriptive error message",
  //   "code": 400|409|500|etc
  // }
  // In development, also includes stack trace for debugging
  
  res.status(statusCode).json({
    success: false,
    error: errorResponse.error,
    code: statusCode,
    
    // DEVELOPMENT ONLY: Include stack trace for debugging
    // Production will never see this (security best practice)
    ...(isDevelopment && { 
      stack: err.stack 
    })
  });
}

// ========== EXPORT ==========
/**
 * Export the error handler middleware
 * 
 * Usage in server.js:
 * const errorHandler = require('./middleware/errorHandler');
 * app.use(errorHandler); // Register LAST
 */
module.exports = errorHandler;
