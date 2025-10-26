import { Router } from 'express';
import * as c from '../controllers/index'
export const router = Router();


router.get('/api-info', c.info);
router.get('/health', c.healthCheck);

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
router.get('/movies/:id', c.getMovieById);

router.post('/movies', c.addMovie);

export default router;