/**
 * Standardized API response helpers for v1 external API.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    environment?: string;
    pagination?: {
      cursor?: string;
      hasMore?: boolean;
    };
    [key: string]: unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Create a successful API response.
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiSuccessResponse<T>['meta']
): Response {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return Response.json(response);
}

/**
 * Create an error API response.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400
): Response {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return Response.json(response, { status });
}

/**
 * Common error codes for consistent API responses.
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Create common error responses.
 */
export const Errors = {
  unauthorized: (message = 'Authentication required.') =>
    apiError(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Access denied.') =>
    apiError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (message = 'Resource not found.') =>
    apiError(ErrorCodes.NOT_FOUND, message, 404),

  badRequest: (message = 'Invalid request.') =>
    apiError(ErrorCodes.BAD_REQUEST, message, 400),

  validationError: (message: string) =>
    apiError(ErrorCodes.VALIDATION_ERROR, message, 400),

  rateLimited: (retryAfter: number) =>
    Response.json(
      {
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    ),

  internalError: (message = 'An unexpected error occurred.') =>
    apiError(ErrorCodes.INTERNAL_ERROR, message, 500),
};
