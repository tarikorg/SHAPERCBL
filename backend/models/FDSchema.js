/*
this file do:
-define what a cobol fd document looks like in mongodb
-setup validation rules(fd names must be strings, picClause must match pattern)
-add a pre-save hook to auto-calculate startPos and recordLength
-export the model so other files can import
/**
 * File Description Schema Model
 * 
 * Represents a COBOL FD (File Description) - the blueprint for fixed-width records
 * 
 * Example document stored in MongoDB:
 * {
 *   _id: ObjectId("..."),
 *   name: "EMPLOYEE",
 *   description: "Employee payroll records",
 *   fields: [
 *     {
 *       name: "EMP_ID",
 *       picClause: "9(5)",
 *       type: "numeric",
 *       startPos: 1,
 *       length: 5,
 *       sourceKey: "emp_id",
 *       paddingDirection: "left",
 *       paddingChar: "0"
 *     },
 *     {
 *       name: "NAME",
 *       picClause: "X(20)",
 *       type: "alphanumeric",
 *       startPos: 6,
 *       length: 20,
 *       sourceKey: "name",
 *       paddingDirection: "right",
 *       paddingChar: " "
 *     }
 *   ],
 *   recordLength: 25,
 *   validationResults: {
 *     compileSuccess: null,
 *     compileErrors: []
 *   },
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 * 
 * Pre-save hook automatically calculates:
 * - startPos (position in fixed-width line)
 * - length (bytes for this field, from PIC clause)
 * - recordLength (total bytes per record)
 * - type (detected from PIC pattern)
 * 
 * Used by:
 * - Phase 2: Transformer (needs startPos, length, type)
 * - Phase 3: Copybook Generator (needs all fields)
 * - API: GET /api/schema/:id, POST /api/schema
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Import PIC parser (will create in File 2)
const picParser = require('../utils/picParser');

// ========== FIELD SCHEMA (sub-document) ==========
// Represents ONE field in a COBOL record
const fieldSchema = new Schema({
  // COBOL field name (e.g., "EMP_ID", "EMPLOYEE_NAME", "SALARY")
  // COBOL convention: uppercase with hyphens
  name: {
    type: String,
    required: [true, 'Field name is required'],
    trim: true,
    minlength: [1, 'Field name cannot be empty'],
    maxlength: [30, 'Field name cannot exceed 30 characters']
  },

  // COBOL PIC clause (e.g., "9(5)", "X(20)", "9(7)V99", "S9(10)")
  // This is what the PIC parser will analyze
  picClause: {
    type: String,
    required: [true, 'PIC clause is required'],
    match: [/^[SZ]?[9AXN][0-9()V.]+$/, 'Invalid PIC clause format'],
    trim: true
  },

  // Data type (auto-detected by PIC parser)
  // Values: "numeric" (9), "alphanumeric" (X), "decimal" (9V9), "alphabetic" (A), "signed" (S9), "comp3"
  type: {
    type: String,
    enum: ['numeric', 'alphanumeric', 'decimal', 'alphabetic', 'signed', 'comp3'],
    required: true
  },

  // Starting position in fixed-width line (auto-calculated by pre-save hook)
  // Example: field 1 at pos 1, field 2 at pos 6, field 3 at pos 26
  // COBOL uses 1-based indexing (not 0-based like JavaScript)
  startPos: {
    type: Number,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'startPos must be an integer'
    }
  },

  // Field length in bytes (auto-calculated from PIC clause)
  // Example: "9(5)" = 5 bytes, "X(20)" = 20 bytes, "9(7)V99" = 9 bytes
  length: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'length must be an integer'
    }
  },

  // Number of decimal places (for decimal PIC clauses)
  // Example: "9(7)V99" has 2 decimal places (after the V)
  // Used in Phase 2 to correctly format decimal values
  decimals: {
    type: Number,
    min: 0,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'decimals must be an integer'
    }
  },

  // Maps COBOL field name to input data key
  // Example: COBOL field "EMP_ID" maps to JSON key "emp_id" or CSV column "EMP ID"
  // Used by Phase 2 transformer to find value in source data
  sourceKey: {
    type: String,
    trim: true
  },

  // Default value if field missing from input data
  // Example: if SALARY missing, use "0000000"
  defaultValue: String,

  // Which direction to pad: "left" (numeric) or "right" (alphanumeric)
  // Auto-set by pre-save hook based on field type
  paddingDirection: {
    type: String,
    enum: ['left', 'right'],
    default: 'right'
  },

  // Character to pad with: "0" for numbers, " " (space) for text
  // Auto-set by pre-save hook based on field type
  paddingChar: {
    type: String,
    default: ' ',
    maxlength: [1, 'Padding character must be single character']
  },

  // Whether this field is required in input
  // If true and missing, transformation will generate error
  required: {
    type: Boolean,
    default: false
  },

  // User notes about this field (optional documentation)
  description: String

}, { _id: false }); // Don't create separate _id for sub-documents

// ========== MAIN FD SCHEMA ==========
// Represents ONE COBOL File Description (the entire file blueprint)
const fdSchema = new Schema({
  // File/schema name (e.g., "EMPLOYEE", "TRANSACTION", "CUSTOMER")
  // Must be unique in database
  // Will be used in COBOL copybook: "01  EMPLOYEE."
  name: {
    type: String,
    required: [true, 'Schema name is required'],
    trim: true,
    unique: true,
    minlength: [1, 'Name cannot be empty'],
    maxlength: [30, 'Name cannot exceed 30 characters'],
    uppercase: true // COBOL convention: uppercase
  },

  // Optional description of file
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Array of field definitions
  // Each schema must have at least 1 field
  fields: {
    type: [fieldSchema],
    required: [true, 'At least one field is required'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Schema must have at least one field'
    }
  },

  // Total record length (auto-calculated by pre-save hook)
  // Sum of all field lengths
  // Example: 5 + 20 + 9 = 34 bytes per record
  // Used by Phase 2 to validate fixed-width line length
  recordLength: {
    type: Number,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'recordLength must be an integer'
    }
  },

  // GnuCOBOL compilation and validation results (added in Phase 3)
  validationResults: {
    // null = not yet validated, true = passed, false = failed
    compileSuccess: {
      type: Boolean,
      default: null
    },
    // How long compilation took (milliseconds)
    compileTimeMs: Number,
    // Array of error messages from COBOL compiler
    compileErrors: [String],
    // When was it compiled
    compiledAt: Date
  },

  // Timestamp when created
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Timestamp when last updated
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ========== PRE-SAVE HOOK ==========
/**
 * Mongoose pre-save hook:
 * Runs automatically BEFORE document is saved to MongoDB
 * 
 * Validates schema and calculates:
 * - Field positions (startPos)
 * - Field lengths (from PIC clause)
 * - Total record length
 * - Field types (auto-detect)
 * - Padding rules (left/right, 0/space)
 * 
 * If any validation fails, save is rejected and error is passed to caller
 */
