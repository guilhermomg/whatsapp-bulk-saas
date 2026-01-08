import winston from 'winston';
import config from './index';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = (): string => {
  const env = config.env || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const {
      timestamp, level: logLevel, message, ...meta
    } = info;
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${logLevel}: ${message}${metaStr}`;
  }),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: `${config.logging.filePath}/error.log`,
    level: 'error',
  }),
  new winston.transports.File({ filename: `${config.logging.filePath}/all.log` }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
