// server/src/controllers/studioControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Studio, StudioWithCount, StudioListResponse } from '@models';
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
): StudioListResponse => {
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
// Studio Controllers
// ============================================================================

/**
 * GET /api/studios
 * Retrieve all studios with optional search and pagination
 * 
 * Query Parameters:
 * - name: string (optional) - Search by studio name
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'movie_count' | 'created_at' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * @returns Array of studios with movie count
 */
export const getAllStudios = async (req: Request, res: Response): Promise<void> => {
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
      whereClause = `WHERE s.studio_name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY s.studio_name ASC';
    if (sortBy === 'movie_count') {
      orderByClause = `ORDER BY movie_count ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'created_at') {
      orderByClause = `ORDER BY s.created_at ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = `ORDER BY s.studio_name ${sortOrder.toUpperCase()}`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT s.studio_id)::int AS total
      FROM studios s
      ${whereClause}
    `;

    // Data query
    const dataSql = `
      SELECT 
        s.studio_id,
        s.studio_name,
        s.logo_url,
        s.country,
        COUNT(ms.movie_id)::int AS movie_count
      FROM studios s
      LEFT JOIN movie_studios ms ON s.studio_id = ms.studio_id
      ${whereClause}
      GROUP BY s.studio_id, s.studio_name, s.logo_url, s.country
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query<{ total: number }>(countSql, params.slice(0, -2)),
      pool.query<StudioWithCount>(dataSql, params)
    ]);

    const total = countResult.rows[0].total;

    if (total === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(name ? `No studios found matching "${name}"` : 'No studios found')
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
    console.error('Error fetching studios:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch studios')
    );
  }
};

/**
 * GET /api/studios/:id
 * Retrieve a single studio by ID
 * 
 * @param id - Studio ID
 * @returns Single studio with movie count
 */
export const getStudioById = async (req: Request, res: Response): Promise<void> => {
  const studioId = parseInt(req.params.id, 10);

  if (isNaN(studioId)) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Studio ID must be a valid number')
    );
    return;
  }

  try {
    const sql = `
      SELECT 
        s.studio_id,
        s.studio_name,
        s.logo_url,
        s.country,
        COUNT(ms.movie_id)::int AS movie_count
      FROM studios s
      LEFT JOIN movie_studios ms ON s.studio_id = ms.studio_id
      WHERE s.studio_id = $1
      GROUP BY s.studio_id, s.studio_name, s.logo_url, s.country
    `;

    const result = await pool.query<StudioWithCount>(sql, [studioId]);

    if (result.rows.length === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`Studio with ID ${studioId} not found`)
      );
      return;
    }

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching studio:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch studio')
    );
  }
};

/**
 * GET /api/studios/search
 * Search studios by name (returns array)
 * 
 * Query Parameters:
 * - name: string (required) - Studio name to search
 * 
 * @returns Array of matching studios
 */
export const searchStudios = async (req: Request, res: Response): Promise<void> => {
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
        s.studio_id,
        s.studio_name,
        s.logo_url,
        s.country,
        COUNT(ms.movie_id)::int AS movie_count
      FROM studios s
      LEFT JOIN movie_studios ms ON s.studio_id = ms.studio_id
      WHERE s.studio_name ILIKE $1
      GROUP BY s.studio_id, s.studio_name, s.logo_url, s.country
      ORDER BY s.studio_name ASC
    `;

    const result = await pool.query<StudioWithCount>(sql, [`%${name}%`]);

    // Always return an array, even if empty
    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching studios:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to search studios')
    );
  }
};

/**
 * GET /api/studios/top
 * Get top studios by movie count
 * 
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * 
 * @returns Array of top studios
 */
export const getTopStudios = async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const sql = `
      SELECT 
        s.studio_id,
        s.studio_name,
        s.logo_url,
        s.country,
        COUNT(ms.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        SUM(m.budget)::bigint AS total_budget
      FROM studios s
      LEFT JOIN movie_studios ms ON s.studio_id = ms.studio_id
      LEFT JOIN movies m ON ms.movie_id = m.movie_id
      GROUP BY s.studio_id, s.studio_name, s.logo_url, s.country
      HAVING COUNT(ms.movie_id) > 0
      ORDER BY movie_count DESC, total_revenue DESC
      LIMIT $1
    `;

    const result = await pool.query(sql, [limit]);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching top studios:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch top studios')
    );
  }
};

/**
 * GET /api/studios/stats
 * Get studio statistics
 * 
 * @returns Statistics about studios
 */
export const getStudioStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        COUNT(DISTINCT s.studio_id)::int AS total_studios,
        COUNT(DISTINCT ms.movie_id)::int AS total_movies,
        ROUND(AVG(movie_counts.count), 2) AS avg_movies_per_studio,
        MAX(movie_counts.count)::int AS max_movies_by_studio
      FROM studios s
      LEFT JOIN movie_studios ms ON s.studio_id = ms.studio_id
      LEFT JOIN (
        SELECT studio_id, COUNT(movie_id) as count
        FROM movie_studios
        GROUP BY studio_id
      ) movie_counts ON s.studio_id = movie_counts.studio_id
    `;

    const result = await pool.query(sql);

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching studio stats:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch studio statistics')
    );
  }
};