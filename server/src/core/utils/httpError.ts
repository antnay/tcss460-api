export interface ErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
}

export class ApiError {
  /**
   * Create a standardized error response
   */
  static createResponse(statusCode: number, message: string): ErrorResponse {
    return {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create an internal server error response and log it
   */
  static internalError(error: unknown): ErrorResponse {
    // Log the actual error for debugging
    console.error('[Internal Server Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return this.createResponse(500, 'internal server error');
  }

  static badRequest(message: string = 'Bad request'): ErrorResponse {
    return this.createResponse(400, message);
  }

  static unauthorized(message: string = 'Unauthorized'): ErrorResponse {
    return this.createResponse(401, message);
  }

  static forbidden(message: string = 'Forbidden'): ErrorResponse {
    return this.createResponse(403, message);
  }

  static notFound(message: string = 'Not found'): ErrorResponse {
    return this.createResponse(404, message);
  }
}