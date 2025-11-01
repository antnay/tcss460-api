// server/src/controllers/movieGetControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import z from 'zod';
import { Movie } from '@models';

/**
 * Complete list of all MPA ratings in the database
 */
const MPA_RATINGS = [
  "", "0", "10", "11", "12", "12+", "13", "13+", "14", "14+", "14A",
  "15", "15+", "16", "16+", "18", "18+", "18A", "19", "6", "6+", "7",
  "8", "9", "A", "AA", "AL", "APTA", "Atp", "ATP", "B", "B-15", "Btl",
  "C", "e 12", "e 14", "G", "I", "IIA", "IIB", "K-12", "K-16", "KT",
  "KT/EA", "L", "M", "MA 15+", "MA15+", "NC-17", "NC16", "NR", "PG",
  "PG-13", "PG12", "PG13", "R", "R 18+", "R15+", "R18+", "S", "T",
  "TP", "U", "UA", "VM14", "Κ-15", "Κ-18"
] as const;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Base pagination schema - used across all paginated endpoints
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Consolidated schema for getAllMovies with all filtering options
 */
const getAllMoviesSchema = paginationSchema.extend({
  // Search
  title: z.string().min(2).optional(),
  
  // Basic filters
  year: z.coerce.number().int().positive().optional(),
  genre: z.string().optional(),
  rating: z.enum(MPA_RATINGS).optional(),
  
  // Related resources
  actor: z.string().optional(),
  director: z.string().optional(),
  studio: z.string().optional(),
  collection: z.string().optional(),
  
  // Financial filters
  minBudget: z.coerce.number().int().nonnegative().optional(),
  maxBudget: z.coerce.number().int().nonnegative().optional(),
  minRevenue: z.coerce.number().int().nonnegative().optional(),
  maxRevenue: z.coerce.number().int().nonnegative().optional(),
  
  // Date range
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// Export schemas
export {
  MPA_RATINGS,
  paginationSchema,
  getAllMoviesSchema
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a standardized pagination response object
 */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const createPaginationResponse = (
  data: any[],
  page: number,
  limit: number,
  total: number,
  query?: Record<string, any>
) => {
  const pages = Math.max(1, Math.ceil(total / limit));

  const meta: PaginationMeta & { query?: Record<string, any>; } = {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPreviousPage: page > 1
  };

  if (query) {
    meta.query = query;
  }

  return { data, meta };
};

// ============================================================================
// Controller Functions
// ============================================================================

/**
 * Retrieves all movies with comprehensive filtering via query parameters
 * 
 * @route GET /api/movies
 * @queryparam title - Search by title (substring match)
 * @queryparam year - Filter by release year
 * @queryparam genre - Filter by genre name
 * @queryparam rating - Filter by MPA rating
 * @queryparam actor - Filter by actor name
 * @queryparam director - Filter by director name
 * @queryparam studio - Filter by studio name
 * @queryparam collection - Filter by collection name
 * @queryparam minBudget - Minimum budget threshold
 * @queryparam maxBudget - Maximum budget threshold
 * @queryparam minRevenue - Minimum revenue threshold
 * @queryparam maxRevenue - Maximum revenue threshold
 * @queryparam startDate - Release date range start (YYYY-MM-DD)
 * @queryparam endDate - Release date range end (YYYY-MM-DD)
 * @queryparam page - Page number (default: 1)
 * @queryparam limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/movies?genre=Action&year=2020
 * GET /api/movies?title=batman&minRevenue=1000000
 * GET /api/movies?actor=Tom+Hanks&genre=Drama&startDate=2000-01-01
 */
export const getAllMovies = async (req: Request, res: Response) => {
  const validation = getAllMoviesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const {
    title, year, genre, rating,
    actor, director, studio, collection,
    minBudget, maxBudget, minRevenue, maxRevenue,
    startDate, endDate,
    page, limit
  } = validation.data;

  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const whereConditions: string[] = [];
  const params: (string | number)[] = [];
  let paramCounter = 1;

  // Title search (ILIKE for partial match)
  if (title) {
    whereConditions.push(`m.title ILIKE $${paramCounter}`);
    params.push(`%${title}%`);
    paramCounter++;
  }

  // Year filter
  if (year) {
    whereConditions.push(`EXTRACT(YEAR FROM m.release_date) = $${paramCounter}`);
    params.push(year);
    paramCounter++;
  }

  // Genre filter
  if (genre) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_genres mg2 
      JOIN genres g2 ON mg2.genre_id = g2.genre_id 
      WHERE mg2.movie_id = m.movie_id 
      AND LOWER(g2.genre_name) = LOWER($${paramCounter})
    )`);
    params.push(genre);
    paramCounter++;
  }

  // MPA Rating filter
  if (rating) {
    whereConditions.push(`m.mpa_rating = $${paramCounter}`);
    params.push(rating);
    paramCounter++;
  }

  // Actor filter
  if (actor) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_actors ma2 
      JOIN actors a2 ON ma2.actor_id = a2.actor_id 
      WHERE ma2.movie_id = m.movie_id 
      AND LOWER(a2.actor_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${actor}%`);
    paramCounter++;
  }

  // Director filter
  if (director) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_directors md2 
      JOIN directors d2 ON md2.director_id = d2.director_id 
      WHERE md2.movie_id = m.movie_id 
      AND LOWER(d2.director_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${director}%`);
    paramCounter++;
  }

  // Studio filter
  if (studio) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_studios ms2 
      JOIN studios s2 ON ms2.studio_id = s2.studio_id 
      WHERE ms2.movie_id = m.movie_id 
      AND LOWER(s2.studio_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${studio}%`);
    paramCounter++;
  }

  // Collection filter
  if (collection) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM collections c2 
      WHERE m.collection_id = c2.collection_id 
      AND LOWER(c2.collection_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${collection}%`);
    paramCounter++;
  }

  // Budget filters
  if (minBudget !== undefined) {
    whereConditions.push(`m.budget >= $${paramCounter}`);
    params.push(minBudget);
    paramCounter++;
  }
  if (maxBudget !== undefined) {
    whereConditions.push(`m.budget <= $${paramCounter}`);
    params.push(maxBudget);
    paramCounter++;
  }

  // Revenue filters
  if (minRevenue !== undefined) {
    whereConditions.push(`m.revenue >= $${paramCounter}`);
    params.push(minRevenue);
    paramCounter++;
  }
  if (maxRevenue !== undefined) {
    whereConditions.push(`m.revenue <= $${paramCounter}`);
    params.push(maxRevenue);
    paramCounter++;
  }

  // Date range filters
  if (startDate) {
    whereConditions.push(`m.release_date >= $${paramCounter}`);
    params.push(startDate);
    paramCounter++;
  }
  if (endDate) {
    whereConditions.push(`m.release_date <= $${paramCounter}`);
    params.push(endDate);
    paramCounter++;
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    ${whereClause}
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    ${whereClause}
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.title
    LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
  `;

  params.push(limit, offset);

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number }>(countSql, params.slice(0, -2)),
      pool.query<Movie>(dataSql, params)
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found matching the specified criteria')
      );
    }

    // Build query object for response metadata
    const queryParams: Record<string, any> = {};
    if (title) queryParams.title = title;
    if (year) queryParams.year = year;
    if (genre) queryParams.genre = genre;
    if (rating) queryParams.rating = rating;
    if (actor) queryParams.actor = actor;
    if (director) queryParams.director = director;
    if (studio) queryParams.studio = studio;
    if (collection) queryParams.collection = collection;
    if (minBudget !== undefined) queryParams.minBudget = minBudget;
    if (maxBudget !== undefined) queryParams.maxBudget = maxBudget;
    if (minRevenue !== undefined) queryParams.minRevenue = minRevenue;
    if (maxRevenue !== undefined) queryParams.maxRevenue = maxRevenue;
    if (startDate) queryParams.startDate = startDate;
    if (endDate) queryParams.endDate = endDate;

    const response = createPaginationResponse(
      dataR.rows,
      page,
      limit,
      total,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Retrieves a single movie by its unique ID.
 * 
 * @route GET /api/movies/:id
 * @param req.params.id - The movie ID to retrieve
 */
export const getMovieById = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const id = parseInt(idParam, 10);

  if (isNaN(id)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("ID must be a valid number")
    );
  }

  const sql = `
    SELECT 
      m.title, 
      m.original_title, 
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, 
      m.runtime_minutes, 
      m.overview, 
      m.budget::int8, 
      m.revenue::int8, 
      m.mpa_rating, 
      m.poster_url, 
      m.backdrop_url
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    WHERE m.movie_id = $1
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
  `;

  try {
    const result = await pool.query<Movie>(sql, [id]);

    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('Movie not found')
      );
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by a specific studio
 * 
 * @route GET /api/studios/:name/movies
 * @param req.params.name - Studio name (URL encoded)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/studios/Warner%20Bros/movies
 * GET /api/studios/Pixar/movies?page=2&limit=10
 */
