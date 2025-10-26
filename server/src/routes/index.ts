import { Router } from 'express';
import * as c from '../controllers/index'
export const router = Router();


router.get('/api-info', c.info);
router.get('/health', c.healthCheck);

router.post('/login', c.login)
router.post('/register', c.register)

router.get('/movies', c.getAllMovies);
router.get('/movies/:id', c.getMoviesById);

router.post('/movies', c.addMovie);

export default router;