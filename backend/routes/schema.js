//router handles all api/schema  endpoints
/*
we need it for
seperate route logic from server entry point
makes it testable
keeps routes organized
*/

/**
 * Schema Routes
 * 
 * CRUD operations for COBOL file descriptions (FD Schemas)
 * 
 * Endpoints:
 * - POST   /api/schema         → Create new schema
 * - GET    /api/schema/:id     → Get one schema by ID
 * - PUT    /api/schema/:id     → Update schema
 * - DELETE /api/schema/:id     → Delete schema
 * - GET    /api/schemas        → List all schemas
 * 
 * All endpoints:
 * - Validate input (Mongoose + custom checks)
 * - Measure performance (for research metrics)
 * - Handle errors consistently (via errorHandler middleware)
 * - Return structured JSON responses
 * 
 * Research metrics collected:
 * - schema_creation (duration, field count, success/error)
 * - schema_retrieval (duration, field count)
 * - schema_update (duration, field count)
 * - schema_deletion (duration)
 * - schema_list (duration, count)
 */

const express = require('express');
const router = express.Router();
const FDSchema = require('../models/FDSchema');
const metricsCollector = require('../services/metricsCollector');
const { performance } = require('perf_hooks');

// ========== CREATE NEW SCHEMA ==========
/**
 * POST /api/schema
 * 
 * Create a new COBOL File Description schema
 * 
 * Request body:
 * {
 *   "name": "EMPLOYEE",
 *   "description": "Employee payroll records",
 *   "fields": [
 *     {
 *       "name": "EMP_ID",
 *       "picClause": "9(5)",
 *       "sourceKey": "emp_id"
 *     },
 *     {
 *       "name": "SALARY",
 *       "picClause": "9(7)V99",
 *       "sourceKey": "salary"
 *     }
 *   ]
 * }
 * 
 * The FDSchema pre-save hook automatically calculates:
 * - startPos (position in fixed-width record)
 * - length (bytes for each field, from PIC clause)
 * - recordLength (total bytes per record)
 * - type (auto-detected from PIC)
 * - paddingDirection and paddingChar (determined by type)
 * 
 * Response (201 Created):
 * {
 *   "success": true,
 *   "message": "Schema 'EMPLOYEE' created successfully",
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "name": "EMPLOYEE",
 *     "description": "Employee payroll records",
 *     "fields": [
 *       {
 *         "name": "EMP_ID",
 *         "picClause": "9(5)",
 *         "type": "numeric",
 *         "sourceKey": "emp_id",
 *         "startPos": 1,
 *         "length": 5,
 *         "paddingDirection": "left",
 *         "paddingChar": "0"
 *       },
 *       {
 *         "name": "SALARY",
 *         "picClause": "9(7)V99",
 *         "type": "decimal",
 *         "sourceKey": "salary",
 *         "startPos": 6,
 *         "length": 9,
 *         "decimals": 2,
 *         "paddingDirection": "left",
 *         "paddingChar": "0"
 *       }
 *     ],
 *     "recordLength": 14,
 *     "createdAt": "2026-03-24T14:30:00.123Z",
 *     "updatedAt": "2026-03-24T14:30:00.123Z"
 *   }
 * }
 * 
 * Errors:
 * - 400 Bad Request: Invalid PIC clause, missing fields, validation failed
 * - 409 Conflict: Schema name not unique (already exists)
 * - 500 Internal Error: Database or unexpected error
 */
