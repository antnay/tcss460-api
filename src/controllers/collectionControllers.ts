// server/src/controllers/collectionControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Collection, CollectionWithStats, CollectionListResponse } from '@models';
import z from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'movie_count', 'total_revenue', 'created_at']).optional().default('name'),
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
): CollectionListResponse => {
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
// Collection Controllers
// ============================================================================

/**
 * GET /api/collections
 * Retrieve all collections with optional search and pagination
 * 
 * Query Parameters:
 * - name: string (optional) - Search by collection name
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sortBy: 'name' | 'movie_count' | 'total_revenue' | 'created_at' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * @returns Array of collections with statistics
 */
export const getAllCollections = async (req: Request, res: Response): Promise<void> => {
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
      whereClause = `WHERE c.collection_name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY c.collection_name ASC';
    if (sortBy === 'movie_count') {
      orderByClause = `ORDER BY movie_count ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'total_revenue') {
      orderByClause = `ORDER BY total_revenue ${sortOrder.toUpperCase()} NULLS LAST`;
    } else if (sortBy === 'created_at') {
      orderByClause = `ORDER BY c.created_at ${sortOrder.toUpperCase()}`;
    } else {
      orderByClause = `ORDER BY c.collection_name ${sortOrder.toUpperCase()}`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT c.collection_id)::int AS total
      FROM collections c
      ${whereClause}
    `;

    // Data query with statistics
    const dataSql = `
      SELECT 
        c.collection_id,
        c.collection_name,
        c.overview,
        c.poster_url,
        c.backdrop_url,
        COUNT(m.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        SUM(m.budget)::bigint AS total_budget,
        ROUND(AVG(
          CASE 
            WHEN m.mpa_rating IN ('G', 'PG', 'PG-13', 'R', 'NC-17') THEN 
              CASE m.mpa_rating
                WHEN 'G' THEN 1
                WHEN 'PG' THEN 2
                WHEN 'PG-13' THEN 3
                WHEN 'R' THEN 4
                WHEN 'NC-17' THEN 5
              END
          END
        ), 2) AS avg_rating_value
      FROM collections c
      LEFT JOIN movies m ON c.collection_id = m.collection_id
      ${whereClause}
      GROUP BY c.collection_id, c.collection_name, c.overview, c.poster_url, c.backdrop_url
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pool.query<{ total: number }>(countSql, params.slice(0, -2)),
      pool.query<CollectionWithStats>(dataSql, params)
    ]);

    const total = countResult.rows[0].total;

    if (total === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(name ? `No collections found matching "${name}"` : 'No collections found')
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
    console.error('Error fetching collections:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch collections')
    );
  }
};

/**
 * GET /api/collections/:id
 * Retrieve a single collection by ID with detailed statistics
 * 
 * @param id - Collection ID
 * @returns Single collection with statistics
 */
export const getCollectionById = async (req: Request, res: Response): Promise<void> => {
  const collectionId = parseInt(req.params.id, 10);

  if (isNaN(collectionId)) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Collection ID must be a valid number')
    );
    return;
  }

  try {
    const sql = `
      SELECT 
        c.collection_id,
        c.collection_name,
        c.overview,
        c.poster_url,
        c.backdrop_url,
        COUNT(m.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        SUM(m.budget)::bigint AS total_budget,
        AVG(m.revenue)::bigint AS avg_revenue,
        MIN(m.release_date) AS first_movie_date,
        MAX(m.release_date) AS latest_movie_date
      FROM collections c
      LEFT JOIN movies m ON c.collection_id = m.collection_id
      WHERE c.collection_id = $1
      GROUP BY c.collection_id, c.collection_name, c.overview, c.poster_url, c.backdrop_url
    `;

    const result = await pool.query(sql, [collectionId]);

    if (result.rows.length === 0) {
      res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`Collection with ID ${collectionId} not found`)
      );
      return;
    }

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch collection')
    );
  }
};

/**
 * GET /api/collections/search
 * Search collections by name (returns array)
 * 
 * Query Parameters:
 * - name: string (required) - Collection name to search
 * 
 * @returns Array of matching collections
 */
