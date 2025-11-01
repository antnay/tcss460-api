// server/src/controllers/directorControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Director, DirectorWithCount, DirectorListResponse } from '@models';
import z from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['name', 'movie_count', 'created_at']).optional().default('name'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});

const searchSchema = paginationSchema.extend({
    name: z.string().min(1).optional()
});

// ============================================================================
// Helper Functions
// ============================================================================

const createPaginationResponse = (
    data: any[],
    page: number,
    limit: number,
    total: number,
    query?: Record<string, any>
): DirectorListResponse => {
    const pages = Math.max(1, Math.ceil(total / limit));

    return {
        data,
        meta: {
            page,
            limit,
            total,
            pages,
            hasNextPage: page < pages,
            hasPreviousPage: page > 1,
            ...(query && { query })
        }
    };
};

// ============================================================================
// Director Controllers
// ============================================================================

/**
 * GET /api/directors
 * Retrieve all directors with optional search and pagination
 * 
 * Query Parameters:
 * - name: string (optional) - Search by director name
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'movie_count' | 'created_at' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * @returns Array of directors with movie count
 */
export const getAllDirectors = async (req: Request, res: Response): Promise<void> => {
    const validation = searchSchema.safeParse(req.query);

    if (!validation.success) {
        res.status(HttpStatus.BAD_REQUEST).json(
            ApiError.badRequest(validation.error.issues)
        );
        return;
    }

    const { name, page, limit, sortBy, sortOrder } = validation.data;
    const offset = (page - 1) * limit;

    try {
        // Build WHERE clause
        let whereClause = '';
        const params: any[] = [];
        let paramCount = 1;

        if (name) {
            whereClause = `WHERE d.director_name ILIKE $${paramCount}`;
            params.push(`%${name}%`);
            paramCount++;
        }

        // Build ORDER BY clause
        let orderByClause = 'ORDER BY d.director_name ASC';
        if (sortBy === 'movie_count') {
            orderByClause = `ORDER BY movie_count ${sortOrder.toUpperCase()}`;
        } else if (sortBy === 'created_at') {
            orderByClause = `ORDER BY d.created_at ${sortOrder.toUpperCase()}`;
        } else {
            orderByClause = `ORDER BY d.director_name ${sortOrder.toUpperCase()}`;
        }

        // Count query
        const countSql = `
      SELECT COUNT(DISTINCT d.director_id)::int AS total
      FROM directors d
      ${whereClause}
    `;

        // Data query
        const dataSql = `
      SELECT 
        d.director_id,
        d.director_name,
        d.birth_date,
        d.biography,
        d.profile_url,
        d.nationality,
        COUNT(md.movie_id)::int AS movie_count
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      ${whereClause}
      GROUP BY d.director_id, d.director_name, d.birth_date, d.biography, 
               d.profile_url, d.nationality
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

        params.push(limit, offset);

        const [countResult, dataResult] = await Promise.all([
            pool.query<{ total: number; }>(countSql, params.slice(0, -2)),
            pool.query<DirectorWithCount>(dataSql, params)
        ]);

        const total = countResult.rows[0].total;

        if (total === 0) {
            res.status(HttpStatus.NOT_FOUND).json(
                ApiError.notFound(name ? `No directors found matching "${name}"` : 'No directors found')
            );
            return;
        }

        const response = createPaginationResponse(
            dataResult.rows,
            page,
            limit,
            total,
            name ? { name } : undefined
        );

        res.status(HttpStatus.OK).json(response);
    } catch (error) {
        console.error('Error fetching directors:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch directors')
        );
    }
};

/**
 * GET /api/directors/:id
 * Retrieve a single director by ID
 * 
 * @param id - Director ID
 * @returns Single director with movie count
 */
export const getDirectorById = async (req: Request, res: Response): Promise<void> => {
    const directorId = parseInt(req.params.id, 10);

    if (isNaN(directorId)) {
        res.status(HttpStatus.BAD_REQUEST).json(
            ApiError.badRequest('Director ID must be a valid number')
        );
        return;
    }

    try {
        const sql = `
      SELECT 
        d.director_id,
        d.director_name,
        d.birth_date,
        d.biography,
        d.profile_url,
        d.nationality,
        d.awards,
        COUNT(md.movie_id)::int AS movie_count
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      WHERE d.director_id = $1
      GROUP BY d.director_id, d.director_name, d.birth_date, d.biography, 
               d.profile_url, d.nationality, d.awards
    `;

        const result = await pool.query<DirectorWithCount>(sql, [directorId]);

        if (result.rows.length === 0) {
            res.status(HttpStatus.NOT_FOUND).json(
                ApiError.notFound(`Director with ID ${directorId} not found`)
            );
            return;
        }

        res.status(HttpStatus.OK).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching director:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch director')
        );
    }
};

/**
 * GET /api/directors/search
 * Search directors by name (returns array)
 * 
 * Query Parameters:
 * - name: string (required) - Director name to search
 * 
 * @returns Array of matching directors
 */
export const searchDirectors = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
        res.status(HttpStatus.BAD_REQUEST).json(
            ApiError.badRequest('Name query parameter is required')
        );
        return;
    }

    try {
        const sql = `
      SELECT 
        d.director_id,
        d.director_name,
        d.birth_date,
        d.profile_url,
        d.nationality,
        COUNT(md.movie_id)::int AS movie_count
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      WHERE d.director_name ILIKE $1
      GROUP BY d.director_id, d.director_name, d.birth_date, d.profile_url, d.nationality
      ORDER BY d.director_name ASC
    `;

        const result = await pool.query<DirectorWithCount>(sql, [`%${name}%`]);

        // Always return an array, even if empty
        res.status(HttpStatus.OK).json({
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error searching directors:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to search directors')
        );
    }
};

/**
 * GET /api/directors/top
 * Get top directors by movie count
 * 
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * 
 * @returns Array of top directors
 */
export const getTopDirectors = async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    try {
        const sql = `
      SELECT 
        d.director_id,
        d.director_name,
        d.profile_url,
        d.nationality,
        COUNT(md.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        AVG(m.revenue)::bigint AS avg_revenue
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      LEFT JOIN movies m ON md.movie_id = m.movie_id
      GROUP BY d.director_id, d.director_name, d.profile_url, d.nationality
      HAVING COUNT(md.movie_id) > 0
      ORDER BY movie_count DESC, total_revenue DESC
      LIMIT $1
    `;

        const result = await pool.query(sql, [limit]);

        res.status(HttpStatus.OK).json({
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching top directors:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch top directors')
        );
    }
};

/**
 * GET /api/directors/stats
 * Get director statistics
 * 
 * @returns Statistics about directors
 */
export const getDirectorStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const sql = `
      SELECT 
        COUNT(DISTINCT d.director_id)::int AS total_directors,
        COUNT(DISTINCT md.movie_id)::int AS total_movies,
        ROUND(AVG(movie_counts.count), 2) AS avg_movies_per_director,
        MAX(movie_counts.count)::int AS max_movies_by_director
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      LEFT JOIN (
        SELECT director_id, COUNT(movie_id) as count
        FROM movie_directors
        GROUP BY director_id
      ) movie_counts ON d.director_id = movie_counts.director_id
    `;

        const result = await pool.query(sql);

        res.status(HttpStatus.OK).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching director stats:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch director statistics')
        );
    }
};

/**
 * GET /api/directors/by-nationality
 * Get directors grouped by nationality
 * 
 * @returns Array of nationalities with director counts
 */
export const getDirectorsByNationality = async (req: Request, res: Response): Promise<void> => {
    try {
        const sql = `
      SELECT 
        d.nationality,
        COUNT(DISTINCT d.director_id)::int AS director_count,
        COUNT(DISTINCT md.movie_id)::int AS movie_count
      FROM directors d
      LEFT JOIN movie_directors md ON d.director_id = md.director_id
      WHERE d.nationality IS NOT NULL
      GROUP BY d.nationality
      ORDER BY director_count DESC
    `;

        const result = await pool.query(sql);

        res.status(HttpStatus.OK).json({
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching directors by nationality:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to fetch directors by nationality')
        );
    }
};