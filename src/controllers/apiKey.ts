// server/src/controllers/apiKeyControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import crypto from 'crypto';

/**
 * Interface for API key generation request body
 */
interface GenerateApiKeyRequest {
    name: string;
    email?: string;
}

/**
 * Interface for API key generation response
 */
interface GenerateApiKeyResponse {
    success: boolean;
    api_key: string;
    name: string;
    email?: string;
    rate_limit: number;
    created_at: string;
    message: string;
    important_notice: string;
}

/**
 * Generate a secure random API key
 * Creates a 32-byte random string encoded as base64url
 * 
 * @returns A secure random API key string (43 characters)
 */
const generateSecureApiKey = (): string => {
    // Generate 32 random bytes
    const buffer = crypto.randomBytes(32);

    // Convert to base64url (URL-safe base64)
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

/**
 * Hash an API key using SHA-256
 * 
 * @param apiKey - The plain text API key
 * @returns Hashed API key (hex string, 64 characters)
 */
const hashApiKey = (apiKey: string): string => {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * POST /api/api-key
 * Generate a new API key
 * 
 * Creates a new API key with the provided name and optional email.
 * The API key is hashed before storage for security.
 * Returns the plain text API key ONCE - it cannot be retrieved again.
 * 
 * @param req - Express request with validated body (name, email)
 * @param res - Express response
 * 
 * @returns 201 - API key generated successfully
 * @returns 400 - Validation error
 * @returns 500 - Server error
 */
export const generateApiKeyController = async (
    req: Request<{}, {}, GenerateApiKeyRequest>,
    res: Response
): Promise<void> => {
    const { name, email } = req.body;

    try {
        // Generate a secure random API key
        const plainTextApiKey = generateSecureApiKey();

        // Hash the API key for storage
        const hashedApiKey = hashApiKey(plainTextApiKey);

        // Insert into database
        const insertQuery = `
      INSERT INTO api_keys (
        api_key,
        name,
        email,
        is_active,
        rate_limit
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING api_key_id, created_at, rate_limit
    `;

        const result = await pool.query(insertQuery, [
            hashedApiKey,
            name,
            email || null,
            true,          // is_active
            1000           // default rate_limit (1000 requests/hour)
        ]);

        const { created_at, rate_limit } = result.rows[0];

        // Build response
        const response: GenerateApiKeyResponse = {
            success: true,
            api_key: plainTextApiKey,
            name,
            email,
            rate_limit,
            created_at: created_at.toISOString(),
            message: 'API key generated successfully',
            important_notice: 'SAVE THIS KEY SECURELY - It will not be shown again. Include it in your requests using the X-API-Key header.'
        };

        // Log success (without the key)
        console.log(`API key generated for: ${name} (${email || 'no email'})`);

        res.status(HttpStatus.CREATED).json(response);
    } catch (error) {
        console.error('Error generating API key:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to generate API key')
        );
    }
};

/**
 * GET /api/api-key
 * Serve the API key generation HTML form
 * 
 * Returns a simple HTML page with a form to generate an API key.
 * This is a public endpoint that doesn't require authentication.
 * 
 * @param req - Express request
 * @param res - Express response
 */
export const serveApiKeyForm = (req: Request, res: Response): void => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generate API Key - Movie Database API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 40px;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        .required {
            color: #e74c3c;
        }
        
        input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            font-size: 15px;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .result {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            display: none;
        }
        
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
        }
        
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
        }
        
        .api-key-display {
            background: white;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            word-break: break-all;
            margin: 10px 0;
            border: 2px dashed #667eea;
        }
        
        .notice {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 13px;
            line-height: 1.5;
        }
        
        .notice strong {
            color: #856404;
        }
        
        .copy-btn {
            margin-top: 10px;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            width: auto;
        }
        
        .copy-btn:hover {
            background: #5568d3;
        }
        
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔑 Generate API Key</h1>
        <p class="subtitle">Get instant access to the Movie Database API</p>
        
        <form id="apiKeyForm">
            <div class="form-group">
                <label for="name">
                    Name <span class="required">*</span>
                </label>
                <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    placeholder="Your name or organization"
                    required
                    maxlength="255"
                >
            </div>
            
            <div class="form-group">
                <label for="email">
                    Email (optional)
                </label>
                <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    placeholder="your.email@example.com"
                    maxlength="255"
                >
            </div>
            
            <button type="submit" id="submitBtn">Generate API Key</button>
        </form>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #666;">Generating your API key...</p>
        </div>
        
        <div class="result" id="result"></div>
    </div>
    
    <script>
        const form = document.getElementById('apiKeyForm');
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            
            // Show loading
            submitBtn.disabled = true;
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
                const response = await fetch('/api/api-key', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email: email || undefined })
                });
                
                const data = await response.json();
                
                loading.style.display = 'none';
                result.style.display = 'block';
                
                if (response.ok) {
                    result.className = 'result success';
                    result.innerHTML = \`
                        <h3 style="color: #155724; margin-bottom: 15px;">✅ API Key Generated!</h3>
                        <p style="margin-bottom: 10px;"><strong>Your API Key:</strong></p>
                        <div class="api-key-display" id="apiKeyValue">\${data.api_key}</div>
                        <button class="copy-btn" onclick="copyApiKey()">📋 Copy to Clipboard</button>
                        
                        <div class="notice">
                            <strong>⚠️ Important:</strong> Save this API key securely. It will not be shown again!
                            <br><br>
                            <strong>Usage:</strong> Include this key in your HTTP requests using the <code>X-API-Key</code> header.
                            <br><br>
                            <strong>Rate Limit:</strong> \${data.rate_limit} requests per hour
                        </div>
                    \`;
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`
                        <h3 style="color: #721c24; margin-bottom: 10px;">❌ Error</h3>
                        <p>\${data.message || 'Failed to generate API key'}</p>
                    \`;
                }
            } catch (error) {
                loading.style.display = 'none';
                result.style.display = 'block';
                result.className = 'result error';
                result.innerHTML = \`
                    <h3 style="color: #721c24; margin-bottom: 10px;">❌ Network Error</h3>
                    <p>Failed to connect to the server. Please try again.</p>
                \`;
            } finally {
                submitBtn.disabled = false;
            }
        });
        
        function copyApiKey() {
            const apiKey = document.getElementById('apiKeyValue').textContent;
            navigator.clipboard.writeText(apiKey).then(() => {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            });
        }
    </script>
</body>
</html>
  `;

    res.setHeader('Content-Type', 'text/html');
    res.status(HttpStatus.OK).send(html);
};

