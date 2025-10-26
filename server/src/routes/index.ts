// import { Router } from 'express';
// import * as c from '../controllers/index'
// export const router = Router();


// router.get('/api-info', c.info);
// router.get('/health', c.healthCheck);

// router.get('/movies', c.getAllMovies);
// router.get('/movies/:id', c.getMoviesById);

// router.post('/movies', c.addMovie);

// export default router;

import { Router } from 'express';
import * as c from '../controllers/index';

export const router = Router();

// System routes
router.get('/api-info', c.info);
router.get('/health', c.healthCheck);

// GET routes - Retrieve movies
router.get('/movies', c.getAllMovies);
router.get('/movies/:id', c.getMoviesById);

// POST routes - Add movies
router.post('/movies', c.addMovie);
router.post('/movies/bulk', c.addMoviesBulk);

// PUT routes - Complete update
router.put('/movies/:id', c.updateMovie);

// PATCH routes - Partial updates
router.patch('/movies/:id', c.patchMovie);
router.patch('/movies/:id/cast', c.updateCast);

export default router;