import pool from '@utils/database';
import { Request, Response } from 'express';

/**
 * Returns a message stating whether database is up or down
 * 
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