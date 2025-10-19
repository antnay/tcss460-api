import { Movie } from '@models';
import pool from '@utils/database';
import { Request, Response } from 'express';

/**
 * Fetch all movies, optionally filtering by release year.
 * @param req - Express request object.
 * @param res - Express response object.
 */
export const getAllMovies = async (req: Request, res: Response) => {
  const yearQuery = req.query.year;
  let year: number | undefined;

  // Validate and parse the year query parameter
  if (typeof yearQuery === 'string') {
    year = parseInt(yearQuery, 10);
    if (isNaN(year)) {
      return res.status(400).json({ error: 'Invalid year parameter' });
    }
  }

  // Base SQL query
  let sql = `
    select title, original_title, d.director_name, g.genre_name, release_date, runtime_minutes, overview, budget, revenue, mpa_rating, poster_url, backdrop_url
    from movies as m
    inner join movie_directors as md on m.movie_id = md.movie_id
    inner join directors as d on md.director_id = d.director_id
    inner join movie_genres as mg on m.movie_id = mg.movie_id
    inner join genres as g on mg.genre_id = g.genre_id
  `;

  // Add a WHERE clause if the year filter is provided
  const params: (number | undefined)[] = [];
  if (year) {
    sql += 'WHERE EXTRACT(YEAR FROM release_date) = $1';
    params.push(year);
  }

  try {
    // Execute the query with type annotation
    const result = await pool.query<Movie>(sql, params);
    
    // result.rows is now typed as Movie[]
    const movies: Movie[] = result.rows;
    
    res.status(200).json(movies);
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