router.post('/schema', async (req, res, next) => {
  const startTime = performance.now(); // Start high-resolution timer

  try {
    // ========== VALIDATE INPUT ==========
    
    // Check: name is required and is a string
    if (!req.body.name || typeof req.body.name !== 'string') {
      const err = new Error('Schema name is required and must be a string');
      err.statusCode = 400;
      err.isCustomError = true;
      throw err;
    }

    // Check: fields is array with at least 1 field
    if (!req.body.fields || !Array.isArray(req.body.fields) || req.body.fields.length === 0) {
      const err = new Error('At least one field is required. Fields must be an array.');
      err.statusCode = 400;
      err.isCustomError = true;
      throw err;
    }

    // ========== CREATE SCHEMA IN DATABASE ==========
    // Mongoose will:
    // 1. Validate each field (picClause required, type valid, etc.)
    // 2. Run pre-save hook (calculate startPos, recordLength, auto-detect type)
    // 3. Save to MongoDB
    // 4. Return document with _id
    
    const schema = await FDSchema.create({
      name: req.body.name,
      description: req.body.description || '',
      fields: req.body.fields
    });

    // ========== LOG SUCCESS METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_creation',
      durationMs: duration,
      fieldCount: schema.fields.length,
      recordLength: schema.recordLength,
      success: true,
      errors: []
    });

    // ========== SEND RESPONSE ==========
    // 201 = Created (new resource successfully created)
    res.status(201).json({
      success: true,
      message: `Schema '${schema.name}' created successfully`,
      data: schema
    });

  } catch (err) {
    // ========== LOG FAILURE METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_creation',
      durationMs: duration,
      fieldCount: req.body.fields?.length || 0,
      success: false,
      errors: [err.message]
    });

    // ========== PASS TO ERROR HANDLER ==========
    // Error handler middleware will format the error response
    // and send appropriate HTTP status code
    next(err);
  }
});

// ========== GET ONE SCHEMA BY ID ==========
/**
 * GET /api/schema/:id
 * 
 * Retrieve a single schema by MongoDB ObjectID
 * 
 * Example:
 * GET /api/schema/507f1f77bcf86cd799439011
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": { _id, name, fields, recordLength, createdAt, ... }
 * }
 * 
 * Errors:
 * - 404 Not Found: Schema with ID doesn't exist
 * - 400 Bad Request: Invalid ID format
 */
router.get('/schema/:id', async (req, res, next) => {
  const startTime = performance.now();

  try {
    // ========== QUERY DATABASE ==========
    const schema = await FDSchema.findById(req.params.id);

    // ========== CHECK IF FOUND ==========
    if (!schema) {
      const err = new Error(`Schema with ID '${req.params.id}' not found`);
      err.statusCode = 404;
      err.isCustomError = true;
      throw err;
    }

    // ========== LOG SUCCESS METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_retrieval',
      durationMs: duration,
      fieldCount: schema.fields.length,
      success: true,
      errors: []
    });

    // ========== SEND RESPONSE ==========
    res.status(200).json({
      success: true,
      data: schema
    });

  } catch (err) {
    // ========== LOG FAILURE METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_retrieval',
      durationMs: duration,
      success: false,
      errors: [err.message]
    });

    // ========== PASS TO ERROR HANDLER ==========
    next(err);
  }
});

// ========== UPDATE SCHEMA ==========
/**
 * PUT /api/schema/:id
 * 
 * Update an existing schema (fields, name, description)
 * 
 * When fields are updated, the pre-save hook re-runs to recalculate:
 * - Field positions (startPos)
 * - Field lengths (from PIC clauses)
 * - Total record length
 * 
 * Request body: Same as POST (name, fields, description)
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Schema 'EMPLOYEE' updated successfully",
 *   "data": { updated schema with recalculated fields }
 * }
 * 
 * Errors:
 * - 404 Not Found: Schema doesn't exist
 * - 400 Bad Request: Invalid data
 * - 409 Conflict: Name not unique after update
 */
router.put('/schema/:id', async (req, res, next) => {
  const startTime = performance.now();

  try {
    // ========== VALIDATE INPUT ==========
    if (!req.body.name || typeof req.body.name !== 'string') {
      const err = new Error('Schema name is required and must be a string');
      err.statusCode = 400;
      err.isCustomError = true;
      throw err;
    }

    if (!req.body.fields || !Array.isArray(req.body.fields) || req.body.fields.length === 0) {
      const err = new Error('At least one field is required');
      err.statusCode = 400;
      err.isCustomError = true;
      throw err;
    }

    // ========== UPDATE IN DATABASE ==========
    // findByIdAndUpdate options:
    // - new: true        → Return UPDATED document (not original)
    // - runValidators: true → Run Mongoose validators on the update
    // 
    // Pre-save hook runs, recalculating all positions
    
    const schema = await FDSchema.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        description: req.body.description || '',
        fields: req.body.fields
      },
      { 
        new: true,           // Return updated doc
        runValidators: true  // Validate before save
      }
    );

    // ========== CHECK IF FOUND ==========
    if (!schema) {
      const err = new Error(`Schema with ID '${req.params.id}' not found`);
      err.statusCode = 404;
      err.isCustomError = true;
      throw err;
    }

    // ========== LOG SUCCESS METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_update',
      durationMs: duration,
      fieldCount: schema.fields.length,
      success: true,
      errors: []
    });

    // ========== SEND RESPONSE ==========
    res.status(200).json({
      success: true,
      message: `Schema '${schema.name}' updated successfully`,
      data: schema
    });

  } catch (err) {
    // ========== LOG FAILURE METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_update',
      durationMs: duration,
      fieldCount: req.body.fields?.length || 0,
      success: false,
      errors: [err.message]
    });

    // ========== PASS TO ERROR HANDLER ==========
    next(err);
  }
});

