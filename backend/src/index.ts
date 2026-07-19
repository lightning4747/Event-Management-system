import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { httpLogger, logger } from './utils/logger';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { mentorRoutes } from './modules/mentor/mentor.routes';
import { profileRoutes } from './modules/profile/profile.routes';
import { applicationsRoutes } from './modules/applications/applications.routes';
import { certificatesRoutes } from './modules/certificates/certificates.routes';
import { extensionsRoutes } from './modules/extensions/extensions.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { dashboardsRoutes } from './modules/dashboards/dashboards.routes';
import { checkCertificateDeadlines } from './modules/certificates/certificates.service';
import { errorHandler } from './middleware/error';

const app = express();
const port = process.env.PORT || 8082;

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
app.use('/api/admin', adminRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/extensions', extensionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboards', dashboardsRoutes);

// Centralized error handler (must be registered last)
app.use(errorHandler);

app.listen(port, () => {
  logger.info(`Backend server listening at http://localhost:${port}`);

  // Daily automated deadline checks
  const runDeadlineChecks = async () => {
    try {
      const expiredCount = await checkCertificateDeadlines();
      logger.info(`Automated certificate deadline check finished. Expired count: ${expiredCount}`);
    } catch (err) {
      logger.error(err, 'Failed running certificate deadline checks');
    }
  };

  // Run immediately on start
  runDeadlineChecks();
  // Run once daily (24-hour interval)
  setInterval(runDeadlineChecks, 24 * 60 * 60 * 1000);
});
