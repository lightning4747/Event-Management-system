import { Request, Response, NextFunction } from 'express';
import { requestExtensionSchema, decideExtensionSchema } from './extensions.types';
import * as extensionsService from './extensions.service';
import { AppError } from '../../lib/errors';

export const handleRequestExtension = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentUserId = req.user?.userId;
    if (!studentUserId || req.user?.role !== 'Student') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only students can request deadline extensions.');
    }

    const parseResult = requestExtensionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const extension = await extensionsService.requestDeadlineExtension(studentUserId, parseResult.data);

    res.status(201).json({
      ...extension,
      extensionId: extension.extensionId.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPendingExtensions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ecUserId = req.user?.userId;
    if (!ecUserId || req.user?.role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Event Coordinators can view pending extension requests.');
    }

    const pendingList = await extensionsService.getPendingExtensionsForEC();
    res.status(200).json(pendingList);
  } catch (error) {
    next(error);
  }
};

export const handleDecideExtension = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ecUserId = req.user?.userId;
    if (!ecUserId || req.user?.role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Event Coordinators can decide deadline extensions.');
    }

    const { id } = req.params;
    let extId: bigint;
    try {
      extId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid extension ID format.');
    }

    const parseResult = decideExtensionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const result = await extensionsService.decideDeadlineExtension(ecUserId, extId, parseResult.data);

    res.status(200).json({
      ...result,
      extensionId: result.extensionId.toString(),
    });
  } catch (error) {
    next(error);
  }
};
