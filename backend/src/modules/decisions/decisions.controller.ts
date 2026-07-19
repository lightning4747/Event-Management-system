import { Request, Response, NextFunction } from 'express';
import { makeDecisionSchema } from './decisions.types';
import * as decisionsService from './decisions.service';
import { AppError } from '../../lib/errors';

export const handleDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || !role) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const allowedRoles = ['Event Coordinator', 'Mentor', 'Program Coordinator', 'Head of Department'] as const;
    const matchedRole = allowedRoles.find(r => r === role);
    if (!matchedRole) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only authorized faculty members can review applications.');
    }

    const { id } = req.params;
    let appId: bigint;
    try {
      appId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
    }

    const parseResult = makeDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const result = await decisionsService.makeApprovalDecision(appId, userId, matchedRole, parseResult.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
