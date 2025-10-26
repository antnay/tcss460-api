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

<<<<<<< HEAD
// GET routes - Retrieve movies
router.get('/movies', c.getAllMovies);
=======
router.post('/login', c.login)
router.post('/register', c.register)
router.get('/api-key', c.keyForm)
router.post('/api-key', c.generateKey)

router.get('/movies', c.getAllMovies);
router.get('/movies/search/financial', c.getMoviesByFinancial);
router.get('/movies/search/multi', c.getMoviesByMultiFilter);
router.get('/movies/studio/search', c.getMoviesByStudio);
router.get('/movies/director/search', c.getMoviesByDirector);
router.get('/movies/actor/search', c.getMoviesByActor);
router.get('/movies/collection/search', c.getMoviesByCollection);
<<<<<<< HEAD
>>>>>>> 1d8b584c764330a01aa22328de2a20c985530cba
router.get('/movies/:id', c.getMoviesById);
=======
router.get('/movies/:id', c.getMovieById);
>>>>>>> d1473a3eb23e505548d431124f84e2ca74c2182b

// POST routes - Add movies
router.post('/movies', c.addMovie);
router.post('/movies/bulk', c.addMoviesBulk);

// PUT routes - Complete update
router.put('/movies/:id', c.updateMovie);

// PATCH routes - Partial updates
router.patch('/movies/:id', c.patchMovie);
router.patch('/movies/:id/cast', c.updateCast);

export default router;