import { Request, Response, NextFunction } from 'express';
import { uploadCertificateSchema, verifyCertificateSchema } from './certificates.types';
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

    const cert = await certificatesService.uploadCertificate(studentId, parseResult.data, req.file);
    
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

export const handleVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ecUserId = req.user?.userId;
    const role = req.user?.role;
    if (!ecUserId || role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Event Coordinators can verify certificates.');
    }

    const { id } = req.params;
    let reqId: bigint;
    try {
      reqId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid requirement ID format.');
    }

    const parseResult = verifyCertificateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const updatedRequirement = await certificatesService.verifyCertificate(reqId, parseResult.data);
    
    // Format BigInt fields for JSON compatibility
    const serializedData = {
      ...updatedRequirement,
      requirementId: updatedRequirement.requirementId.toString(),
    };

    res.status(200).json(serializedData);
  } catch (error) {
    next(error);
  }
};
