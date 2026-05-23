/**
 * Logger utility for development debugging
 * Provides structured logging with color-coded output
 */

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogConfig {
  enabled: boolean;
  logLevel: LogLevel[];
}

const config: LogConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: ['info', 'warn', 'error', 'success', 'debug'],
};

const styles = {
  info: 'color: #3b82f6; font-weight: bold',
  warn: 'color: #f59e0b; font-weight: bold',
  error: 'color: #ef4444; font-weight: bold',
  success: 'color: #10b981; font-weight: bold',
  debug: 'color: #8b5cf6; font-weight: bold',
};

const icons = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  debug: '🔍',
};

function shouldLog(level: LogLevel): boolean {
  return config.enabled && config.logLevel.includes(level);
}

function formatMessage(level: LogLevel, message: string, data?: any): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toLocaleTimeString('vi-VN');
  const icon = icons[level];
  const style = styles[level];

  console.groupCollapsed(
    `%c${icon} [${level.toUpperCase()}] ${timestamp} - ${message}`,
    style
  );

  if (data) {
    if (typeof data === 'object') {
      console.table(data);
      console.log('Raw data:', data);
    } else {
      console.log(data);
    }
  }

  console.trace('Stack trace');
  console.groupEnd();
}

export const logger = {
  info: (message: string, data?: any) => {
    formatMessage('info', message, data);
  },

  warn: (message: string, data?: any) => {
    formatMessage('warn', message, data);
  },

  error: (message: string, data?: any) => {
    formatMessage('error', message, data);
  },

  success: (message: string, data?: any) => {
    formatMessage('success', message, data);
  },

  debug: (message: string, data?: any) => {
    formatMessage('debug', message, data);
  },

  // Special method for API calls
  api: (method: string, url: string, data?: any) => {
    if (!shouldLog('info')) return;

    console.group(`🌐 API ${method} ${url}`);
    if (data) {
      console.log('Request data:', data);
    }
    console.groupEnd();
  },

  // Special method for API responses
  apiResponse: (url: string, status: number, data?: any) => {
    const level = status >= 400 ? 'error' : 'success';
    if (!shouldLog(level)) return;

    const icon = status >= 400 ? '❌' : '✅';
    console.group(`${icon} API Response ${status} - ${url}`);
    if (data) {
      console.log('Response data:', data);
    }
    console.groupEnd();
  },
};
