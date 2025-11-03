// server/src/middleware/apiKeyValidation.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';

/**
 * Zod schema for API key generation request
 * 
 * Validation Rules:
 * - name: Required, 1-255 characters, trimmed
 * - email: Optional, valid email format if provided, trimmed
 */
const generateApiKeySchema = z.object({
    name: z.string({
        error: "Name is required",
    })
        .min(1, "Name must be at least 1 character")
        .max(255, "Name must not exceed 255 characters")
        .trim()
        .transform(val => val.replace(/\s+/g, ' ')), // Normalize whitespace

    email: z.email()
        .max(255, "Email must not exceed 255 characters")
        .trim()
        .toLowerCase()
        .optional()
        .or(z.literal('')) // Allow empty string
        .transform(val => val === '' ? undefined : val) // Convert empty string to undefined
});

/**
 * Middleware to validate API key generation request
 * 
 * Validates the request body against generateApiKeySchema
 * If validation fails, returns 400 with detailed error messages
 * If validation succeeds, continues to the next middleware/controller
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateGenerateApiKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Validate request body
        const validation = generateApiKeySchema.safeParse(req.body);

        if (!validation.success) {
            // Extract validation errors
            const errors = validation.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message
            }));

            res.status(HttpStatus.BAD_REQUEST).json(
                ApiError.badRequest(errors)
            );
            return;
        }

        // Replace request body with validated and transformed data
        req.body = validation.data;

        // Continue to next middleware/controller
        next();
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Validation processing failed')
        );
    }
};

/**
 * Zod schema for API key authentication header
 */
const apiKeyAuthSchema = z.object({
    'x-api-key': z.string()
        .min(32, "Invalid API key format")
        .max(64, "Invalid API key format")
});

/**
 * Middleware to validate API key from request headers
 * 
 * Checks for X-API-Key header and validates format
 * This middleware only validates the format, not whether the key exists/is valid
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateApiKeyHeader = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            res.status(HttpStatus.UNAUTHORIZED).json(
                ApiError.unauthorized('API key is required. Provide X-API-Key header.')
            );
            return;
        }

        const validation = apiKeyAuthSchema.safeParse({
            'x-api-key': apiKey
        });

        if (!validation.success) {
            res.status(HttpStatus.UNAUTHORIZED).json(
                ApiError.unauthorized('Invalid API key format')
            );
            return;
        }

        next();
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('API key validation failed')
        );
    }
};

// Export schema for testing purposes
export { generateApiKeySchema };