import { Request, Response, NextFunction } from 'express';
import { uploadCertificateSchema } from './certificates.types';
import * as certificatesService from './certificates.service';
import { AppError } from '../../lib/errors';

export const handleUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const parseResult = uploadCertificateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const cert = await certificatesService.uploadCertificate(studentId, parseResult.data);
    
    // Explicitly cast BigInt fields to strings to prevent JSON serialization errors
    const serializedData = {
      ...cert,
      certificateId: cert.certificateId.toString(),
      requirementId: cert.requirementId.toString(),
    };

    res.status(201).json(serializedData);
  } catch (error) {
    next(error);
  }
};
