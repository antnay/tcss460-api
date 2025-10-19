import { Router } from 'express';
import { getAllMovies, healthCheck } from '@controllers';

export const router = Router();

router.get('/health', healthCheck);
router.get('/movies', getAllMovies);
// router.get('/api/movies/:id', getMoviesById);
// router.post('/api/movies', createMovie)

// API information
router.get('/api-info', (request, response) => {
    response.json({
        name: 'TCSS 460 API',
        version: '1.0.0',
        description: 'RESTful API for movies',
        documentation: '/api-docs'
    });
});

export default router;