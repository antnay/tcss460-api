
import { Movie } from '@models/movieModel';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Request, Response } from 'express';

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
 * Fetch all movies, optionally filtering by release year.
 * 
 * @param req - Express request object.
 * @param res - Express response object.
 */
export const getAllMovies = async (req: Request, res: Response) => {
  const yearQuery = req.query.year;
  let year: number | undefined;

  if (typeof yearQuery === 'string') {
    year = parseInt(yearQuery, 10);
    if (isNaN(year)) {
      return res.status(HttpStatus.BAD_REQUEST).json(ApiError.badRequest("year must be a number"));
    }
  }

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

  // Add a WHERE clause if the year filter is provided
  const params: (number | undefined)[] = [];
  if (year) {
    sql += 'WHERE EXTRACT(YEAR FROM release_date) = $1';
    params.push(year);
  }

  sql += `
    GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
             m.runtime_minutes, m.overview, m.budget, m.revenue, 
             m.mpa_rating, m.poster_url, m.backdrop_url
    ORDER BY m.title
    `;

  try {
    const result = await pool.query<Movie>(sql, params);
    const movies: Movie[] = result.rows;
    res.status(200).json(movies);
  } catch (error) {
    return res.status(500).json(ApiError.internalError(error))
  }
};

/**
 * 
 * @param req 
 * @param res 
 */
export const getMoviesById = async (req: Request, res: Response) => {
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
    return res.status(500).json(ApiError.internalError(error))
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
export const getMoviesByFinancials = async (req: Request, res: Response) => {
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
