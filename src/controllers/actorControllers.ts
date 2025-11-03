// server/src/controllers/actorControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Actor, ActorWithCount, ActorListResponse } from '@models';
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
): ActorListResponse => {
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
// Actor Controllers
// ============================================================================

/**
 * GET /api/actors
 * Retrieve all actors with optional search and pagination
 * 
 * Query Parameters:
 * - name: string (optional) - Search by actor name
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'movie_count' | 'created_at' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * @returns Array of actors with movie count
 */
export const getAllActors = async (req: Request, res: Response): Promise<void> => {
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
      whereClause = `WHERE a.actor_name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY a.actor_name ASC';
    if (sortBy === 'movie_count') {
      orderByClause = `ORDER BY movie_count ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'created_at') {
      orderByClause = `ORDER BY a.created_at ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = `ORDER BY a.actor_name ${sortOrder.toUpperCase()}`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT a.actor_id)::int AS total
      FROM actors a
      ${whereClause}
    `;

    // Data query
    const dataSql = `
      SELECT 
        a.actor_id,
        a.actor_name,
        a.birth_date,
        a.biography,
        a.profile_url,
        a.nationality,
        COUNT(ma.movie_id)::int AS movie_count
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      ${whereClause}
      GROUP BY a.actor_id, a.actor_name, a.birth_date, a.biography, 
               a.profile_url, a.nationality
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query<{ total: number }>(countSql, params.slice(0, -2)),
      pool.query<ActorWithCount>(dataSql, params)
    ]);

    const total = countResult.rows[0].total;

    if (total === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(name ? `No actors found matching "${name}"` : 'No actors found')
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
    console.error('Error fetching actors:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch actors')
    );
  }
};

/**
 * GET /api/actors/:id
 * Retrieve a single actor by ID
 * 
 * @param id - Actor ID
 * @returns Single actor with movie count
 */
export const getActorById = async (req: Request, res: Response): Promise<void> => {
  const actorId = parseInt(req.params.id, 10);

  if (isNaN(actorId)) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Actor ID must be a valid number')
    );
    return;
  }

  try {
    const sql = `
      SELECT 
        a.actor_id,
        a.actor_name,
        a.birth_date,
        a.biography,
        a.profile_url,
        a.nationality,
        a.awards,
        COUNT(ma.movie_id)::int AS movie_count
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      WHERE a.actor_id = $1
      GROUP BY a.actor_id, a.actor_name, a.birth_date, a.biography, 
               a.profile_url, a.nationality, a.awards
    `;

    const result = await pool.query<ActorWithCount>(sql, [actorId]);

    if (result.rows.length === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`Actor with ID ${actorId} not found`)
      );
      return;
    }

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching actor:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch actor')
    );
  }
};

/**
 * GET /api/actors/search
 * Search actors by name (returns array)
 * 
 * Query Parameters:
 * - name: string (required) - Actor name to search
 * 
 * @returns Array of matching actors
 */
export const searchActors = async (req: Request, res: Response): Promise<void> => {
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
        a.actor_id,
        a.actor_name,
        a.birth_date,
        a.profile_url,
        a.nationality,
        COUNT(ma.movie_id)::int AS movie_count
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      WHERE a.actor_name ILIKE $1
      GROUP BY a.actor_id, a.actor_name, a.birth_date, a.profile_url, a.nationality
      ORDER BY a.actor_name ASC
    `;

    const result = await pool.query<ActorWithCount>(sql, [`%${name}%`]);

    // Always return an array, even if empty
    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching actors:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to search actors')
    );
  }
};

/**
 * GET /api/actors/top
 * Get top actors by movie count
 * 
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * 
 * @returns Array of top actors
 */
export const getTopActors = async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const sql = `
      SELECT 
        a.actor_id,
        a.actor_name,
        a.profile_url,
        a.nationality,
        COUNT(ma.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        AVG(m.revenue)::bigint AS avg_revenue
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      LEFT JOIN movies m ON ma.movie_id = m.movie_id
      GROUP BY a.actor_id, a.actor_name, a.profile_url, a.nationality
      HAVING COUNT(ma.movie_id) > 0
      ORDER BY movie_count DESC, total_revenue DESC
      LIMIT $1
    `;

    const result = await pool.query(sql, [limit]);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching top actors:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch top actors')
    );
  }
};

/**
 * GET /api/actors/stats
 * Get actor statistics
 * 
 * @returns Statistics about actors
 */
export const getActorStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        COUNT(DISTINCT a.actor_id)::int AS total_actors,
        COUNT(DISTINCT ma.movie_id)::int AS total_movies,
        ROUND(AVG(movie_counts.count), 2) AS avg_movies_per_actor,
        MAX(movie_counts.count)::int AS max_movies_by_actor
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      LEFT JOIN (
        SELECT actor_id, COUNT(movie_id) as count
        FROM movie_actors
        GROUP BY actor_id
      ) movie_counts ON a.actor_id = movie_counts.actor_id
    `;

    const result = await pool.query(sql);

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching actor stats:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch actor statistics')
    );
  }
};

/**
 * GET /api/actors/by-nationality
 * Get actors grouped by nationality
 * 
 * @returns Array of nationalities with actor counts
 */
export const getActorsByNationality = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        a.nationality,
        COUNT(DISTINCT a.actor_id)::int AS actor_count,
        COUNT(DISTINCT ma.movie_id)::int AS movie_count
      FROM actors a
      LEFT JOIN movie_actors ma ON a.actor_id = ma.actor_id
      WHERE a.nationality IS NOT NULL
      GROUP BY a.nationality
      ORDER BY actor_count DESC
    `;

    const result = await pool.query(sql);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching actors by nationality:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch actors by nationality')
    );
  }
};

/**
 * GET /api/actors/:id/co-stars
 * Get actors who have appeared in movies with the specified actor
 * 
 * @param id - Actor ID
 * @returns Array of co-stars with collaboration count
 */
export const getActorCoStars = async (req: Request, res: Response): Promise<void> => {
  const actorId = parseInt(req.params.id, 10);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (isNaN(actorId)) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Actor ID must be a valid number')
    );
    return;
  }

  try {
    const sql = `
      SELECT 
        a.actor_id,
        a.actor_name,
        a.profile_url,
        COUNT(DISTINCT ma2.movie_id)::int AS movies_together
      FROM movie_actors ma1
      JOIN movie_actors ma2 ON ma1.movie_id = ma2.movie_id
      JOIN actors a ON ma2.actor_id = a.actor_id
      WHERE ma1.actor_id = $1 
        AND ma2.actor_id != $1
      GROUP BY a.actor_id, a.actor_name, a.profile_url
      ORDER BY movies_together DESC
      LIMIT $2
    `;

    const result = await pool.query(sql, [actorId, limit]);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching co-stars:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch co-stars')
    );
  }
};