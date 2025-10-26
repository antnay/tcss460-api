import { MovieCreateInput, MovieCreateResponse, BulkImportResponse, Studio, CastMember } from '@models/movieModel';
import pool from '@utils/database';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';

/**
 * Helper function to get or create a genre and return its ID
 */
const getOrCreateGenreId = async (client: PoolClient, genreName: string): Promise<number> => {
  const checkSql = 'SELECT genre_id FROM genres WHERE genre_name = $1';
  let result = await client.query(checkSql, [genreName.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].genre_id;
  }
  
  const insertSql = 'INSERT INTO genres (genre_name) VALUES ($1) RETURNING genre_id';
  result = await client.query(insertSql, [genreName.trim()]);
  return result.rows[0].genre_id;
};

/**
 * Helper function to get or create a director and return its ID
 */
const getOrCreateDirectorId = async (client: PoolClient, directorName: string): Promise<number> => {
  const checkSql = 'SELECT director_id FROM directors WHERE director_name = $1';
  let result = await client.query(checkSql, [directorName.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].director_id;
  }
  
  const insertSql = 'INSERT INTO directors (director_name) VALUES ($1) RETURNING director_id';
  result = await client.query(insertSql, [directorName.trim()]);
  return result.rows[0].director_id;
};

/**
 * Helper function to get or create a producer and return its ID
 */
const getOrCreateProducerId = async (client: PoolClient, producerName: string): Promise<number> => {
  const checkSql = 'SELECT producer_id FROM producers WHERE producer_name = $1';
  let result = await client.query(checkSql, [producerName.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].producer_id;
  }
  
  const insertSql = 'INSERT INTO producers (producer_name) VALUES ($1) RETURNING producer_id';
  result = await client.query(insertSql, [producerName.trim()]);
  return result.rows[0].producer_id;
};

/**
 * Helper function to get or create a studio and return its ID
 */
const getOrCreateStudioId = async (client: PoolClient, studio: Studio): Promise<number> => {
  const checkSql = 'SELECT studio_id FROM studios WHERE studio_name = $1';
  let result = await client.query(checkSql, [studio.studio_name.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].studio_id;
  }
  
  const insertSql = `
    INSERT INTO studios (studio_name, logo_url, country) 
    VALUES ($1, $2, $3) 
    RETURNING studio_id
  `;
  result = await client.query(insertSql, [
    studio.studio_name.trim(),
    studio.logo_url || null,
    studio.country || null
  ]);
  return result.rows[0].studio_id;
};

/**
 * Helper function to get or create an actor and return its ID
 */
const getOrCreateActorId = async (client: PoolClient, actorName: string, profileUrl?: string): Promise<number> => {
  const checkSql = 'SELECT actor_id FROM actors WHERE actor_name = $1';
  let result = await client.query(checkSql, [actorName.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].actor_id;
  }
  
  const insertSql = 'INSERT INTO actors (actor_name, profile_url) VALUES ($1, $2) RETURNING actor_id';
  result = await client.query(insertSql, [actorName.trim(), profileUrl || null]);
  return result.rows[0].actor_id;
};

/**
 * Helper function to get or create a collection and return its ID
 */
const getOrCreateCollectionId = async (client: PoolClient, collectionName: string): Promise<number> => {
  const checkSql = 'SELECT collection_id FROM collections WHERE collection_name = $1';
  let result = await client.query(checkSql, [collectionName.trim()]);
  
  if (result.rows.length > 0) {
    return result.rows[0].collection_id;
  }
  
  const insertSql = 'INSERT INTO collections (collection_name) VALUES ($1) RETURNING collection_id';
  result = await client.query(insertSql, [collectionName.trim()]);
  return result.rows[0].collection_id;
};

/**
 * Main function to add a single movie with all related data
 */