/**
 * GET /api/api-key/info
 * Get information about the current API key (requires authentication)
 * 
 * This endpoint requires API key authentication and returns
 * information about the authenticated key.
 * 
 * @param req - Express request with apiKey property
 * @param res - Express response
 */
export const getApiKeyInfo = async (req: any, res: Response): Promise<void> => {
    try {
        if (!req.apiKey) {
            res.status(HttpStatus.UNAUTHORIZED).json(
                ApiError.unauthorized('API key authentication required')
            );
            return;
        }

        // Get detailed info from database
        const query = `
      SELECT 
        api_key_id,
        name,
        email,
        rate_limit,
        created_at,
        last_used_at,
        expires_at
      FROM api_keys
      WHERE api_key_id = $1
    `;

        const result = await pool.query(query, [req.apiKey.api_key_id]);

        if (result.rows.length === 0) {
            res.status(HttpStatus.NOT_FOUND).json(
                ApiError.notFound('API key not found')
            );
            return;
        }

        const keyInfo = result.rows[0];

        res.status(HttpStatus.OK).json({
            success: true,
            api_key_info: {
                name: keyInfo.name,
                email: keyInfo.email,
                rate_limit: keyInfo.rate_limit,
                created_at: keyInfo.created_at,
                last_used_at: keyInfo.last_used_at,
                expires_at: keyInfo.expires_at
            }
        });
    } catch (error) {
        console.error('Error fetching API key info:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch API key information')
        );
    }
};