fdSchema.pre('save', async function(next) {
  try {
    console.log(`📋 Processing FD Schema: ${this.name}`);

    let currentPos = 1;  // COBOL uses 1-based indexing
    let totalLength = 0;

    // ========== VALIDATE AND CALCULATE EACH FIELD ==========
    this.fields.forEach((field, index) => {
      // If field doesn't have a sourceKey, default to field name (lowercase)
      if (!field.sourceKey) {
        field.sourceKey = field.name.toLowerCase();
      }

      // Parse the PIC clause to extract structure
      try {
        const parsed = picParser.parsePIC(field.picClause);

        // Validate parser output
        if (!parsed || !parsed.length) {
          throw new Error(`PIC parser returned invalid result for "${field.picClause}"`);
        }

        if (parsed.length <= 0) {
          throw new Error(`Field length must be > 0, got ${parsed.length}`);
        }

        // ========== SET AUTO-CALCULATED VALUES ==========
        // Position in fixed-width line
        field.startPos = currentPos;

        // Field length in bytes
        field.length = parsed.length;

        // Number of decimal places (if applicable)
        field.decimals = parsed.decimals || 0;

        // Data type (auto-detected from PIC)
        field.type = parsed.type;

        // Padding rules (auto-determined from type)
        if (parsed.type === 'numeric' || parsed.type === 'decimal' || parsed.type === 'signed' || parsed.type === 'comp3') {
          field.paddingDirection = 'left';
          field.paddingChar = '0';
        } else {
          // Alphanumeric, alphabetic
          field.paddingDirection = 'right';
          field.paddingChar = ' ';
        }

        // ========== LOG FIELD INFO ==========
        console.log(`   Field ${index}: ${field.name.padEnd(15)} PIC=${field.picClause.padEnd(12)} type=${field.type.padEnd(12)} len=${String(field.length).padEnd(3)} pos=${field.startPos}`);

        // ========== UPDATE ACCUMULATORS ==========
        currentPos += field.length;
        totalLength += field.length;

      } catch (err) {
        // Re-throw with field context
        throw new Error(`Field ${index} (${field.name}): ${err.message}`);
      }
    });

    // ========== SET TOTAL RECORD LENGTH ==========
    this.recordLength = totalLength;
    console.log(`✓ Schema saved: ${this.fields.length} fields, ${this.recordLength} bytes total record length\n`);

    next(); // Continue to actual save

  } catch (err) {
    console.error(`❌ FD Schema validation failed: ${err.message}\n`);
    // Pass error to save handler so it's returned to caller
    next(err);
  }
});

// ========== POST-UPDATE MIDDLEWARE ==========
/**
 * Update the `updatedAt` timestamp whenever document is modified
 */
fdSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// ========== EXPORT MODEL ==========
/**
 * Create and export the Mongoose model
 * 
 * Usage in other files:
 * const FDSchema = require('./models/FDSchema');
 * 
 * Create new schema:
 * await FDSchema.create({ name: 'EMPLOYEE', fields: [...] });
 * 
 * Retrieve schema:
 * const schema = await FDSchema.findById(id);
 * 
 * Update schema:
 * await FDSchema.findByIdAndUpdate(id, { description: "new desc" });
 * 
 * Delete schema:
 * await FDSchema.findByIdAndDelete(id);
 */
module.exports = mongoose.model('FDSchema', fdSchema);
