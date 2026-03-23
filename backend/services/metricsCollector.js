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
 * All metrics persisted to MongoDB for later analysis
 */

const fs = require('fs');
const path = require('path');

// In-memory metrics buffer (before persisting to DB)
let metricsBuffer = [];
const MAX_BUFFER_SIZE = 100;  // Flush to DB every 100 metrics
const METRICS_LOG_FILE = path.join(__dirname, '../../research/data/metrics.jsonl');

/**
 * Initialize metrics service
 * Creates log file if doesn't exist
 */
function initialize() {
    console.log('📊 Initializing metrics collection...');

    // Ensure research/data directory exists
    const researchDataDir = path.join(__dirname, '../../research/data');
    if (!fs.existsSync(researchDataDir)) {
        fs.mkdirSync(researchDataDir, { recursive: true });
        console.log(`   Created directory: ${researchDataDir}`);
    }

    // Create metrics file if not exists
    if (!fs.existsSync(METRICS_LOG_FILE)) {
        fs.writeFileSync(METRICS_LOG_FILE, '', 'utf8');
        console.log(`   Created metrics log: ${METRICS_LOG_FILE}`);
    }

    console.log('✓ Metrics collection ready');
}

/**
 * Log a transformation metric
 * @param {Object} metric - Metric object
 * @param {string} metric.type - Type of operation (transform, validate, parse)
 * @param {number} metric.durationMs - Operation duration
 * @param {number} metric.recordsProcessed - Number of records
 * @param {number} metric.fieldsCount - Number of fields
 * @param {string} metric.inputFormat - Input format (json/csv/xml)
 * @param {array} metric.errors - Errors encountered
 * @param {array} metric.warnings - Warnings encountered
 * @param {number} metric.outputSizeBytes - Output file size
 */
function logMetric(metric) {
    // Add metadata
    const enhancedMetric = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        ...metric
    };

    // Add to buffer
    metricsBuffer.push(enhancedMetric);

    // Flush to file if buffer full
    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
        flushMetrics();
    }

    return enhancedMetric;
}

/**
 * Flush buffered metrics to file
 */
function flushMetrics() {
    if (metricsBuffer.length === 0) return;

    try {
        const linesToWrite = metricsBuffer
            .map(m => JSON.stringify(m))
            .join('\n') + '\n';

        fs.appendFileSync(METRICS_LOG_FILE, linesToWrite, 'utf8');
        console.log(`✓ Flushed ${metricsBuffer.length} metrics to ${path.basename(METRICS_LOG_FILE)}`);

        metricsBuffer = [];  // Clear buffer
    } catch (err) {
        console.error('❌ Failed to flush metrics:', err.message);
    }
}

/**
 * Get summary statistics
 * @returns {Object} Summary stats (count, avg duration, etc.)
 */
function getSummary() {
    // In Phase 1: return empty summary
    // In Phase 8: read from DB, aggregate metrics
    return {
        totalTransformations: 0,
        averageDurationMs: 0,
        successRate: 100,
        collectingSince: new Date().toISOString()
    };
}

module.exports = {
    initialize,
    logMetric,
    flushMetrics,
    getSummary
};