export const addMovie = async (req: Request, res: Response) => {
  const movieData: MovieCreateInput = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Handle collection if provided
    let collectionId: number | null = null;
    if (movieData.collection_name) {
      collectionId = await getOrCreateCollectionId(client, movieData.collection_name);
    }
    
    // Insert the main movie record
    const movieInsertSql = `
      INSERT INTO movies (
        title, original_title, release_date, runtime_minutes, 
        overview, budget, revenue, mpa_rating, collection_id,
        poster_url, backdrop_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING movie_id
    `;
    
    const movieResult = await client.query(movieInsertSql, [
      movieData.title,
      movieData.original_title,
      movieData.release_date,
      movieData.runtime_minutes,
      movieData.overview,
      movieData.budget || null,
      movieData.revenue || null,
      movieData.mpa_rating,
      collectionId,
      movieData.poster_url || null,
      movieData.backdrop_url || null
    ]);
    
    const movieId = movieResult.rows[0].movie_id;
    
    // Insert genres (required)
    if (movieData.genres && movieData.genres.length > 0) {
      for (const genreName of movieData.genres) {
        const genreId = await getOrCreateGenreId(client, genreName);
        await client.query(
          'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)',
          [movieId, genreId]
        );
      }
    }
    
    // Insert directors (optional)
    if (movieData.directors && movieData.directors.length > 0) {
      for (const directorName of movieData.directors) {
        const directorId = await getOrCreateDirectorId(client, directorName);
        await client.query(
          'INSERT INTO movie_directors (movie_id, director_id) VALUES ($1, $2)',
          [movieId, directorId]
        );
      }
    }
    
    // Insert producers (optional)
    if (movieData.producers && movieData.producers.length > 0) {
      for (const producerName of movieData.producers) {
        const producerId = await getOrCreateProducerId(client, producerName);
        await client.query(
          'INSERT INTO movie_producers (movie_id, producer_id) VALUES ($1, $2)',
          [movieId, producerId]
        );
      }
    }
    
    // Insert studios (optional)
    if (movieData.studios && movieData.studios.length > 0) {
      for (const studio of movieData.studios) {
        const studioId = await getOrCreateStudioId(client, studio);
        await client.query(
          'INSERT INTO movie_studios (movie_id, studio_id) VALUES ($1, $2)',
          [movieId, studioId]
        );
      }
    }
    
    // Insert cast (optional, max 10)
    if (movieData.cast && movieData.cast.length > 0) {
      const castToInsert = movieData.cast.slice(0, 10); // Limit to 10
      for (const castMember of castToInsert) {
        const actorId = await getOrCreateActorId(client, castMember.actor_name, castMember.profile_url);
        await client.query(
          'INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES ($1, $2, $3, $4)',
          [movieId, actorId, castMember.character_name || null, castMember.actor_order]
        );
      }
    }
    
    await client.query('COMMIT');
    
    const response: MovieCreateResponse = {
      success: true,
      movie_id: movieId,
      message: `Movie "${movieData.title}" added successfully`
    };
    
    res.status(201).json(response);
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to add movie',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
};

/**
 * Bulk import multiple movies
 */
export const addMoviesBulk = async (req: Request, res: Response) => {
  const movies: MovieCreateInput[] = req.body.movies;
  
  if (!Array.isArray(movies) || movies.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body must contain a "movies" array with at least one movie'
    });
  }
  
  const results: BulkImportResponse['results'] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const movieData of movies) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Handle collection
      let collectionId: number | null = null;
      if (movieData.collection_name) {
        collectionId = await getOrCreateCollectionId(client, movieData.collection_name);
      }
      
      // Insert movie
      const movieInsertSql = `
        INSERT INTO movies (
          title, original_title, release_date, runtime_minutes, 
          overview, budget, revenue, mpa_rating, collection_id,
          poster_url, backdrop_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING movie_id
      `;
      
      const movieResult = await client.query(movieInsertSql, [
        movieData.title,
        movieData.original_title,
        movieData.release_date,
        movieData.runtime_minutes,
        movieData.overview,
        movieData.budget || null,
        movieData.revenue || null,
        movieData.mpa_rating,
        collectionId,
        movieData.poster_url || null,
        movieData.backdrop_url || null
      ]);
      
      const movieId = movieResult.rows[0].movie_id;
      
      // Insert all related entities (same as addMovie)
      if (movieData.genres && movieData.genres.length > 0) {
        for (const genreName of movieData.genres) {
          const genreId = await getOrCreateGenreId(client, genreName);
          await client.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)', [movieId, genreId]);
        }
      }
      
      if (movieData.directors && movieData.directors.length > 0) {
        for (const directorName of movieData.directors) {
          const directorId = await getOrCreateDirectorId(client, directorName);
          await client.query('INSERT INTO movie_directors (movie_id, director_id) VALUES ($1, $2)', [movieId, directorId]);
        }
      }
      
      if (movieData.producers && movieData.producers.length > 0) {
        for (const producerName of movieData.producers) {
          const producerId = await getOrCreateProducerId(client, producerName);
          await client.query('INSERT INTO movie_producers (movie_id, producer_id) VALUES ($1, $2)', [movieId, producerId]);
        }
      }
      
      if (movieData.studios && movieData.studios.length > 0) {
        for (const studio of movieData.studios) {
          const studioId = await getOrCreateStudioId(client, studio);
          await client.query('INSERT INTO movie_studios (movie_id, studio_id) VALUES ($1, $2)', [movieId, studioId]);
        }
      }
      
      if (movieData.cast && movieData.cast.length > 0) {
        const castToInsert = movieData.cast.slice(0, 10);
        for (const castMember of castToInsert) {
          const actorId = await getOrCreateActorId(client, castMember.actor_name, castMember.profile_url);
          await client.query(
            'INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES ($1, $2, $3, $4)',
            [movieId, actorId, castMember.character_name || null, castMember.actor_order]
          );
        }
      }
      
      await client.query('COMMIT');
      
      results.push({
        title: movieData.title,
        success: true,
        movie_id: movieId
      });
      successCount++;
      
    } catch (error) {
      await client.query('ROLLBACK');
      results.push({
        title: movieData.title,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      failCount++;
    } finally {
      client.release();
    }
  }
  
  const response: BulkImportResponse = {
    success: failCount === 0,
    total_processed: movies.length,
    successful: successCount,
    failed: failCount,
    results
  };
  
  res.status(failCount === 0 ? 201 : 207).json(response);
};