import 'module-alias/register';
import express, { Application } from 'express';
import cors from 'cors';
import dotenvx from '@dotenvx/dotenvx';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path'; import { initializeDatabase, closeDatabase } from '@db';
import router from './routes';

dotenvx.config({ path: '../.env' });

// Initialize the database pool
const startServer = async () => {
  try {
    await initializeDatabase();

    const app: Application = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.url}`);
      next();
    });

    // Routes
    app.use('/api', router);
    // app.use(express.static(path.join(__dirname, '../public')));

    // API Documentation - Swagger UI
    const swaggerDocument = YAML.load(path.join(__dirname, '../api-docs/swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    const PORT = process.env.SERVER_PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    /**
     * Gracefully handles shutdown
     */
    const shutdown = async () => {
      console.log('Shutting down server...');
      server.close(async () => {
        await closeDatabase();
        console.log('Server and database connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    // process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();