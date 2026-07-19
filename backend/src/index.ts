import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { httpLogger, logger } from './utils/logger';
import { authRoutes } from './modules/auth/auth.routes';
import { errorHandler } from './middleware/error';

const app = express();
const port = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// App Routes
app.use('/api/auth', authRoutes);

// Centralized error handler (must be registered last)
app.use(errorHandler);

app.listen(port, () => {
  logger.info(`Backend server listening at http://localhost:${port}`);
});
