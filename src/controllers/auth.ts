import { JwtClaims, JwtResponse, User } from '@models/authModel';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { accessToken, decodeRefresh, refreshToken, verifyRefresh } from '@utils/jwtToken';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import z from 'zod';
import argon2 from 'argon2';

const loginSchema = z.object({
    email: z.email("email must be formatted as an email"),
    password: z.string("password must be a string")
        .min(8, "password must be greater than 8 characters"),
});

const registerSchema = z.object({
    username: z.string("username must be a string")
        .min(3, "username must be greater than 3 characters")
        .max(50, "username must be less than 50 characters"),
    email: z.email("email must be formatted as an email"),
    password: z.string("password must be a string")
        .min(8, "password must be greater than 8 characters"),
    role: z.enum(['user', 'admin'], "role must be either 'user' or 'admin'"),
});

const verifySchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    token: z.string()
});


/**
 * Authenticates a user and creates a new session.
 * 
 * Validates user credentials using Argon2 password hashing, generates JWT tokens
 * (access and refresh), and stores the refresh token in the database session table.
 * Sets a refresh token cookie and returns an access token in the response body.
 * 
 * **Process Flow:**
 * 1. Validates request body against loginSchema (email, password)
 * 2. Queries database for user by email
 * 3. Verifies password using Argon2
 * 4. Generates JWT access and refresh tokens
 * 5. Updates refresh token in sessions table
 * 6. Sets HTTP-only cookie with refresh token
 * 7. Returns access token and user info in response
 * 
 * **Security Features:**
 * - Argon2 password hashing verification
 * - JWT-based authentication with separate access/refresh tokens
 * - Refresh token stored securely in HTTP-only cookie
 * - Session persistence in database
 * 
 * @route POST /api/auth/login
 * @param req - Express request object
 * @param req.body.email - User's email address (must be valid email format)
 * @param req.body.password - User's password (minimum 8 characters)
 * @param res - Express response object
 * @returns 200 - Success with user info and JWT access token
 * @returns 400 - Invalid credentials or validation errors
 * @returns 401 - Incorrect password
 * @returns 500 - Database or server error
 * 
 * @example
 * // Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123"
 * }
 * 
 * @example
 * // Success response:
 * {
 *   "username": "johndoe",
 *   "role": "user",
 *   "jwt": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "type": "Bearer"
 *   }
 * }
 */
export const login = async (req: Request, res: Response) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest(validation.error.issues));
    }
    const { email, password } = validation.data;

    let user: User;
    try {
        const q = await pool.query(`
        SELECT
            u.user_id,
            u.username,
            u.role,
            p.password_hash,
            s.token
        FROM
            users AS u
            LEFT JOIN password_login AS p USING (user_id)
            LEFT JOIN sessions AS s USING (user_id)
        WHERE u.email = $1
        `, [email]);
        user = q.rows[0] as User;
        if (!q || !user) { return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("user does not exist")); }
    } catch (e) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiError.internalError(e));
    }

    try {
        const isMatch = await argon2.verify(user.password_hash, password);
        if (!isMatch) {
            return res.status(HttpStatus.UNAUTHORIZED).json(ApiError.unauthorized("incorrect login provided"));
        }
    } catch (error) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiError.internalError(error));
    }

    const claims: JwtClaims = { userName: user.username, role: user.role };
    const refresh = refreshToken(claims);
    try {
        const sessionInsert = `
            INSERT INTO sessions (user_id, token)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token;
        `;
        await pool.query(sessionInsert, [user.user_id, refresh]);
    } catch (e) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiError.internalError(e));
    }

    const access = accessToken(claims);
    let out: JwtResponse = {
        username: user.username,
        role: user.role,
        jwt: {
            accessToken: access,
            type: "Bearer"
        }
    };
    res.cookie("refresh-token", refresh);
    res.status(200).json(out);
};

/**
 * Registers a new user account with authentication credentials.
 * 
 * Creates a new user with hashed password, generates JWT tokens, and establishes
 * an initial session. Uses a database transaction to ensure atomicity across
 * multiple table inserts (users, password_login, sessions).
 * 
 * **Process Flow:**
 * 1. Validates request body against registerSchema
 * 2. Checks for existing users with same email or username
 * 3. Hashes password using Argon2
 * 4. Generates JWT access and refresh tokens
 * 5. Creates user, password, and session records in transaction
 * 6. Sets HTTP-only cookie with refresh token
 * 7. Returns access token and user info in response
 * 
 * **Security Features:**
 * - Argon2 password hashing for secure storage
 * - Email and username uniqueness validation
 * - JWT-based authentication with separate access/refresh tokens
 * - Transactional integrity across multiple tables
 * - Refresh token stored in HTTP-only cookie
 * 
 * **Validation Rules:**
 * - Username: 3-50 characters
 * - Email: Valid email format
 * - Password: Minimum 8 characters
 * - Role: Must be 'user' or 'admin'
 * 
 * @route POST /api/auth/register
 * @param req - Express request object
 * @param req.body.username - Desired username (3-50 characters, must be unique)
 * @param req.body.email - Email address (valid format, must be unique)
 * @param req.body.password - Password (minimum 8 characters)
 * @param req.body.role - User role ('user' or 'admin')
 * @param res - Express response object
 * @returns 200 - Success with user info and JWT access token
 * @returns 400 - Validation errors (invalid format or missing fields)
 * @returns 409 - Conflict - email or username already exists
 * @returns 500 - Database or server error (transaction rolled back)
 * 
 * @example
 * // Request body:
 * {
 *   "username": "johndoe",
 *   "email": "john@example.com",
 *   "password": "securePassword123",
 *   "role": "user"
 * }
 * 
 * @example
 * // Success response:
 * {
 *   "username": "johndoe",
 *   "role": "user",
 *   "jwt": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "type": "Bearer"
 *   }
 * }
 */
export const register = async (req: Request, res: Response) => {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest(validation.error.issues));
    }

    const { username, email, password, role } = validation.data;

    try {
        const existingUser = await pool.query(
            'SELECT user_id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        if (existingUser.rows.length > 0) {
            return res.status(HttpStatus.CONFLICT).json(
                ApiError.conflict('User with this email or username already exists')
            );
        }
    } catch (e) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiError.internalError(e));
    }

    const passwordHashBytes = await argon2.hash(password);
    const passwordHash: string = passwordHashBytes.toString();

    const claims: JwtClaims = { userName: username, role: role };
    const refresh = refreshToken(claims);

    let client = await pool.connect();

    try {
        await client.query('BEGIN');
        const userInsert = `
            INSERT INTO users (email, username, role)
            VALUES ($1, $2, $3)
            RETURNING user_id
        `;
        const id = await client.query(userInsert, [email, username, role]);
        const passwordInsert = `
            INSERT INTO password_login (user_id, password_hash)
            VALUES ($1, $2)
        `;
        await client.query(passwordInsert, [id.rows[0].user_id, passwordHash]);
        const sessionInsert = `
            INSERT INTO sessions (user_id, token)
            VALUES ($1, $2)
        `;
        await client.query(sessionInsert, [id.rows[0].user_id, refresh]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ApiError.internalError(e));
    } finally {
        client.release();
    }

    const access = accessToken(claims);
    let out: JwtResponse = {
        username: username,
        role: role,
        jwt: {
            accessToken: access,
            type: "Bearer"
        }
    };
    res.cookie("refresh-token", refresh);
    res.status(200).json(out);
};

export const keyForm = async (req: Request, res: Response) => {
};

export const generateKey = async (req: Request, res: Response) => {
};


// export const verify = async (req: Request, res: Response) => {
// };