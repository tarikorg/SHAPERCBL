/**
 * Metrics Collection Service
 * 
 * Logs all transformation events with detailed metrics
 * Used for research data collection and performance monitoring
 * 
 * Data collected:
 * - Timestamp (ISO 8601)
 * - Input format (JSON/CSV/XML)
 * - Record count
 * - Field count
 * - Duration (milliseconds)
 * - Errors and warnings
 * - Output size (bytes)
 * 
 * All metrics persisted to disk (JSONL format) for later analysis
 * In production, would also write to MongoDB and external analytics
 */

const fs = require('fs');
const path = require('path');

// In-memory metrics buffer (before persisting to disk)
let metricsBuffer = [];
const MAX_BUFFER_SIZE = 100;  // Flush to disk every 100 metrics

// Path to metrics log file (JSONL format)
const METRICS_LOG_FILE = path.join(__dirname, '../../research/data/metrics.jsonl');

/**
 * Initialize metrics service
 * Creates directories and log file if they don't exist
 * Called at server startup
 */
function initialize() {
    console.log('📊 Initializing metrics collection...');

    // Ensure research/data directory exists
    const researchDataDir = path.join(__dirname, '../../research/data');
    if (!fs.existsSync(researchDataDir)) {
        fs.mkdirSync(researchDataDir, { recursive: true });
        console.log(`   Created directory: ${researchDataDir}`);
    }

    // Create metrics log file if not exists
    if (!fs.existsSync(METRICS_LOG_FILE)) {
        fs.writeFileSync(METRICS_LOG_FILE, '', 'utf8');
        console.log(`   Created metrics log: ${path.basename(METRICS_LOG_FILE)}`);
    }

    console.log('✓ Metrics collection ready');
}

/**
 * Log a transformation metric
 * 
 * Example:
 * logMetric({
 *   type: 'transform',
 *   durationMs: 1250,
 *   recordsProcessed: 100,
 *   fieldsCount: 5,
 *   inputFormat: 'json',
 *   errors: [],
 *   warnings: ['Field SALARY truncated for record 3'],
 *   outputSizeBytes: 2048
 * });
 * 
 * @param {Object} metric - Metric object
 * @param {string} metric.type - Operation type (transform, validate, parse)
 * @param {number} metric.durationMs - Operation duration in milliseconds
 * @param {number} metric.recordsProcessed - Number of records processed
 * @param {number} metric.fieldsCount - Number of fields in schema
 * @param {string} metric.inputFormat - Input format (json/csv/xml)
 * @param {array} metric.errors - Array of error messages
 * @param {array} metric.warnings - Array of warning messages
 * @param {number} metric.outputSizeBytes - Output file size
 * @returns {Object} Enhanced metric with timestamp
 */
function logMetric(metric) {
    // Add standard metadata
    const enhancedMetric = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        ...metric
    };

    // Add to in-memory buffer
    metricsBuffer.push(enhancedMetric);

    // Flush to disk if buffer exceeds threshold
    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
        flushMetrics();
    }

    return enhancedMetric;
}

/**
 * Flush buffered metrics to disk
 * Writes to JSONL file (one JSON object per line)
 * Format: each line is a complete JSON object
 * 
 * Example file content:
 * {"timestamp":"2026-03-23T12:34:56.789Z","type":"transform","durationMs":1250,...}
 * {"timestamp":"2026-03-23T12:34:57.234Z","type":"transform","durationMs":980,...}
 * 
 * JSONL is ideal because:
 * - Each line is independently parseable
 * - Easy to stream for analysis
 * - Can append without re-writing entire file
 * - Works well with pandas, jq, line-based tools
 */
function flushMetrics() {
    if (metricsBuffer.length === 0) return;

    try {
        // Convert each metric to JSON and join with newlines
        const linesToWrite = metricsBuffer
            .map(m => JSON.stringify(m))
            .join('\n') + '\n';

        // Append to file (not overwrite)
        fs.appendFileSync(METRICS_LOG_FILE, linesToWrite, 'utf8');

        console.log(`✓ Flushed ${metricsBuffer.length} metrics to disk`);

        // Clear buffer after successful flush
        metricsBuffer = [];
    } catch (err) {
        console.error('❌ Failed to flush metrics to disk:', err.message);
        // Don't clear buffer on error - retry next flush
    }
}

/**
 * Get summary statistics from buffered metrics
 * (Full aggregation happens in Phase 8 from database)
 * 
 * @returns {Object} Summary statistics
 */
function getSummary() {
    // In early phases: return basic info
    // In Phase 8: implement full aggregation from MongoDB

    const totalInBuffer = metricsBuffer.length;

    return {
        metricsInBuffer: totalInBuffer,
        logFile: path.basename(METRICS_LOG_FILE),
        logPath: METRICS_LOG_FILE,
        collectingSince: new Date().toISOString(),
        status: 'active'
    };
}

/**
 * Manually flush metrics on demand (called before shutdown)
 */
function shutdown() {
    console.log('📊 Shutting down metrics collector...');
    flushMetrics();
    console.log('✓ Metrics saved');
}

module.exports = {
    initialize,
    logMetric,
    flushMetrics,
    getSummary,
    shutdown
};
