import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { httpLogger, logger } from './utils/logger';

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

app.listen(port, () => {
  logger.info(`Backend server listening at http://localhost:${port}`);
});
