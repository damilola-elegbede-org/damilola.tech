/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { apiSuccess, apiError, ErrorCodes, Errors } from '@/lib/api-response';

describe('api-response module', () => {
  describe('apiSuccess', () => {
    it('returns 200 status', async () => {
      const response = apiSuccess({ foo: 'bar' });
      expect(response.status).toBe(200);
    });

    it('includes success: true in response body', async () => {
      const response = apiSuccess({ foo: 'bar' });
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('includes data field in response body', async () => {
      const testData = { id: 1, name: 'Test' };
      const response = apiSuccess(testData);
      const data = await response.json();
      expect(data.data).toEqual(testData);
    });

    it('includes meta when provided', async () => {
      const testData = { id: 1 };
      const meta = { environment: 'production', pagination: { cursor: 'abc', hasMore: true } };
      const response = apiSuccess(testData, meta);
      const data = await response.json();
      expect(data.meta).toEqual(meta);
    });

    it('omits meta field when not provided', async () => {
      const response = apiSuccess({ id: 1 });
      const data = await response.json();
      expect(data.meta).toBeUndefined();
    });

    it('handles complex nested data', async () => {
      const complexData = {
        users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        stats: { total: 2, active: 1 },
      };
      const response = apiSuccess(complexData);
      const data = await response.json();
      expect(data.data).toEqual(complexData);
    });

    it('handles null data', async () => {
      const response = apiSuccess(null);
      const data = await response.json();
      expect(data.data).toBeNull();
    });

    it('handles array data', async () => {
      const arrayData = [1, 2, 3];
      const response = apiSuccess(arrayData);
      const data = await response.json();
      expect(data.data).toEqual(arrayData);
    });
  });

  describe('apiError', () => {
    it('returns specified status code', async () => {
      const response = apiError('TEST_ERROR', 'Test message', 400);
      expect(response.status).toBe(400);
    });

    it('defaults to 400 status when not specified', async () => {
      const response = apiError('TEST_ERROR', 'Test message');
      expect(response.status).toBe(400);
    });

    it('includes success: false in response body', async () => {
      const response = apiError('TEST_ERROR', 'Test message', 500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('includes error.code in response body', async () => {
      const response = apiError('CUSTOM_CODE', 'Test message', 400);
      const data = await response.json();
      expect(data.error.code).toBe('CUSTOM_CODE');
    });

    it('includes error.message in response body', async () => {
      const response = apiError('TEST_ERROR', 'Custom error message', 400);
      const data = await response.json();
      expect(data.error.message).toBe('Custom error message');
    });

    it('handles different status codes correctly', async () => {
      const statusCodes = [400, 401, 403, 404, 500, 503];
      for (const status of statusCodes) {
        const response = apiError('TEST', 'Test', status);
        expect(response.status).toBe(status);
      }
    });
  });

  describe('ErrorCodes', () => {
    it('defines expected error codes', () => {
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });

  describe('Errors helpers', () => {
    describe('unauthorized', () => {
      it('returns 401 status', async () => {
        const response = Errors.unauthorized();
        expect(response.status).toBe(401);
      });

      it('uses UNAUTHORIZED error code', async () => {
        const response = Errors.unauthorized();
        const data = await response.json();
        expect(data.error.code).toBe('UNAUTHORIZED');
      });

      it('uses default message when not provided', async () => {
        const response = Errors.unauthorized();
        const data = await response.json();
        expect(data.error.message).toBe('Authentication required.');
      });

      it('uses custom message when provided', async () => {
        const response = Errors.unauthorized('Custom auth message');
        const data = await response.json();
        expect(data.error.message).toBe('Custom auth message');
      });
    });

    describe('forbidden', () => {
      it('returns 403 status', async () => {
        const response = Errors.forbidden();
        expect(response.status).toBe(403);
      });

      it('uses FORBIDDEN error code', async () => {
        const response = Errors.forbidden();
        const data = await response.json();
        expect(data.error.code).toBe('FORBIDDEN');
      });

      it('uses default message when not provided', async () => {
        const response = Errors.forbidden();
        const data = await response.json();
        expect(data.error.message).toBe('Access denied.');
      });

      it('uses custom message when provided', async () => {
        const response = Errors.forbidden('No permission');
        const data = await response.json();
        expect(data.error.message).toBe('No permission');
      });
    });

    describe('notFound', () => {
      it('returns 404 status', async () => {
        const response = Errors.notFound();
        expect(response.status).toBe(404);
      });

      it('uses NOT_FOUND error code', async () => {
        const response = Errors.notFound();
        const data = await response.json();
        expect(data.error.code).toBe('NOT_FOUND');
      });

      it('uses default message when not provided', async () => {
        const response = Errors.notFound();
        const data = await response.json();
        expect(data.error.message).toBe('Resource not found.');
      });

      it('uses custom message when provided', async () => {
        const response = Errors.notFound('User not found');
        const data = await response.json();
        expect(data.error.message).toBe('User not found');
      });
    });

    describe('badRequest', () => {
      it('returns 400 status', async () => {
        const response = Errors.badRequest();
        expect(response.status).toBe(400);
      });

      it('uses BAD_REQUEST error code', async () => {
        const response = Errors.badRequest();
        const data = await response.json();
        expect(data.error.code).toBe('BAD_REQUEST');
      });

      it('uses default message when not provided', async () => {
        const response = Errors.badRequest();
        const data = await response.json();
        expect(data.error.message).toBe('Invalid request.');
      });

      it('uses custom message when provided', async () => {
        const response = Errors.badRequest('Missing field');
        const data = await response.json();
        expect(data.error.message).toBe('Missing field');
      });
    });

    describe('validationError', () => {
      it('returns 400 status', async () => {
        const response = Errors.validationError('Invalid email');
        expect(response.status).toBe(400);
      });

      it('uses VALIDATION_ERROR error code', async () => {
        const response = Errors.validationError('Invalid email');
        const data = await response.json();
        expect(data.error.code).toBe('VALIDATION_ERROR');
      });

      it('uses provided message', async () => {
        const response = Errors.validationError('Email format invalid');
        const data = await response.json();
        expect(data.error.message).toBe('Email format invalid');
      });
    });

    describe('internalError', () => {
      it('returns 500 status', async () => {
        const response = Errors.internalError();
        expect(response.status).toBe(500);
      });

      it('uses INTERNAL_ERROR error code', async () => {
        const response = Errors.internalError();
        const data = await response.json();
        expect(data.error.code).toBe('INTERNAL_ERROR');
      });

      it('uses default message when not provided', async () => {
        const response = Errors.internalError();
        const data = await response.json();
        expect(data.error.message).toBe('An unexpected error occurred.');
      });

      it('uses custom message when provided', async () => {
        const response = Errors.internalError('Database error');
        const data = await response.json();
        expect(data.error.message).toBe('Database error');
      });
    });

    describe('rateLimited', () => {
      it('returns 429 status', async () => {
        const response = Errors.rateLimited(60);
        expect(response.status).toBe(429);
      });

      it('uses RATE_LIMITED error code', async () => {
        const response = Errors.rateLimited(60);
        const data = await response.json();
        expect(data.error.code).toBe('RATE_LIMITED');
      });

      it('includes Retry-After header', () => {
        const response = Errors.rateLimited(60);
        expect(response.headers.get('Retry-After')).toBe('60');
      });

      it('uses different Retry-After values', () => {
        const response30 = Errors.rateLimited(30);
        const response120 = Errors.rateLimited(120);
        expect(response30.headers.get('Retry-After')).toBe('30');
        expect(response120.headers.get('Retry-After')).toBe('120');
      });

      it('includes standard rate limit message', async () => {
        const response = Errors.rateLimited(60);
        const data = await response.json();
        expect(data.error.message).toBe('Too many requests. Please try again later.');
      });

      it('includes success: false', async () => {
        const response = Errors.rateLimited(60);
        const data = await response.json();
        expect(data.success).toBe(false);
      });
    });
  });
});
