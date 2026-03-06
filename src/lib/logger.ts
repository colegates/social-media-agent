import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info');

export const logger = pino(
  {
    level: logLevel,
    base: {
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version ?? '0.1.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'passwordHash',
        'token',
        'accessToken',
        'refreshToken',
        'apiKey',
        'secret',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.apiKey',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  },
  isDevelopment
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      })
    : undefined
);
