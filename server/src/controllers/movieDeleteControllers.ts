import pool from '@utils/database';
import { ApiError } from '@utils/httpError';
import { HttpStatus } from '@utils/httpStatus';
import { Request, Response } from 'express';

/**
 * Deletes a movie by its ID with comprehensive audit logging.
 * 
 * This endpoint permanently removes a movie from the database along with all
 * associated relationships (directors, genres, studios) via CASCADE deletion.
 * The operation is wrapped in a database transaction to ensure atomicity.
 * 
 * **Process Flow:**
 * 1. Validates the movie ID parameter
 * 2. Retrieves complete movie details for audit logging
 * 3. Logs deletion information (console + optional audit table)
 * 4. Performs the deletion via transaction
 * 5. Returns deleted movie details in response
 * 
 * **Database Impact:**
 * - Deletes from `movies` table
 * - CASCADE deletes related records in:
 *   - movie_directors
 *   - movie_genres
 *   - movie_studios
 * 
 * @route DELETE /api/movies/:id
 * @param req.params.id - The movie ID to delete (must be positive integer)
 * @returns 200 - Success with deleted movie details
 * @returns 400 - Invalid or missing ID parameter
 * @returns 404 - Movie not found
 * @returns 500 - Database or server error
 * 
 * @example
 * // Success response:
 * {
 *   "success": true,
 *   "message": "Movie \"The Shawshank Redemption\" has been permanently deleted",
 *   "deleted_movie": {
 *     "movie_id": 123,
 *     "title": "The Shawshank Redemption",
 *     "original_title": "The Shawshank Redemption",
 *     "release_date": "1994-09-23",
 *     "directors": "Frank Darabont",
 *     "genres": "Drama, Crime",
 *     "studios": "Castle Rock Entertainment",
 *     "deleted_at": "2025-10-26T10:30:00.000Z"
 *   },
 *   "warning": "This action cannot be undone"
 * }
 */
export const deleteMovieById = async (req: Request, res: Response) => {
    const idParam = req.params.id;
    let id: number;

    // Validate ID parameter
    if (typeof idParam === 'string') {
        id = parseInt(idParam, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json(
                ApiError.badRequest("id must be a valid positive number")
            );
        }
    } else {
        return res.status(HttpStatus.BAD_REQUEST).json(
            ApiError.badRequest("id parameter is required")
        );
    }

    // Use a transaction to ensure atomic operation
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First, retrieve the movie details for audit logging
        const getMovieSql = `
      SELECT 
        m.movie_id,
        m.title, 
        m.original_title, 
        m.release_date,
        m.runtime_minutes,
        m.budget,
        m.revenue,
        STRING_AGG(DISTINCT d.director_name, ', ') as directors,
        STRING_AGG(DISTINCT g.genre_name, ', ') as genres,
        STRING_AGG(DISTINCT s.studio_name, ', ') as studios
      FROM movies m
      LEFT JOIN movie_directors md ON m.movie_id = md.movie_id
      LEFT JOIN directors d ON md.director_id = d.director_id
      LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.genre_id
      LEFT JOIN movie_studios ms ON m.movie_id = ms.movie_id
      LEFT JOIN studios s ON ms.studio_id = s.studio_id
      WHERE m.movie_id = $1
      GROUP BY m.movie_id, m.title, m.original_title, m.release_date, 
               m.runtime_minutes, m.budget, m.revenue
    `;

        const movieResult = await client.query(getMovieSql, [id]);

        // Check if movie exists
        if (!movieResult || movieResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(HttpStatus.NOT_FOUND).json(
                ApiError.notFound(`Movie with id ${id} not found`)
            );
        }

        const movieToDelete = movieResult.rows[0];

        // Log the deletion for audit purposes
        // Note: You may want to create a separate audit_log table for this
        console.log('AUDIT LOG - Movie Deletion:', {
            movie_id: movieToDelete.movie_id,
            title: movieToDelete.title,
            original_title: movieToDelete.original_title,
            release_date: movieToDelete.release_date,
            directors: movieToDelete.directors,
            genres: movieToDelete.genres,
            studios: movieToDelete.studios,
            deleted_at: new Date().toISOString(),
            // deleted_by: req.user?.id || 'system' // If you have user authentication
        });

        // Optional: Insert into audit log table
        // If you create an audit_log table, uncomment and modify this:
        /*
        const auditLogSql = `
          INSERT INTO movie_deletion_log 
            (movie_id, title, original_title, release_date, deleted_at, deleted_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(auditLogSql, [
          movieToDelete.movie_id,
          movieToDelete.title,
          movieToDelete.original_title,
          movieToDelete.release_date,
          new Date(),
          req.user?.id || 'system'
        ]);
        */

        // Delete the movie (CASCADE will handle related records)
        const deleteSql = 'DELETE FROM movies WHERE movie_id = $1';
        const deleteResult = await client.query(deleteSql, [id]);

        await client.query('COMMIT');

        // Return success response with deleted movie information
        return res.status(HttpStatus.OK).json({
            success: true,
            message: `Movie "${movieToDelete.title}" has been permanently deleted`,
            deleted_movie: {
                movie_id: movieToDelete.movie_id,
                title: movieToDelete.title,
                original_title: movieToDelete.original_title,
                release_date: movieToDelete.release_date,
                directors: movieToDelete.directors,
                genres: movieToDelete.genres,
                studios: movieToDelete.studios,
                deleted_at: new Date().toISOString()
            },
            warning: 'This action cannot be undone'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting movie:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
            ApiError.internalError('Failed to delete movie')
        );
    } finally {
        client.release();
    }
};