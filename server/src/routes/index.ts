import { Router } from 'express';
import * as c from '../controllers/index';
import { validateGenerateApiKey } from '@middleware/apiKeyVerification';
import { requireApiKey } from '@middleware/apiKeyAuth';

export const publicRouter = Router();
export const protectedRouter = Router();
protectedRouter.use(requireApiKey);

// System routes
publicRouter.get('/api-info', c.info);
publicRouter.get('/health', c.healthCheck);

// router.post('/login', c.login)
// router.post('/register', c.register)
publicRouter.get('/api-key', c.serveApiKeyForm);
publicRouter.get('/api-key/info', c.getApiKeyInfo);

publicRouter.post('/api-key', validateGenerateApiKey, c.generateApiKeyController);

// GET
protectedRouter.get('/movies', c.getAllMovies);
protectedRouter.get('/movies/:id', c.getMovieById);
protectedRouter.get('/studios/:id/movies', c.getMoviesByStudioId);
protectedRouter.get('/studios/name/:name/movies', c.getMoviesByStudio);
protectedRouter.get('/directors/:id/movies', c.getMoviesByDirectorId);
protectedRouter.get('/directors/name/:name/movies', c.getMoviesByDirector);
protectedRouter.get('/actors/:id/movies', c.getMoviesByActorId);
protectedRouter.get('/actors/name/:name/movies', c.getMoviesByActor);
protectedRouter.get('/collections/:id/movies', c.getMoviesByCollectionId);
protectedRouter.get('/collections/name/:name/movies', c.getMoviesByCollection);

// POST routes - Add movies
protectedRouter.post('/movies', c.addMovie);
protectedRouter.post('/movies/bulk', c.addMoviesBulk);

// PUT routes - Complete update
protectedRouter.put('/movies/:id', c.updateMovie);

// PATCH routes - Partial updates
protectedRouter.patch('/movies/:id', c.patchMovie);
protectedRouter.patch('/movies/:id/cast', c.updateCast);

// DELETE routes - Delete movie
protectedRouter.delete('/movies/:id', c.deleteMovieById);

// other get stuff
protectedRouter.get('/actors', c.getAllActors)
protectedRouter.get('/actors/:id', c.getActorById)
protectedRouter.get('/actors/search', c.searchActors)

protectedRouter.get('/collections', c.getAllCollections)
protectedRouter.get('/collections/:id', c.getCollectionById)
protectedRouter.get('/collections/search', c.searchCollections)

protectedRouter.get('/directors', c.getAllDirectors)
protectedRouter.get('/directors/:id', c.getDirectorById)
protectedRouter.get('/directories/search', c.searchDirectors)

protectedRouter.get('/studios', c.getAllStudios)
protectedRouter.get('/studios/:id', c.getStudioById)
protectedRouter.get('/studios/search', c.searchStudios)

export default publicRouter;
