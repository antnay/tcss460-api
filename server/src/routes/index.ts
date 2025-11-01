import { Router } from 'express';
import * as c from '../controllers/index';

export const router = Router();

// System routes
router.get('/api-info', c.info);
router.get('/health', c.healthCheck);

router.post('/login', c.login)
router.post('/register', c.register)
router.get('/api-key', c.keyForm)
router.post('/api-key', c.generateKey)

// GET
router.get('/movies', c.getAllMovies);
router.get('/movies/:id', c.getMovieById);
router.get('/studios/:id/movies', c.getMoviesByStudioId);
router.get('/studios/name/:name/movies', c.getMoviesByStudio);
router.get('/directors/:id/movies', c.getMoviesByDirectorId);
router.get('/directors/name/:name/movies', c.getMoviesByDirector);
router.get('/actors/:id/movies', c.getMoviesByActorId);
router.get('/actors/name/:name/movies', c.getMoviesByActor);
router.get('/collections/:id/movies', c.getMoviesByCollectionId);
router.get('/collections/name/:name/movies', c.getMoviesByCollection);

// POST routes - Add movies
router.post('/movies', c.addMovie);
router.post('/movies/bulk', c.addMoviesBulk);

// PUT routes - Complete update
router.put('/movies/:id', c.updateMovie);

// PATCH routes - Partial updates
router.patch('/movies/:id', c.patchMovie);
router.patch('/movies/:id/cast', c.updateCast);

// DELETE routes - Delete movie
router.delete('/movies/:id', c.deleteMovieById);

export default router;
