import pool from '@utils/database';
import { Request, Response } from 'express';

/**
 * Returns info about the api.
 * 
 * @param req - Express request object.
 * @param res - Express response object.
 */
export const info = async (req: Request, res: Response) => {
    res.json({
        name: 'TCSS 460 API',
        version: '1.0.0',
        description: 'RESTful API for movies',
        documentation: '/api-docs'
    });
}

/**
 * Returns a message stating whether database is up or down
 * 
 * @param req - Express request object.
 * @param res - Express response object.
 */
export const healthCheck = async (req: Request, res: Response) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.status(200).json(
            { message: 'Database is working!', }
        );
    } catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
};

