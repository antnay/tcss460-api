
import { Movie } from '@models/movieModel';
import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Request, Response } from 'express';

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