// ========== DELETE SCHEMA ==========
/**
 * DELETE /api/schema/:id
 * 
 * Delete a schema by ID (permanent deletion)
 * 
 * Example:
 * DELETE /api/schema/507f1f77bcf86cd799439011
 * 
 * Response (204 No Content):
 * (empty body - indicates successful deletion)
 * 
 * Errors:
 * - 404 Not Found: Schema doesn't exist
 */
router.delete('/schema/:id', async (req, res, next) => {
  const startTime = performance.now();

  try {
    // ========== DELETE FROM DATABASE ==========
    const schema = await FDSchema.findByIdAndDelete(req.params.id);

    // ========== CHECK IF FOUND ==========
    if (!schema) {
      const err = new Error(`Schema with ID '${req.params.id}' not found`);
      err.statusCode = 404;
      err.isCustomError = true;
      throw err;
    }

    // ========== LOG SUCCESS METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_deletion',
      durationMs: duration,
      success: true,
      errors: []
    });

    // ========== SEND RESPONSE ==========
    // 204 = No Content (successful deletion, no body)
    res.status(204).send();

  } catch (err) {
    // ========== LOG FAILURE METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_deletion',
      durationMs: duration,
      success: false,
      errors: [err.message]
    });

    // ========== PASS TO ERROR HANDLER ==========
    next(err);
  }
});

// ========== LIST ALL SCHEMAS ==========
/**
 * GET /api/schemas
 * 
 * Retrieve all schemas with optional pagination
 * 
 * Query parameters (optional):
 * ?skip=0&limit=10
 * 
 * Examples:
 * GET /api/schemas                    → All schemas (up to limit)
 * GET /api/schemas?skip=10&limit=5    → Skip 10, return next 5
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "count": 2,
 *   "data": [
 *     { _id, name, fields, recordLength, ... },
 *     { _id, name, fields, recordLength, ... }
 *   ]
 * }
 * 
 * Errors:
 * - 500 Internal Error: Database error
 */
router.get('/schemas', async (req, res, next) => {
  const startTime = performance.now();

  try {
    // ========== PARSE PAGINATION PARAMS ==========
    const skip = parseInt(req.query.skip) || 0;       // Default: start from beginning
    const limit = parseInt(req.query.limit) || 1000;  // Default: max 1000 per request (safety)

    // ========== QUERY DATABASE ==========
    // Chain Mongoose methods:
    // - find()         → Get all documents
    // - skip(n)        → Skip first n documents
    // - limit(n)       → Return max n documents
    // - sort()         → Order results (descending = newest first)
    
    const schemas = await FDSchema.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });  // -1 = descending (newest first)

    // ========== LOG SUCCESS METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_list',
      durationMs: duration,
      count: schemas.length,
      success: true,
      errors: []
    });

    // ========== SEND RESPONSE ==========
    res.status(200).json({
      success: true,
      count: schemas.length,
      data: schemas
    });

  } catch (err) {
    // ========== LOG FAILURE METRIC ==========
    const duration = performance.now() - startTime;
    metricsCollector.logMetric({
      type: 'schema_list',
      durationMs: duration,
      count: 0,
      success: false,
      errors: [err.message]
    });

    // ========== PASS TO ERROR HANDLER ==========
    next(err);
  }
});

// ========== EXPORT ROUTER ==========
/**
 * Export the router so server.js can mount it
 * 
 * Usage in server.js:
 * const schemaRouter = require('./routes/schema');
 * app.use('/api', schemaRouter);
 * 
 * This makes all endpoints available:
 * - POST   /api/schema
 * - GET    /api/schema/:id
 * - PUT    /api/schema/:id
 * - DELETE /api/schema/:id
 * - GET    /api/schemas
 */
module.exports = router;
