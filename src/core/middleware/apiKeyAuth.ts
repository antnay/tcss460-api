// server/src/middleware/apiKeyAuth.ts

import { Request, Response, NextFunction } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import crypto from 'crypto';

/**
 * Extended Request interface to include API key information
 */
export interface ApiKeyRequest extends Request {
    apiKey?: {
        api_key_id: number;
        name: string;
        email: string | null;
        rate_limit: number;
    };
}

/**
 * Hash an API key using SHA-256
 * This is the same hashing used when storing keys in the database
 * 
 * @param apiKey - The plain text API key
 * @returns Hashed API key (hex string)
 */
const hashApiKey = (apiKey: string): string => {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Middleware to authenticate requests using API key
 * 
 * Process:
 * 1. Extract X-API-Key header
 * 2. Hash the provided key
 * 3. Look up hashed key in database
 * 4. Verify key is active and not expired
 * 5. Check rate limiting (optional)
 * 6. Update last_used_at timestamp
 * 7. Log usage (optional)
 * 
 * @param req - Express request object (extended with apiKey property)
 * @param res - Express response object
 * @param next - Express next function
 */
export const requireApiKey = async (
    req: ApiKeyRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Extract API key from header
        const providedKey = req.headers['x-api-key'] as string;
        // console.log(req.headers);
        

        if (!providedKey) {
            res.status(HttpStatus.UNAUTHORIZED).json(
                ApiError.unauthorized('API key is required. Include X-API-Key header.')
            );
            return;
        }

        // Hash the provided key to compare with stored hash
        const hashedKey = hashApiKey(providedKey);

        // Look up API key in database
        const query = `
      SELECT 
        api_key_id,
        name,
        email,
        rate_limit,
        is_active,
        expires_at,
        last_used_at
      FROM api_keys
      WHERE api_key = $1
    `;

        const result = await pool.query(query, [hashedKey]);

        // Check if key exists
        if (result.rows.length === 0) {
            res.status(HttpStatus.UNAUTHORIZED).json(
                ApiError.unauthorized('Invalid API key')
            );
            return;
        }

        const keyData = result.rows[0];

        // Check if key is active
        if (!keyData.is_active) {
            res.status(HttpStatus.FORBIDDEN).json(
                ApiError.forbidden('API key has been revoked')
            );
            return;
        }

        // Check if key is expired
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            res.status(HttpStatus.FORBIDDEN).json(
                ApiError.forbidden('API key has expired')
            );
            return;
        }

        // Optional: Check rate limiting
        const rateLimitOk = await checkRateLimit(keyData.api_key_id, keyData.rate_limit);
        if (!rateLimitOk) {
            res.status(HttpStatus.TOO_MANY_REQUESTS).json({
                statusCode: 429,
                message: 'Rate limit exceeded. Please try again later.',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Update last_used_at timestamp (fire and forget)
        updateLastUsed(keyData.api_key_id).catch(err =>
            console.error('Failed to update last_used_at:', err)
        );

        // Log usage (fire and forget)
        logApiKeyUsage(
            keyData.api_key_id,
            req.path,
            req.method,
            req.ip,
            req.headers['user-agent']
        ).catch(err =>
            console.error('Failed to log API key usage:', err)
        );

        // Attach API key info to request for use in controllers
        req.apiKey = {
            api_key_id: keyData.api_key_id,
            name: keyData.name,
            email: keyData.email,
            rate_limit: keyData.rate_limit
        };

        // Continue to next middleware/controller
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Authentication failed')
        );
    }
};

/**
 * Check if API key has exceeded its rate limit
 * 
 * @param apiKeyId - The API key ID
 * @param rateLimit - Maximum requests per hour
 * @returns true if under limit, false if exceeded
 */
const checkRateLimit = async (
    apiKeyId: number,
    rateLimit: number
): Promise<boolean> => {
    try {
        const query = `
      SELECT COUNT(*) as request_count
      FROM api_key_usage
      WHERE api_key_id = $1
        AND requested_at > NOW() - INTERVAL '1 hour'
    `;

        const result = await pool.query(query, [apiKeyId]);
        const requestCount = parseInt(result.rows[0].request_count, 10);

        return requestCount < rateLimit;
    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Fail open - allow request if rate limit check fails
        return true;
    }
};

/**
 * Update the last_used_at timestamp for an API key
 * 
 * @param apiKeyId - The API key ID
 */
const updateLastUsed = async (apiKeyId: number): Promise<void> => {
    const query = `
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE api_key_id = $1
  `;

    await pool.query(query, [apiKeyId]);
};

/**
 * Log API key usage for analytics and auditing
 * 
 * @param apiKeyId - The API key ID
 * @param endpoint - The requested endpoint
 * @param method - HTTP method
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
const logApiKeyUsage = async (
    apiKeyId: number,
    endpoint: string,
    method: string,
    ipAddress?: string,
    userAgent?: string
): Promise<void> => {
    const query = `
    INSERT INTO api_key_usage (
      api_key_id,
      endpoint,
      method,
      ip_address,
      user_agent
    ) VALUES ($1, $2, $3, $4, $5)
  `;

    await pool.query(query, [
        apiKeyId,
        endpoint,
        method,
        ipAddress || null,
        userAgent || null
    ]);
};

/**
 * Optional middleware: Require API key OR JWT token
 * Allows either authentication method
 * 
 * Use this when you want to support both API keys and JWT authentication
 */
export const requireApiKeyOrJWT = async (
    req: ApiKeyRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // Check if JWT token is present
    const authHeader = req.headers.authorization;
    const hasJWT = authHeader && authHeader.startsWith('Bearer ');

    // Check if API key is present
    const hasApiKey = req.headers['x-api-key'];

    if (hasJWT) {
        // Let JWT authentication middleware handle it
        next();
    } else if (hasApiKey) {
        // Use API key authentication
        await requireApiKey(req, res, next);
    } else {
        res.status(HttpStatus.UNAUTHORIZED).json(
            ApiError.unauthorized('Authentication required. Provide either Bearer token or X-API-Key header.')
        );
    }
};

// Export the hash function for use in the generation controller
export { hashApiKey };