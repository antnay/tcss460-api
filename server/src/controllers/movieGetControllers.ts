// server/src/controllers/movieGetControllers.ts

import { Request, Response } from 'express';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import z from 'zod';
import { Movie } from '@models';

/**
 * Zod schema for validating pagination and filter query parameters.
 * 
 * @property year - Optional release year filter (must be a positive integer)
 * @property page - Page number for pagination (default: 1, minimum: 1)
 * @property limit - Number of results per page (default: 20, range: 1-100)
 */
const getAllMoviesSchema = z.object({
  year: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Search movies by title (paginated)
 * Case-insensitive substring match on movie title.
 *
 * Query params:
 *   - title: string (min length 2)
 *   - page?: number = 1
 *   - limit?: number = 20 (max 100)
 */
export const searchMoviesByTitle = async (req: Request, res: Response) => {
  const title = String(req.query.title || '').trim();
  if (title.length < 2) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Query 'title' (min 2 chars) is required")
    );
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*)::int AS total FROM movies WHERE title ILIKE '%' || $1 || '%'`;
  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') AS directors,
      STRING_AGG(DISTINCT g.genre_name, ', ')    AS genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d       ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg   ON m.movie_id = mg.movie_id
    LEFT JOIN genres g          ON mg.genre_id  = g.genre_id
    WHERE m.title ILIKE '%' || $1 || '%'
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [title]),
      pool.query<Movie>(dataSql, [title, limit, offset]),
    ]);
    const total = countR.rows[0].total;
    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found matching the search term')
      );
    }
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      data: dataR.rows,
      meta: { page, limit, total, pages, query: { title } },
    });
  } catch (err) {
    return res.status(500).json(ApiError.internalError(err));
  }
};

/**
 * Filter movies by release date range (paginated)
 * Inclusive BETWEEN filter on release_date.
 *
 * Query params:
 *   - start: YYYY-MM-DD
 *   - end:   YYYY-MM-DD
 *   - page?: number = 1
 *   - limit?: number = 20 (max 100)
 */
export const filterByRelease = async (req: Request, res: Response) => {
  const start = String(req.query.start || '').trim();
  const end = String(req.query.end || '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;

  if (!start || !end || !iso.test(start) || !iso.test(end) || new Date(start) > new Date(end)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Provide valid 'start' and 'end' (YYYY-MM-DD) with start <= end")
    );
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM movies m
    WHERE m.release_date BETWEEN $1 AND $2
  `;
  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') AS directors,
      STRING_AGG(DISTINCT g.genre_name, ', ')    AS genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d       ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg   ON m.movie_id = mg.movie_id
    LEFT JOIN genres g          ON mg.genre_id  = g.genre_id
    WHERE m.release_date BETWEEN $1 AND $2
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date ASC
    LIMIT $3 OFFSET $4
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [start, end]),
      pool.query<Movie>(dataSql, [start, end, limit, offset]),
    ]);
    const total = countR.rows[0].total;
    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found in the specified date range')
      );
    }
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      data: dataR.rows,
      meta: { page, limit, total, pages, query: { start, end } },
    });
  } catch (err) {
    return res.status(500).json(ApiError.internalError(err));
  }
};

/**
 * Filter movies by genre (paginated)
 * Exact, case-insensitive match on genre_name.
 *
 * Query params:
 *   - genre: string
 *   - page?: number = 1
 *   - limit?: number = 20 (max 100)
 */
export const filterByGenre = async (req: Request, res: Response) => {
  const genre = String(req.query.genre || '').trim();
  if (!genre) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Query 'genre' is required")
    );
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(DISTINCT m.movie_id)::int AS total
    FROM movies m
    JOIN movie_genres mg ON m.movie_id = mg.movie_id
    JOIN genres g       ON mg.genre_id = g.genre_id
    WHERE LOWER(g.genre_name) = LOWER($1)
  `;
  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') AS directors,
      STRING_AGG(DISTINCT g2.genre_name, ', ')   AS genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    JOIN movie_genres mg ON m.movie_id = mg.movie_id
    JOIN genres g        ON mg.genre_id = g.genre_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d       ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg2  ON m.movie_id = mg2.movie_id
    LEFT JOIN genres g2         ON mg2.genre_id  = g2.genre_id
    WHERE LOWER(g.genre_name) = LOWER($1)
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [genre]),
      pool.query<Movie>(dataSql, [genre, limit, offset]),
    ]);
    const total = countR.rows[0].total;
    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found with genre: ${genre}`)
      );
    }
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      data: dataR.rows,
      meta: { page, limit, total, pages, query: { genre } },
    });
  } catch (err) {
    return res.status(500).json(ApiError.internalError(err));
  }
};

