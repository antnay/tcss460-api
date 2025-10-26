/**
 * API Key Generation Utilities
 *
 * Provides functions for generating and validating API keys for authentication.
 * Uses crypto.randomUUID() for secure, unique key generation following industry
 * standards for API key creation.
 *
 * Educational Note: This demonstrates stateful API key authentication where keys
 * are stored in a database and validated on each request. Compare this with
 * stateless JWT authentication where tokens are self-contained.
 *
 * @see {@link ../../docs-2.0/authentication-guide.md} for auth pattern comparisons (planned)
 */

import { randomUUID } from 'crypto';

/**
 * Generates a cryptographically secure API key using UUID v4
 *
 * Creates a unique identifier suitable for API authentication. The key is
 * generated using Node.js crypto.randomUUID() which provides sufficient
 * entropy for secure authentication tokens.
 *
 * Educational Context:
 * - UUID v4 provides 122 bits of randomness (very low collision probability)
 * - Format: 8-4-4-4-12 hexadecimal characters (36 chars total with hyphens)
 * - Example: "550e8400-e29b-41d4-a716-446655440000"
 *
 * Security Notes:
 * - Keys should be transmitted over HTTPS only
 * - Keys should be stored securely (never in client-side code)
 * - Consider key rotation policies in production systems
 *
 * @returns {string} A UUID v4 string suitable for use as an API key
 * @example
 * const apiKey = generateApiKey();
 * // Returns: "550e8400-e29b-41d4-a716-446655440000"
 * @example
 * // Used in controller to create new keys
 * const newKey = generateApiKey();
 * await pool.query('INSERT INTO api_keys (api_key, name) VALUES ($1, $2)', [newKey, userName]);
 */
export const generateApiKey = (): string => {
    return randomUUID();
};

/**
 * Validates API key format (basic client-side validation)
 *
 * Checks if a string matches the expected UUID v4 format before attempting
 * database lookup. This provides fast-fail validation to avoid unnecessary
 * database queries for malformed keys.
 *
 * Note: This only validates FORMAT, not whether the key exists or is active.
 * Actual authentication happens in the apiKeyAuth middleware via database lookup.
 *
 * UUID v4 Format:
 * - 8 hex digits
 * - hyphen
 * - 4 hex digits
 * - hyphen
 * - 4 hex digits (version 4 indicator in first digit)
 * - hyphen
 * - 4 hex digits
 * - hyphen
 * - 12 hex digits
 *
 * @param {string} key - The API key string to validate
 * @returns {boolean} True if key matches UUID v4 format, false otherwise
 * @example
 * isValidApiKeyFormat("550e8400-e29b-41d4-a716-446655440000"); // true
 * isValidApiKeyFormat("invalid-key"); // false
 * isValidApiKeyFormat(""); // false
 * @example
 * // Used in middleware for quick validation
 * const apiKey = request.headers['x-api-key'];
 * if (!apiKey || !isValidApiKeyFormat(apiKey)) {
 *   return sendError(response, 401, "Invalid API key format");
 * }
 */
export const isValidApiKeyFormat = (key: string): boolean => {
    // UUID v4 regex pattern
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Pattern.test(key);
};