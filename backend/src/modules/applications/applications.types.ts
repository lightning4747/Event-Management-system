import { z } from 'zod';

export const eventItemSchema = z.object({
  sequenceNumber: z.number().int().positive(),
  activityCategory: z.enum(['Extracurricular', 'Co-curricular', 'Others']),
  activityType: z.string().min(1, 'Activity type is required.').max(255),
});

export const createApplicationSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(255, 'Title must not exceed 255 characters.'),
  activityCategory: z.enum(['Extracurricular', 'Co-curricular', 'Others']).optional().default('Co-curricular'),
  activityType: z.string().optional().default('General'),
  events: z.array(eventItemSchema).optional(),
  location: z.string().min(1, 'Location is required.').max(255, 'Location must not exceed 255 characters.'),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From Date must be in YYYY-MM-DD format.'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To Date must be in YYYY-MM-DD format.'),
  numberOfEvents: z.number().int().positive('Number of events must be greater than 0.'),
}).superRefine((data, ctx) => {
  const currentDateStr = new Date().toISOString().split('T')[0];
  if (data.fromDate < currentDateStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event start date cannot be in the past.',
      path: ['fromDate'],
    });
  }
  if (data.toDate < data.fromDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event end date must be greater than or equal to the start date.',
      path: ['toDate'],
    });
  }

  const extracurricularTypes = ['Sports', 'NCC', 'NSS', 'Dance'];
  const cocurricularTypes = ['Hackathon', 'Seminar', 'Workshop', 'Symposium', 'Conference'];

  if (data.activityCategory === 'Extracurricular' && !extracurricularTypes.includes(data.activityType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid activity type for Extracurricular. Expected one of: ${extracurricularTypes.join(', ')}.`,
      path: ['activityType'],
    });
  }
  if (data.activityCategory === 'Co-curricular' && !cocurricularTypes.includes(data.activityType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid activity type for Co-curricular. Expected one of: ${cocurricularTypes.join(', ')}.`,
      path: ['activityType'],
    });
  }
});

export type CreateApplicationInput = {
  title: string;
  activityCategory?: 'Extracurricular' | 'Co-curricular' | 'Others';
  activityType?: string;
  events?: Array<{ sequenceNumber: number; activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others'; activityType: string }>;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
};

export type EventTag = 'Upcoming' | 'Ongoing' | 'Action Required' | 'Reviewing' | 'Completed';
