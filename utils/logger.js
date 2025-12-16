const winston = require('winston');
const path = require('path');
require('dotenv').config();

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const TIME_ZONE = process.env.TZ || 'America/Sao_Paulo';
const formatTimestamp = () => {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date());
    return s.replace(' ', 'T');
  } catch (e) {
    return new Date().toISOString();
  }
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: formatTimestamp }),
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
        timestamp({ format: formatTimestamp }),
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
      timestamp({ format: formatTimestamp }),
      printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    )
  }));
}

module.exports = logger;