import { z } from 'zod';

export const uploadCertificateSchema = z.object({
  requirementId: z.string().min(1, 'Requirement ID is required.'),
  fileUrl: z.string().optional(),
  achievement: z.enum(['Participation', 'First Prize', 'Second Prize', 'Third Prize']).optional(),
});

export type UploadCertificateInput = z.infer<typeof uploadCertificateSchema>;

export const verifyCertificateSchema = z.object({
  status: z.enum(['Verified', 'Rejected']),
  comments: z.string().optional(),
}).refine(data => {
  if (data.status === 'Rejected') {
    return data.comments !== undefined && data.comments.trim().length > 0;
  }
  return true;
}, {
  message: 'Rejection comments are mandatory when rejecting a certificate.',
  path: ['comments'],
});

export type VerifyCertificateInput = z.infer<typeof verifyCertificateSchema>;
