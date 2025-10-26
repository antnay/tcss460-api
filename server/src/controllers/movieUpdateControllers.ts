import { MovieUpdateInput, CastMember, Studio } from '@models/movieModel';
import pool from '@utils/database';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';

/**
 * Helper functions (same as in POST controllers)
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
 * PUT - Update complete movie record (replaces all data)
 */
export const updateMovie = async (req: Request, res: Response) => {
  const movieId = parseInt(req.params.id, 10);
  
  if (isNaN(movieId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid movie ID'
    });
  }
  
  const movieData: MovieUpdateInput = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if movie exists
    const checkResult = await client.query('SELECT movie_id FROM movies WHERE movie_id = $1', [movieId]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    // Build dynamic UPDATE query for movies table
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    
    if (movieData.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(movieData.title);
    }
    if (movieData.original_title !== undefined) {
      updateFields.push(`original_title = $${paramIndex++}`);
      updateValues.push(movieData.original_title);
    }
    if (movieData.release_date !== undefined) {
      updateFields.push(`release_date = $${paramIndex++}`);
      updateValues.push(movieData.release_date);
    }
    if (movieData.runtime_minutes !== undefined) {
      updateFields.push(`runtime_minutes = $${paramIndex++}`);
      updateValues.push(movieData.runtime_minutes);
    }
    if (movieData.overview !== undefined) {
      updateFields.push(`overview = $${paramIndex++}`);
      updateValues.push(movieData.overview);
    }
    if (movieData.budget !== undefined) {
      updateFields.push(`budget = $${paramIndex++}`);
      updateValues.push(movieData.budget);
    }
    if (movieData.revenue !== undefined) {
      updateFields.push(`revenue = $${paramIndex++}`);
      updateValues.push(movieData.revenue);
    }
    if (movieData.mpa_rating !== undefined) {
      updateFields.push(`mpa_rating = $${paramIndex++}`);
      updateValues.push(movieData.mpa_rating);
    }
    if (movieData.poster_url !== undefined) {
      updateFields.push(`poster_url = $${paramIndex++}`);
      updateValues.push(movieData.poster_url);
    }
    if (movieData.backdrop_url !== undefined) {
      updateFields.push(`backdrop_url = $${paramIndex++}`);
      updateValues.push(movieData.backdrop_url);
    }
    
    // Handle collection
    if (movieData.collection_name !== undefined) {
      const collectionId = movieData.collection_name 
        ? await getOrCreateCollectionId(client, movieData.collection_name)
        : null;
      updateFields.push(`collection_id = $${paramIndex++}`);
      updateValues.push(collectionId);
    }
    
    // Update movies table if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(movieId); // Add movieId as last parameter
      const updateSql = `
        UPDATE movies 
        SET ${updateFields.join(', ')} 
        WHERE movie_id = $${paramIndex}
      `;
      await client.query(updateSql, updateValues);
    }
    
    // Update genres (replace all)
    if (movieData.genres !== undefined) {
      await client.query('DELETE FROM movie_genres WHERE movie_id = $1', [movieId]);
      if (movieData.genres.length > 0) {
        for (const genreName of movieData.genres) {
          const genreId = await getOrCreateGenreId(client, genreName);
          await client.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)', [movieId, genreId]);
        }
      }
    }
    
    // Update directors (replace all)
    if (movieData.directors !== undefined) {
      await client.query('DELETE FROM movie_directors WHERE movie_id = $1', [movieId]);
      if (movieData.directors.length > 0) {
        for (const directorName of movieData.directors) {
          const directorId = await getOrCreateDirectorId(client, directorName);
          await client.query('INSERT INTO movie_directors (movie_id, director_id) VALUES ($1, $2)', [movieId, directorId]);
        }
      }
    }
    
    // Update producers (replace all)
    if (movieData.producers !== undefined) {
      await client.query('DELETE FROM movie_producers WHERE movie_id = $1', [movieId]);
      if (movieData.producers.length > 0) {
        for (const producerName of movieData.producers) {
          const producerId = await getOrCreateProducerId(client, producerName);
          await client.query('INSERT INTO movie_producers (movie_id, producer_id) VALUES ($1, $2)', [movieId, producerId]);
        }
      }
    }
    
    // Update studios (replace all)
    if (movieData.studios !== undefined) {
      await client.query('DELETE FROM movie_studios WHERE movie_id = $1', [movieId]);
      if (movieData.studios.length > 0) {
        for (const studio of movieData.studios) {
          const studioId = await getOrCreateStudioId(client, studio);
          await client.query('INSERT INTO movie_studios (movie_id, studio_id) VALUES ($1, $2)', [movieId, studioId]);
        }
      }
    }
    
    // Update cast (replace all)
    if (movieData.cast !== undefined) {
      await client.query('DELETE FROM movie_actors WHERE movie_id = $1', [movieId]);
      if (movieData.cast.length > 0) {
        const castToInsert = movieData.cast.slice(0, 10);
        for (const castMember of castToInsert) {
          const actorId = await getOrCreateActorId(client, castMember.actor_name, castMember.profile_url);
          await client.query(
            'INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES ($1, $2, $3, $4)',
            [movieId, actorId, castMember.character_name || null, castMember.actor_order]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({
      success: true,
      movie_id: movieId,
      message: 'Movie updated successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update movie',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
};

/**
 * PATCH - Update specific fields only
 */
export const patchMovie = async (req: Request, res: Response) => {
  const movieId = parseInt(req.params.id, 10);
  
  if (isNaN(movieId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid movie ID'
    });
  }
  
  const movieData: MovieUpdateInput = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if movie exists
    const checkResult = await client.query('SELECT movie_id FROM movies WHERE movie_id = $1', [movieId]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    // Build dynamic UPDATE query (same as PUT but only for provided fields)
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    
    if (movieData.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(movieData.title);
    }
    if (movieData.original_title !== undefined) {
      updateFields.push(`original_title = $${paramIndex++}`);
      updateValues.push(movieData.original_title);
    }
    if (movieData.release_date !== undefined) {
      updateFields.push(`release_date = $${paramIndex++}`);
      updateValues.push(movieData.release_date);
    }
    if (movieData.runtime_minutes !== undefined) {
      updateFields.push(`runtime_minutes = $${paramIndex++}`);
      updateValues.push(movieData.runtime_minutes);
    }
    if (movieData.overview !== undefined) {
      updateFields.push(`overview = $${paramIndex++}`);
      updateValues.push(movieData.overview);
    }
    if (movieData.budget !== undefined) {
      updateFields.push(`budget = $${paramIndex++}`);
      updateValues.push(movieData.budget);
    }
    if (movieData.revenue !== undefined) {
      updateFields.push(`revenue = $${paramIndex++}`);
      updateValues.push(movieData.revenue);
    }
    if (movieData.mpa_rating !== undefined) {
      updateFields.push(`mpa_rating = $${paramIndex++}`);
      updateValues.push(movieData.mpa_rating);
    }
    if (movieData.poster_url !== undefined) {
      updateFields.push(`poster_url = $${paramIndex++}`);
      updateValues.push(movieData.poster_url);
    }
    if (movieData.backdrop_url !== undefined) {
      updateFields.push(`backdrop_url = $${paramIndex++}`);
      updateValues.push(movieData.backdrop_url);
    }
    
    // Handle collection
    if (movieData.collection_name !== undefined) {
      const collectionId = movieData.collection_name 
        ? await getOrCreateCollectionId(client, movieData.collection_name)
        : null;
      updateFields.push(`collection_id = $${paramIndex++}`);
      updateValues.push(collectionId);
    }
    
    // Update movies table if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(movieId);
      const updateSql = `
        UPDATE movies 
        SET ${updateFields.join(', ')} 
        WHERE movie_id = $${paramIndex}
      `;
      await client.query(updateSql, updateValues);
    }
    
    // Only update related entities if explicitly provided
    if (movieData.genres !== undefined) {
      await client.query('DELETE FROM movie_genres WHERE movie_id = $1', [movieId]);
      if (movieData.genres.length > 0) {
        for (const genreName of movieData.genres) {
          const genreId = await getOrCreateGenreId(client, genreName);
          await client.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)', [movieId, genreId]);
        }
      }
    }
    
    if (movieData.directors !== undefined) {
      await client.query('DELETE FROM movie_directors WHERE movie_id = $1', [movieId]);
      if (movieData.directors.length > 0) {
        for (const directorName of movieData.directors) {
          const directorId = await getOrCreateDirectorId(client, directorName);
          await client.query('INSERT INTO movie_directors (movie_id, director_id) VALUES ($1, $2)', [movieId, directorId]);
        }
      }
    }
    
    if (movieData.producers !== undefined) {
      await client.query('DELETE FROM movie_producers WHERE movie_id = $1', [movieId]);
      if (movieData.producers.length > 0) {
        for (const producerName of movieData.producers) {
          const producerId = await getOrCreateProducerId(client, producerName);
          await client.query('INSERT INTO movie_producers (movie_id, producer_id) VALUES ($1, $2)', [movieId, producerId]);
        }
      }
    }
    
    if (movieData.studios !== undefined) {
      await client.query('DELETE FROM movie_studios WHERE movie_id = $1', [movieId]);
      if (movieData.studios.length > 0) {
        for (const studio of movieData.studios) {
          const studioId = await getOrCreateStudioId(client, studio);
          await client.query('INSERT INTO movie_studios (movie_id, studio_id) VALUES ($1, $2)', [movieId, studioId]);
        }
      }
    }
    
    if (movieData.cast !== undefined) {
      await client.query('DELETE FROM movie_actors WHERE movie_id = $1', [movieId]);
      if (movieData.cast.length > 0) {
        const castToInsert = movieData.cast.slice(0, 10);
        for (const castMember of castToInsert) {
          const actorId = await getOrCreateActorId(client, castMember.actor_name, castMember.profile_url);
          await client.query(
            'INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES ($1, $2, $3, $4)',
            [movieId, actorId, castMember.character_name || null, castMember.actor_order]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({
      success: true,
      movie_id: movieId,
      message: 'Movie updated successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update movie',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
};

/**
 * PATCH - Update cast members specifically
 */
export const updateCast = async (req: Request, res: Response) => {
  const movieId = parseInt(req.params.id, 10);
  
  if (isNaN(movieId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid movie ID'
    });
  }
  
  const cast: CastMember[] = req.body.cast;
  
  if (!Array.isArray(cast)) {
    return res.status(400).json({
      success: false,
      message: 'Request body must contain a "cast" array'
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if movie exists
    const checkResult = await client.query('SELECT movie_id FROM movies WHERE movie_id = $1', [movieId]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    // Delete existing cast
    await client.query('DELETE FROM movie_actors WHERE movie_id = $1', [movieId]);
    
    // Insert new cast (max 10)
    if (cast.length > 0) {
      const castToInsert = cast.slice(0, 10);
      for (const castMember of castToInsert) {
        const actorId = await getOrCreateActorId(client, castMember.actor_name, castMember.profile_url);
        await client.query(
          'INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES ($1, $2, $3, $4)',
          [movieId, actorId, castMember.character_name || null, castMember.actor_order]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({
      success: true,
      movie_id: movieId,
      message: 'Cast updated successfully',
      cast_count: Math.min(cast.length, 10)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update cast',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
};