/**
 * Filter movies by MPA rating (paginated)
 * Only allows PG, PG-13, or R.
 *
 * Query params:
 *   - rating: 'PG' | 'PG-13' | 'R'
 *   - page?: number = 1
 *   - limit?: number = 20 (max 100)
 */
export const filterByRating = async (req: Request, res: Response) => {
  const rating = String(req.query.rating || '').trim().toUpperCase();
  if (!['PG', 'PG-13', 'R'].includes(rating)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Query 'rating' must be one of: PG, PG-13, R")
    );
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*)::int AS total FROM movies WHERE mpa_rating = $1`;
  const dataSql = `
    SELECT 
      m.movie_id, m.title, m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') AS directors,
      STRING_AGG(DISTINCT g.genre_name, ', ')    AS genres,
      m.release_date, m.runtime_minutes, m.overview,
      m.budget::int8, m.revenue::int8, m.mpa_rating,
      m.poster_url, m.backdrop_url
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d       ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg   ON m.movie_id = mg.movie_id
    LEFT JOIN genres g          ON mg.genre_id  = g.genre_id
    WHERE m.mpa_rating = $1
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.release_date DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const [countR, dataR] = await Promise.all([
      pool.query<{ total: number; }>(countSql, [rating]),
      pool.query<Movie>(dataSql, [rating, limit, offset]),
    ]);
    const total = countR.rows[0].total;
    if (total === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found with rating: ${rating}`)
      );
    }
    const pages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      data: dataR.rows,
      meta: { page, limit, total, pages, query: { rating } },
    });
  } catch (err) {
    return res.status(500).json(ApiError.internalError(err));
  }
};

/**
 * Get all movies that belong to a specific collection/franchise
 * Returns movies in chronological order within the collection
 * 
 * @param req - Express request object with collection name in query params
 * @param res - Express response object
 */
export const getMoviesByCollection = async (req: Request, res: Response) => {
  const collectionName = req.query.name;

  if (!collectionName || typeof collectionName !== 'string') {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("Collection name is required")
    );
  }

  const sql = `
    SELECT 
      m.title,
      m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date,
      m.runtime_minutes,
      m.overview,
      m.budget::int8,
      m.revenue::int8,
      m.mpa_rating,
      m.poster_url,
      m.backdrop_url,
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
  `;

  try {
    const result = await pool.query(sql, [`%${collectionName}%`]);

    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found in the specified collection')
      );
    }

    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Retrieves all movies from the database with optional year filtering and pagination.
 * 
 * Returns a paginated list of movies with aggregated relationship data
 * (directors, genres). Movies are sorted alphabetically by title. Executes
 * two parallel queries: one for the movie data and one for the total count.
 * 
 * **Query Features:**
 * - Optional filtering by release year (exact match on release_date year)
 * - Pagination support with configurable page size (1-100 items)
 * - Aggregates multiple directors and genres into comma-separated strings
 * - Returns complete movie metadata including financial data and media URLs
 * - Parallel query execution for optimal performance
 * 
 * **Pagination Behavior:**
 * - Default page size: 20 results
 * - Maximum page size: 100 results
 * - Returns pagination metadata including total count, pages, and navigation flags
 * - Zero-indexed offset calculation: (page - 1) × limit
 * 
 * **Response Structure:**
 * The response includes a `data` array containing Movie objects and a `pagination`
 * object with navigation metadata.
 * 
 * @route GET /api/movies?year=YYYY&page=N&limit=N
 * @param req - Express request object
 * @param req.query.year - Optional 4-digit release year filter (must be positive integer)
 * @param req.query.page - Page number starting from 1 (default: 1)
 * @param req.query.limit - Number of movies per page, 1-100 (default: 20)
 * @param res - Express response object
 * @returns 200 - Paginated movie data with metadata
 * @returns 400 - Invalid query parameters (Zod validation errors)
 * @returns 500 - Database or server error
 * 
 * @example
 * // Request: GET /api/movies?year=2023&page=2&limit=10
 * // Response:
 * {
 *   "data": [
 *     {
 *       "title": "Oppenheimer",
 *       "original_title": "Oppenheimer",
 *       "directors": "Christopher Nolan",
 *       "genres": "Biography, Drama, History",
 *       "release_date": "2023-07-21T00:00:00.000Z",
 *       "runtime_minutes": 180,
 *       "overview": "The story of American scientist J. Robert Oppenheimer...",
 *       "budget": 100000000,
 *       "revenue": 952000000,
 *       "mpa_rating": "R",
 *       "poster_url": "https://image.tmdb.org/t/p/w500/...",
 *       "backdrop_url": "https://image.tmdb.org/t/p/original/..."
 *     }
 *     // ... 9 more movies
 *   ],
 *   "pagination": {
 *     "currentPage": 2,
 *     "pageSize": 10,
 *     "totalItems": 45,
 *     "totalPages": 5,
 *     "hasNextPage": true,
 *     "hasPreviousPage": true
 *   }
 * }
 * 
 * @example
 * // Request: GET /api/movies (no parameters - uses defaults)
 * // Response: First 20 movies alphabetically with full pagination metadata
 * 
 * @example
 * // Request: GET /api/movies?limit=5
 * // Response: First 5 movies with pagination showing totalPages based on limit
 */
export const getAllMovies = async (req: Request, res: Response) => {
  const validation = getAllMoviesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest(validation.error.issues)
    );
  }

  const { year, page, limit } = validation.data;

  const offset = (page - 1) * limit;

  let sql = `
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
  `;

  // Build count query for total items
  let countSql = `
    SELECT COUNT(DISTINCT m.movie_id) as total
    FROM movies m
  `;

  // Add WHERE clause if year filter is provided
  const params: number[] = [];
  const countParams: number[] = [];

  if (year) {
    const whereClause = ' WHERE EXTRACT(YEAR FROM m.release_date) = $1';
    sql += whereClause;
    countSql += whereClause;
    params.push(year);
    countParams.push(year);
  }

  // Complete the main query with GROUP BY, ORDER BY, and pagination
  sql += `
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.title
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);

  try {
    // Execute both queries in parallel for better performance
    const [moviesResult, countResult] = await Promise.all([
      pool.query<Movie>(sql, params),
      pool.query<{ total: string; }>(countSql, countParams)
    ]);

    const movies: Movie[] = moviesResult.rows;
    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // Return paginated response with metadata
    res.status(200).json({
      data: movies,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Retrieves a single movie by its unique ID.
 * 
 * Returns detailed movie information including aggregated directors and genres.
 * Performs a join across multiple tables to compile complete movie data.
 * 
 * **Query Features:**
 * - Aggregates multiple directors and genres into comma-separated strings
 * - Returns complete movie metadata including financial data and media URLs
 * 
 * @route GET /api/movies/:id
 * @param req - Express request object
 * @param req.params.id - The movie ID to retrieve (must be a valid number)
 * @param res - Express response object
 * @returns 200 - Movie object with complete details
 * @returns 400 - Invalid ID parameter (not a number)
 * @returns 404 - Movie not found with the specified ID
 * @returns 500 - Database or server error
 * 
 * @example
 * // Request: GET /api/movies/123
 * // Response: Single movie object with all details
 */
export const getMovieById = async (req: Request, res: Response) => {
  const idParam = req.params.id;
  let id: number | undefined = 0;

  if (typeof idParam === 'string') {
    id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("id must be a number"));
    }
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
    ORDER BY m.title
    `;

  try {
    const result = await pool.query<Movie>(sql, [id]);
    if (!result || result.rowCount == 0) { return res.status(404).json(ApiError.notFound('movie not found')); }
    const movie: Movie = result.rows[0];
    res.status(200).json(movie);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Search for movies by actor name
 * Returns all movies featuring the specified actor, including their character name and profile image
 * 
 * @param req - Express request object with actor name in query params
 * @param res - Express response object
 */
export const getMoviesByActor = async (req: Request, res: Response) => {
  const actorName = req.query.name;

  if (!actorName || typeof actorName !== 'string') {
    return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("Actor name is required"));
  }

  const sql = `
    SELECT DISTINCT
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
      m.backdrop_url,
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
  `;

  try {
    const result = await pool.query(sql, [`%${actorName}%`]);
    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found featuring actor: ${actorName}`)
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Filter movies by financial criteria (budget and revenue)
 * Returns movies that meet the specified financial thresholds
 * 
 * @param req - Express request object with financial criteria in query params:
 *              - minBudget: minimum budget threshold (optional)
 *              - maxBudget: maximum budget threshold (optional)
 *              - minRevenue: minimum revenue threshold (optional)
 *              - maxRevenue: maximum revenue threshold (optional)
 * @param res - Express response object
 */
export const getMoviesByFinancial = async (req: Request, res: Response) => {
  const {
    minBudget,
    maxBudget,
    minRevenue,
    maxRevenue
  } = req.query;

  // Convert string parameters to numbers and validate
  const filters = {
    minBudget: typeof minBudget === 'string' ? parseInt(minBudget) : undefined,
    maxBudget: typeof maxBudget === 'string' ? parseInt(maxBudget) : undefined,
    minRevenue: typeof minRevenue === 'string' ? parseInt(minRevenue) : undefined,
    maxRevenue: typeof maxRevenue === 'string' ? parseInt(maxRevenue) : undefined
  };

  // Validate at least one filter is provided
  if (!Object.values(filters).some(val => val !== undefined)) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("At least one financial filter (minBudget, maxBudget, minRevenue, maxRevenue) must be provided")
    );
  }

  // Validate that provided values are valid numbers
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && isNaN(value)) {
      return res.status(HttpStatus.BAD_REQUEST).json(
        ApiError.badRequest(`${key} must be a valid number`)
      );
    }
  }

  // Build WHERE clause dynamically based on provided filters
  const whereConditions: string[] = [];
  const params: number[] = [];
  let paramCounter = 1;

  if (filters.minBudget !== undefined) {
    whereConditions.push(`budget >= $${paramCounter}`);
    params.push(filters.minBudget);
    paramCounter++;
  }
  if (filters.maxBudget !== undefined) {
    whereConditions.push(`budget <= $${paramCounter}`);
    params.push(filters.maxBudget);
    paramCounter++;
  }
  if (filters.minRevenue !== undefined) {
    whereConditions.push(`revenue >= $${paramCounter}`);
    params.push(filters.minRevenue);
    paramCounter++;
  }
  if (filters.maxRevenue !== undefined) {
    whereConditions.push(`revenue <= $${paramCounter}`);
    params.push(filters.maxRevenue);
    paramCounter++;
  }

  const sql = `
    SELECT 
      m.title,
      m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date,
      m.runtime_minutes,
      m.overview,
      m.budget::int8,
      m.revenue::int8,
      m.mpa_rating,
      m.poster_url,
      m.backdrop_url,
      (m.revenue - m.budget)::int8 as profit
    FROM movies m
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    LEFT JOIN movie_studios ms ON m.movie_id = ms.movie_id
    LEFT JOIN studios s ON ms.studio_id = s.studio_id
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.revenue DESC
  `;

  try {
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found matching the specified financial criteria')
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Search for movies by director name
 * Returns all movies directed by the specified filmmaker, including co-directed films
 * 
 * @param req - Express request object with director name in query params
 * @param res - Express response object
 */
export const getMoviesByDirector = async (req: Request, res: Response) => {
  const directorName = req.query.name;

  if (!directorName || typeof directorName !== 'string') {
    return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("Director name is required"));
  }

  const sql = `
    SELECT 
      m.title,
      m.original_title,
      STRING_AGG(DISTINCT d2.director_name, ', ') as directors,
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
  `;

  try {
    const result = await pool.query(sql, [`%${directorName}%`]);
    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found directed by: ${directorName}`)
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Advanced multi-criteria search for movies
 * Combines multiple filters to create highly specific searches
 * 
 * @param req - Express request object with query parameters:
 *              - genre: genre name filter (optional)
 *              - actor: actor name filter (optional)
 *              - studio: studio name filter (optional)
 *              - mpaRating: MPA rating filter (optional)
 *              - minBudget: minimum budget threshold (optional)
 *              - maxBudget: maximum budget threshold (optional)
 *              - startDate: release date range start (optional, ISO format)
 *              - endDate: release date range end (optional, ISO format)
 * @param res - Express response object
 */
export const getMoviesByMultiFilter = async (req: Request, res: Response) => {
  const {
    genre,
    actor,
    studio,
    mpaRating,
    minBudget,
    maxBudget,
    startDate,
    endDate
  } = req.query;

  // Validate at least one filter is provided
  if (!genre && !actor && !studio && !mpaRating && !minBudget && !maxBudget && !startDate && !endDate) {
    return res.status(HttpStatus.BAD_REQUEST).json(
      ApiError.badRequest("At least one search criteria must be provided")
    );
  }

  // Build WHERE clause dynamically based on provided filters
  const whereConditions: string[] = [];
  const params: (string | number | Date)[] = [];
  let paramCounter = 1;

  // Genre filter
  if (typeof genre === 'string' && genre.trim()) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_genres mg2 
      JOIN genres g2 ON mg2.genre_id = g2.genre_id 
      WHERE mg2.movie_id = m.movie_id 
      AND LOWER(g2.genre_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${genre.trim()}%`);
    paramCounter++;
  }

  // Actor filter
  if (typeof actor === 'string' && actor.trim()) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_actors ma2 
      JOIN actors a2 ON ma2.actor_id = a2.actor_id 
      WHERE ma2.movie_id = m.movie_id 
      AND LOWER(a2.actor_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${actor.trim()}%`);
    paramCounter++;
  }

  // Studio filter
  if (typeof studio === 'string' && studio.trim()) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM movie_studios ms2 
      JOIN studios s2 ON ms2.studio_id = s2.studio_id 
      WHERE ms2.movie_id = m.movie_id 
      AND LOWER(s2.studio_name) LIKE LOWER($${paramCounter})
    )`);
    params.push(`%${studio.trim()}%`);
    paramCounter++;
  }

  // MPA Rating filter
  if (typeof mpaRating === 'string' && mpaRating.trim()) {
    whereConditions.push(`m.mpa_rating = $${paramCounter}`);
    params.push(mpaRating.trim().toUpperCase());
    paramCounter++;
  }

  // Budget range filters
  if (typeof minBudget === 'string') {
    const minBudgetNum = parseInt(minBudget);
    if (!isNaN(minBudgetNum)) {
      whereConditions.push(`m.budget >= $${paramCounter}`);
      params.push(minBudgetNum);
      paramCounter++;
    }
  }

  if (typeof maxBudget === 'string') {
    const maxBudgetNum = parseInt(maxBudget);
    if (!isNaN(maxBudgetNum)) {
      whereConditions.push(`m.budget <= $${paramCounter}`);
      params.push(maxBudgetNum);
      paramCounter++;
    }
  }

  // Date range filters
  if (typeof startDate === 'string') {
    try {
      const date = new Date(startDate);
      if (!isNaN(date.getTime())) {
        whereConditions.push(`m.release_date >= $${paramCounter}`);
        params.push(date);
        paramCounter++;
      }
    } catch {
      // ignore
    }
  }

  if (typeof endDate === 'string') {
    try {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        whereConditions.push(`m.release_date <= $${paramCounter}`);
        params.push(date);
        paramCounter++;
      }
    } catch {
      // ignore
    }
  }

  const sql = `
    SELECT 
      m.title,
      m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s.studio_name, ', ') as studios,
      m.release_date,
      m.runtime_minutes,
      m.overview,
      m.budget::int8,
      m.revenue::int8,
      m.mpa_rating,
      m.poster_url,
      m.backdrop_url,
      c.collection_name,
      (m.revenue - m.budget)::int8 as profit,
      ARRAY_AGG(DISTINCT JSONB_BUILD_OBJECT(
        'actor_name', a.actor_name,
        'character_name', ma.character_name,
        'profile_url', a.profile_url
      )) FILTER (WHERE a.actor_id IS NOT NULL) as cast_members
    FROM movies m
    LEFT JOIN collections c ON m.collection_id = c.collection_id
    LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
    LEFT JOIN directors d ON md.director_id = d.director_id
    LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.genre_id
    LEFT JOIN movie_studios ms ON m.movie_id = ms.movie_id
    LEFT JOIN studios s ON ms.studio_id = s.studio_id
    LEFT JOIN movie_actors ma ON m.movie_id = ma.movie_id
    LEFT JOIN actors a ON ma.actor_id = a.actor_id
    ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    GROUP BY 
      m.movie_id, m.title, m.original_title, m.release_date,
      m.runtime_minutes, m.overview, m.budget, m.revenue,
      m.mpa_rating, m.poster_url, m.backdrop_url, c.collection_name
    ORDER BY m.release_date DESC
  `;

  try {
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound('No movies found matching all specified criteria')
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};

/**
 * Search for movies by studio name
 * Returns all movies produced by the specified studio, including co-productions
 * 
 * @param req - Express request object with studio name in query params
 * @param res - Express response object
 */
export const getMoviesByStudio = async (req: Request, res: Response) => {
  const studioName = req.query.name;

  if (!studioName || typeof studioName !== 'string') {
    return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("Studio name is required"));
  }

  const sql = `
    SELECT 
      m.title,
      m.original_title,
      STRING_AGG(DISTINCT d.director_name, ', ') as directors,
      STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
      STRING_AGG(DISTINCT s2.studio_name, ', ') as studios,
      m.release_date,
      m.runtime_minutes,
      m.overview,
      m.budget::int8,
      m.revenue::int8,
      m.mpa_rating,
      m.poster_url,
      m.backdrop_url
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
  `;

  try {
    const result = await pool.query(sql, [`%${studioName}%`]);
    if (result.rowCount === 0) {
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiError.notFound(`No movies found produced by studio: ${studioName}`)
      );
    }
    res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error));
  }
};
