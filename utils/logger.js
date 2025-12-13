const winston = require('winston');
const path = require('path');
require('dotenv').config();

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'noty-app' },
  transports: [
    // Error log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Automation log
    new winston.transports.File({
      filename: path.join(logDir, 'automation.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: combine(
        winston.format.label({ label: 'AUTOMATION' }),
        timestamp(),
        json()
      )
    })
  ]
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      simple()
    )
  }));
}

module.exports = logger;