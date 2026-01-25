/**
 * Error Classifier Tests
 *
 * Tests the error classification and logging system
 */

import { describe, it, expect } from '@jest/globals';
import {
  classifyError,
  extractErrorMessage,
  isRetryable,
  getRetryDelay,
  getBrandErrorInsights,
} from '../error-classifier';

describe('Error Classifier', () => {
  describe('classifyError', () => {
    it('should classify credentials errors', () => {
      expect(classifyError('Invalid credentials')).toBe('credentials');
      expect(classifyError('Authentication failed')).toBe('credentials');
      expect(classifyError('Invalid email or password')).toBe('credentials');
      expect(classifyError({ message: 'Login failed' })).toBe('credentials');
      expect(classifyError(new Error('Unauthorized'), 401)).toBe('credentials');
    });

    it('should classify network errors', () => {
      expect(classifyError('Network error')).toBe('network');
      expect(classifyError('Connection refused')).toBe('network');
      expect(classifyError('ECONNREFUSED')).toBe('network');
      expect(classifyError('Fetch failed')).toBe('network');
      expect(classifyError('Timeout')).toBe('network');
    });

    it('should classify offline errors', () => {
      expect(classifyError('Controller is offline')).toBe('offline');
      expect(classifyError('Device offline')).toBe('offline');
      expect(classifyError('Unreachable')).toBe('offline');
      expect(classifyError({ message: 'Not connected' })).toBe('offline');
      expect(classifyError(new Error('Controller not found'), 503)).toBe('offline');
    });

    it('should classify rate limit errors', () => {
      expect(classifyError('Rate limit exceeded')).toBe('rate_limit');
      expect(classifyError('Too many requests')).toBe('rate_limit');
      expect(classifyError({ message: 'Throttled' }, 429)).toBe('rate_limit');
    });

    it('should classify server errors', () => {
      expect(classifyError('Internal server error')).toBe('server');
      expect(classifyError({ message: 'Service unavailable' }, 503)).toBe('server');
      expect(classifyError(new Error('Something went wrong'), 500)).toBe('server');
    });

    it('should default to server error for unknown errors', () => {
      expect(classifyError('Something random happened')).toBe('server');
      expect(classifyError({ message: 'Unknown error' })).toBe('server');
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract message from string', () => {
      expect(extractErrorMessage('Error message')).toBe('Error message');
    });

    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      expect(extractErrorMessage(error)).toBe('Test error');
    });

    it('should extract message from error object with error property', () => {
      expect(extractErrorMessage({ error: 'API error' })).toBe('API error');
    });

    it('should extract message from error object with message property', () => {
      expect(extractErrorMessage({ message: 'Failed request' })).toBe('Failed request');
    });

    it('should provide default message for empty errors', () => {
      expect(extractErrorMessage({})).toBe('An unexpected error occurred');
    });
  });

  describe('isRetryable', () => {
    it('should mark retryable error types', () => {
      expect(isRetryable('network')).toBe(true);
      expect(isRetryable('offline')).toBe(true);
      expect(isRetryable('rate_limit')).toBe(true);
      expect(isRetryable('server')).toBe(true);
    });

    it('should mark non-retryable error types', () => {
      expect(isRetryable('credentials')).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return correct delays for each error type', () => {
      expect(getRetryDelay('credentials')).toBe(0);
      expect(getRetryDelay('network')).toBe(5);
      expect(getRetryDelay('offline')).toBe(30);
      expect(getRetryDelay('rate_limit')).toBe(60);
      expect(getRetryDelay('server')).toBe(30);
    });
  });

  describe('getBrandErrorInsights', () => {
    it('should provide AC Infinity insights', () => {
      const insights = getBrandErrorInsights('credentials', 'ac_infinity');
      expect(insights.commonCauses.length).toBeGreaterThan(0);
      expect(insights.quickFixes.length).toBeGreaterThan(0);
    });

    it('should provide Ecowitt insights', () => {
      const insights = getBrandErrorInsights('offline', 'ecowitt');
      expect(insights.commonCauses.length).toBeGreaterThan(0);
      expect(insights.quickFixes.length).toBeGreaterThan(0);
    });

    it('should return empty insights for unsupported brands', () => {
      const insights = getBrandErrorInsights('credentials', 'custom');
      expect(insights.commonCauses).toEqual([]);
      expect(insights.quickFixes).toEqual([]);
    });

    it('should return empty insights when brand is not provided', () => {
      const insights = getBrandErrorInsights('credentials');
      expect(insights.commonCauses).toEqual([]);
      expect(insights.quickFixes).toEqual([]);
    });
  });
});
