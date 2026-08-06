import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * GET /api/files/:key(*)
 *
 * Private file access proxy.
 * - For S3: redirects to a 1-hour pre-signed URL.
 * - For local storage: streams file directly from disk.
 *
 * Requires authentication — no anonymous access.
 */
router.get('/:key(*)', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawKey = decodeURIComponent(req.params.key);

    // Prevent path traversal
    const normalized = path.normalize(rawKey).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalized !== rawKey.replace(/\\/g, '/')) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid file path.' });
      return;
    }

    const providerType = process.env.STORAGE_PROVIDER || 's3';

    if (providerType === 'local') {
      // Serve directly from local uploads directory
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const filePath = path.resolve(uploadsDir, normalized);

      // Ensure resolved path is inside uploads dir
      if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid file path.' });
        return;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'File not found.' });
        return;
      }

      res.sendFile(filePath);
      return;
    }

    // S3 mode: issue a pre-signed URL and redirect
    // Lazy-import to avoid constructing S3Client in local/test mode
    const { storageService } = await import('../../services/storage/storage.service');
    const signedUrl = await storageService.getDownloadUrl(normalized);
    res.redirect(302, signedUrl);
  } catch (err) {
    logger.error({ err }, 'File proxy error');
    next(err);
  }
});

export default router;