export const searchCollections = async (req: Request, res: Response): Promise<void> => {
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
        c.collection_id,
        c.collection_name,
        c.overview,
        c.poster_url,
        COUNT(m.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue
      FROM collections c
      LEFT JOIN movies m ON c.collection_id = m.collection_id
      WHERE c.collection_name ILIKE $1
      GROUP BY c.collection_id, c.collection_name, c.overview, c.poster_url
      ORDER BY c.collection_name ASC
    `;

    const result = await pool.query<CollectionWithStats>(sql, [`%${name}%`]);

    // Always return an array, even if empty
    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error searching collections:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to search collections')
    );
  }
};

/**
 * GET /api/collections/top
 * Get top collections by movie count or revenue
 * 
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * - sortBy: 'movie_count' | 'revenue' (default: 'movie_count')
 * 
 * @returns Array of top collections
 */
export const getTopCollections = async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const sortBy = req.query.sortBy === 'revenue' ? 'total_revenue' : 'movie_count';

  try {
    const sql = `
      SELECT 
        c.collection_id,
        c.collection_name,
        c.poster_url,
        COUNT(m.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        SUM(m.budget)::bigint AS total_budget,
        (SUM(m.revenue) - SUM(m.budget))::bigint AS total_profit
      FROM collections c
      LEFT JOIN movies m ON c.collection_id = m.collection_id
      GROUP BY c.collection_id, c.collection_name, c.poster_url
      HAVING COUNT(m.movie_id) > 0
      ORDER BY ${sortBy} DESC
      LIMIT $1
    `;

    const result = await pool.query(sql, [limit]);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching top collections:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch top collections')
    );
  }
};

/**
 * GET /api/collections/stats
 * Get collection statistics
 * 
 * @returns Statistics about collections
 */
export const getCollectionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        COUNT(DISTINCT c.collection_id)::int AS total_collections,
        COUNT(DISTINCT m.movie_id)::int AS total_movies_in_collections,
        ROUND(AVG(movie_counts.count), 2) AS avg_movies_per_collection,
        MAX(movie_counts.count)::int AS max_movies_in_collection,
        SUM(m.revenue)::bigint AS total_collection_revenue,
        SUM(m.budget)::bigint AS total_collection_budget
      FROM collections c
      LEFT JOIN movies m ON c.collection_id = m.collection_id
      LEFT JOIN (
        SELECT collection_id, COUNT(movie_id) as count
        FROM movies
        WHERE collection_id IS NOT NULL
        GROUP BY collection_id
      ) movie_counts ON c.collection_id = movie_counts.collection_id
    `;

    const result = await pool.query(sql);

    res.status(HttpStatus.OK).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch collection statistics')
    );
  }
};

/**
 * GET /api/collections/:id/timeline
 * Get movies in a collection ordered by release date
 * 
 * @param id - Collection ID
 * @returns Array of movies in chronological order
 */
export const getCollectionTimeline = async (req: Request, res: Response): Promise<void> => {
  const collectionId = parseInt(req.params.id, 10);

  if (isNaN(collectionId)) {
    res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Collection ID must be a valid number')
    );
    return;
  }

  try {
    const sql = `
      SELECT 
        m.movie_id,
        m.title,
        m.release_date,
        m.runtime_minutes,
        m.budget::bigint,
        m.revenue::bigint,
        m.poster_url,
        STRING_AGG(DISTINCT d.director_name, ', ') as directors
      FROM movies m
      LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
      LEFT JOIN directors d ON md.director_id = d.director_id
      WHERE m.collection_id = $1
      GROUP BY m.movie_id, m.title, m.release_date, m.runtime_minutes, 
               m.budget, m.revenue, m.poster_url
      ORDER BY m.release_date ASC
    `;

    const result = await pool.query(sql, [collectionId]);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching collection timeline:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch collection timeline')
    );
  }
};

/**
 * GET /api/collections/franchises
 * Get collections with 3+ movies (considered franchises)
 * 
 * @returns Array of franchise collections
 */
export const getFranchises = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        c.collection_id,
        c.collection_name,
        c.poster_url,
        COUNT(m.movie_id)::int AS movie_count,
        SUM(m.revenue)::bigint AS total_revenue,
        MIN(m.release_date) AS first_release,
        MAX(m.release_date) AS latest_release,
        MAX(m.release_date) - MIN(m.release_date) AS franchise_span_days
      FROM collections c
      JOIN movies m ON c.collection_id = m.collection_id
      GROUP BY c.collection_id, c.collection_name, c.poster_url
      HAVING COUNT(m.movie_id) >= 3
      ORDER BY movie_count DESC, total_revenue DESC
    `;

    const result = await pool.query(sql);

    res.status(HttpStatus.OK).json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching franchises:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      ApiError.internalError('Failed to fetch franchises')
    );
  }
};