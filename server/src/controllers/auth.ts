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