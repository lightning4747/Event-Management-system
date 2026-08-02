import { z } from 'zod';

export const achievementPositionSchema = z.enum([
  'Participation',
  'First Prize',
  'Second Prize',
  'Third Prize',
]);

export type AchievementPosition = z.infer<typeof achievementPositionSchema>;

export const isAchievementEligible = (category?: string, type?: string): boolean => {
  if (category === 'Co-curricular' && (type === 'Hackathon' || type === 'Symposium')) {
    return true;
  }
  if (category === 'Extracurricular' && type === 'Sports') {
    return true;
  }
  return false;
};

export const eventItemSchema = z.object({
  sequenceNumber: z.number().int().positive(),
  activityCategory: z.enum(['Extracurricular', 'Co-curricular', 'Others']),
  activityType: z.string().min(1, 'Activity type is required.').max(255),
  achievement: achievementPositionSchema.optional().default('Participation'),
});

export const createApplicationSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(255, 'Title must not exceed 255 characters.'),
  activityCategory: z.enum(['Extracurricular', 'Co-curricular', 'Others']).optional().default('Co-curricular'),
  activityType: z.string().optional().default('General'),
  achievement: achievementPositionSchema.optional().default('Participation'),
  events: z.array(eventItemSchema).optional(),
  location: z.string().min(1, 'Location is required.').max(255, 'Location must not exceed 255 characters.'),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From Date must be in YYYY-MM-DD format.'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To Date must be in YYYY-MM-DD format.'),
  numberOfEvents: z.coerce
    .number({ invalid_type_error: 'Number of events must be an integer.' })
    .int('Number of events must be an integer.')
    .min(1, 'Number of events must be between 1 and 4.')
    .max(4, 'Number of events must be between 1 and 4.'),
}).superRefine((data, ctx) => {
  if (data.events && data.events.length !== data.numberOfEvents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Events array length (${data.events.length}) must exactly match Number of Events (${data.numberOfEvents}).`,
      path: ['events'],
    });
  }

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

  // Validate achievement eligibility for top-level application
  if (!isAchievementEligible(data.activityCategory, data.activityType) && data.achievement && data.achievement !== 'Participation') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Achievement position "${data.achievement}" is not allowed for ${data.activityCategory} - ${data.activityType}. Only Participation is allowed.`,
      path: ['achievement'],
    });
  }

  // Validate achievement eligibility for each event item in events array
  if (data.events) {
    data.events.forEach((evt, idx) => {
      if (evt.activityCategory === 'Extracurricular' && !extracurricularTypes.includes(evt.activityType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid activity type for Extracurricular at event #${idx + 1}. Expected one of: ${extracurricularTypes.join(', ')}.`,
          path: ['events', idx, 'activityType'],
        });
      }
      if (evt.activityCategory === 'Co-curricular' && !cocurricularTypes.includes(evt.activityType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid activity type for Co-curricular at event #${idx + 1}. Expected one of: ${cocurricularTypes.join(', ')}.`,
          path: ['events', idx, 'activityType'],
        });
      }
      if (!isAchievementEligible(evt.activityCategory, evt.activityType) && evt.achievement && evt.achievement !== 'Participation') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Achievement position "${evt.achievement}" is not allowed for ${evt.activityCategory} - ${evt.activityType} at event #${idx + 1}. Only Participation is allowed.`,
          path: ['events', idx, 'achievement'],
        });
      }
    });
  }
});

export type CreateApplicationInput = {
  title: string;
  activityCategory?: 'Extracurricular' | 'Co-curricular' | 'Others';
  activityType?: string;
  achievement?: AchievementPosition;
  events?: Array<{
    sequenceNumber: number;
    activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
    activityType: string;
    achievement?: AchievementPosition;
  }>;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
};

export type EventTag = 'Upcoming' | 'Ongoing' | 'Action Required' | 'Reviewing' | 'Completed';