export const getMoviesByStudio = async (req: Request, res: Response) => {
  const { name } = req.params;
  
  if (!name || name.trim().length === 0) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Studio name is required')
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_studios ms ON m.movie_id = ms.movie_id
    JOIN studios s ON ms.studio_id = s.studio_id
    WHERE LOWER(s.studio_name) LIKE LOWER($1)
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s2.studio_name, ', ') as studios,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    JOIN movie_studios ms ON m.movie_id = ms.movie_id
    JOIN studios s ON ms.studio_id = s.studio_id
    LEFT JOIN movie_studios ms2 ON m.movie_id = ms2.movie_id
    LEFT JOIN studios s2 ON ms2.studio_id = s2.studio_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    WHERE LOWER(s.studio_name) LIKE LOWER($1)
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [`%${name}%`]),
      pool.query(dataSql, [`%${name}%`, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found produced by studio: ${name}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { studio: name });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by a specific director
 * 
 * @route GET /api/directors/:name/movies
 * @param req.params.name - Director name (URL encoded)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/directors/Christopher%20Nolan/movies
 * GET /api/directors/Spielberg/movies?page=1&limit=50
 */
export const getMoviesByDirector = async (req: Request, res: Response) => {
  const { name } = req.params;
  
  if (!name || name.trim().length === 0) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Director name is required')
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_directors md ON m.movie_id = md.movie_id
    JOIN directors d ON md.director_id = d.director_id
    WHERE LOWER(d.director_name) LIKE LOWER($1)
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d2.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    JOIN movie_directors md ON m.movie_id = md.movie_id
    JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_directors md2 ON m.movie_id = md2.movie_id
    LEFT JOIN directors d2 ON md2.director_id = d2.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    WHERE LOWER(d.director_name) LIKE LOWER($1)
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [`%${name}%`]),
      pool.query(dataSql, [`%${name}%`, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found directed by: ${name}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { director: name });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by a specific actor
 * 
 * @route GET /api/actors/:name/movies
 * @param req.params.name - Actor name (URL encoded)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/actors/Tom%20Hanks/movies
 * GET /api/actors/DiCaprio/movies?page=2
 */
export const getMoviesByActor = async (req: Request, res: Response) => {
  const { name } = req.params;
  
  if (!name || name.trim().length === 0) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Actor name is required')
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_actors ma ON m.movie_id = ma.movie_id
    JOIN actors a ON ma.actor_id = a.actor_id
    WHERE LOWER(a.actor_name) LIKE LOWER($1)
  `;

  const dataSql = `
    SELECT DISTINCT
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url,
      ma.character_name as actor_character,
      a.profile_url as actor_profile_url,
      a.actor_name
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    JOIN movie_actors ma ON m.movie_id = ma.movie_id
    JOIN actors a ON ma.actor_id = a.actor_id
    WHERE LOWER(a.actor_name) LIKE LOWER($1)
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url,
      ma.character_name, a.profile_url, a.actor_name
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [`%${name}%`]),
      pool.query(dataSql, [`%${name}%`, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found featuring actor: ${name}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { actor: name });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies in a specific collection/franchise
 * 
 * @route GET /api/collections/:name/movies
 * @param req.params.name - Collection name (URL encoded)
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/collections/Marvel%20Cinematic%20Universe/movies
 * GET /api/collections/Star%20Wars/movies
 */
export const getMoviesByCollection = async (req: Request, res: Response) => {
  const { name } = req.params;
  
  if (!name || name.trim().length === 0) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest('Collection name is required')
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    INNER JOIN collections c ON m.collection_id = c.collection_id
    WHERE LOWER(c.collection_name) LIKE LOWER($1)
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url,
      c.collection_name,
      (m.revenue - m.budget)::int8 as profit
    FROM movies m
    INNER JOIN collections c ON m.collection_id = c.collection_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    LEFT JOIN movie_studios ms ON m.movie_id = ms.movie_id
    LEFT JOIN studios s ON ms.studio_id = s.studio_id
    WHERE LOWER(c.collection_name) LIKE LOWER($1)
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url, c.collection_name
    ORDER BY m.release_date ASC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [`%${name}%`]),
      pool.query(dataSql, [`%${name}%`, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found in collection: ${name}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { collection: name });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by studio ID
 * 
 * @route GET /api/studios/:id/movies
 * @param req.params.id - Studio ID
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/studios/5/movies
 * GET /api/studios/12/movies?page=2&limit=10
 */
export const getMoviesByStudioId = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const studioId = parseInt(idParam, 10);

  if (isNaN(studioId)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Studio ID must be a valid number")
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_studios ms ON m.movie_id = ms.movie_id
    WHERE ms.studio_id = $1
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    JOIN movie_studios ms ON m.movie_id = ms.movie_id
    LEFT JOIN studios s ON ms.studio_id = s.studio_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    WHERE ms.studio_id = $1
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [studioId]),
      pool.query(dataSql, [studioId, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found for studio ID: ${studioId}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { studioId });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by director ID
 * 
 * @route GET /api/directors/:id/movies
 * @param req.params.id - Director ID
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/directors/42/movies
 * GET /api/directors/100/movies?page=1&limit=50
 */
export const getMoviesByDirectorId = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const directorId = parseInt(idParam, 10);

  if (isNaN(directorId)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Director ID must be a valid number")
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_directors md ON m.movie_id = md.movie_id
    WHERE md.director_id = $1
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    WHERE md.director_id = $1
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [directorId]),
      pool.query(dataSql, [directorId, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found for director ID: ${directorId}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { directorId });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by actor ID
 * 
 * @route GET /api/actors/:id/movies
 * @param req.params.id - Actor ID
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/actors/523/movies
 * GET /api/actors/31/movies?page=2
 */
export const getMoviesByActorId = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const actorId = parseInt(idParam, 10);

  if (isNaN(actorId)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Actor ID must be a valid number")
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_actors ma ON m.movie_id = ma.movie_id
    WHERE ma.actor_id = $1
  `;

  const dataSql = `
    SELECT DISTINCT
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url,
      ma.character_name as actor_character,
      a.profile_url as actor_profile_url,
      a.actor_name
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    JOIN movie_actors ma ON m.movie_id = ma.movie_id
    JOIN actors a ON ma.actor_id = a.actor_id
    WHERE ma.actor_id = $1
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url,
      ma.character_name, a.profile_url, a.actor_name
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [actorId]),
      pool.query(dataSql, [actorId, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found for actor ID: ${actorId}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { actorId });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Get all movies by collection ID
 * 
 * @route GET /api/collections/:id/movies
 * @param req.params.id - Collection ID
 * @param req.query.page - Page number (default: 1)
 * @param req.query.limit - Results per page (default: 20, max: 100)
 * 
 * @example
 * GET /api/collections/10/movies
 * GET /api/collections/25/movies?limit=50
 */
export const getMoviesByCollectionId = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const collectionId = parseInt(idParam, 10);

  if (isNaN(collectionId)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Collection ID must be a valid number")
    );
  }

  const validation = paginationSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    WHERE m.collection_id = $1
  `;

  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url,
      c.collection_name,
      (m.revenue - m.budget)::int8 as profit
    FROM movies m
    LEFT JOIN collections c ON m.collection_id = c.collection_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    LEFT JOIN movie_studios ms ON m.movie_id = ms.movie_id
    LEFT JOIN studios s ON ms.studio_id = s.studio_id
    WHERE m.collection_id = $1
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url, c.collection_name
    ORDER BY m.release_date ASC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [collectionId]),
      pool.query(dataSql, [collectionId, limit, offset])
    ]);

    const total = countR.rows[0].total;

    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found for collection ID: ${collectionId}`)
      );
    }

    const response = createPaginationResponse(dataR.rows, page, limit, total, { collectionId });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};