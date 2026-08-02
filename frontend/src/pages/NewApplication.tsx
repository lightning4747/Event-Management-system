import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react';
import { Select } from '../components/ui/Select';

const todayStr = new Date().toISOString().split('T')[0];

const extracurricularTypes = ['Sports', 'NCC', 'NSS', 'Dance'];
const cocurricularTypes = ['Hackathon', 'Seminar', 'Workshop', 'Symposium', 'Conference'];

const eventSchema = z.object({
  sequenceNumber: z.number(),
  activityCategory: z.enum(['Extracurricular', 'Co-curricular', 'Others']),
  activityType: z.string().min(1, 'Activity type is required.'),
});

const newAppSchema = z
  .object({
    title: z.string().min(1, 'Event title is required.'),
    location: z.string().min(1, 'Event location is required.'),
    fromDate: z.string().min(1, 'Start date is required.'),
    toDate: z.string().min(1, 'End date is required.'),
    numberOfEvents: z.coerce
      .number({ invalid_type_error: 'Number of events must be an integer.' })
      .int('Number of events must be an integer.')
      .min(1, 'Number of events must be between 1 and 4.')
      .max(4, 'Number of events must be between 1 and 4.'),
    events: z.array(eventSchema),
  })
  .refine(
    (data) => data.fromDate >= todayStr,
    { message: 'Event start date cannot be in the past.', path: ['fromDate'] }
  )
  .refine(
    (data) => data.toDate >= data.fromDate,
    { message: 'End date must be on or after start date.', path: ['toDate'] }
  );

type NewAppValues = z.infer<typeof newAppSchema>;

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { data: studentMetrics } = useQuery({
    queryKey: ['studentMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/student');
      return res.json();
    },
  });

  const isDailyLimitReached = Boolean(studentMetrics && (studentMetrics.dailyLimitReached || studentMetrics.applicationsRemainingToday === 0));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<NewAppValues>({
    resolver: zodResolver(newAppSchema),
    defaultValues: {
      title: '',
      location: '',
      fromDate: '',
      toDate: '',
      numberOfEvents: 1,
      events: [
        { sequenceNumber: 1, activityCategory: '' as any, activityType: '' }
      ],
    },
  });

  const numberOfEventsInput = watch('numberOfEvents');
  const watchedEvents = watch('events') || [];

  // Synchronize events array length when numberOfEvents changes
  React.useEffect(() => {
    const count = Math.max(1, Number(numberOfEventsInput) || 1);
    const currentEvents = getValues('events') || [];
    if (currentEvents.length !== count) {
      const updated = Array.from({ length: count }).map((_, idx) => {
        if (currentEvents[idx]) return currentEvents[idx];
        return { sequenceNumber: idx + 1, activityCategory: '' as any, activityType: '' };
      });
      setValue('events', updated, { shouldValidate: true, shouldDirty: true });
    }
  }, [numberOfEventsInput, getValues, setValue]);

  const submitMutation = useMutation({
    mutationFn: async (values: NewAppValues) => {
      const payload = {
        ...values,
        activityCategory: values.events[0]?.activityCategory || 'Co-curricular',
        activityType: values.events[0]?.activityType || 'General',
      };
      const res = await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
      navigate('/dashboard');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to submit On-Duty request.'),
  });

  const onSubmit = (values: NewAppValues) => {
    setErrorMsg(null);
    submitMutation.mutate(values);
  };

  const handleCategoryChange = (index: number, category: 'Extracurricular' | 'Co-curricular' | 'Others' | '') => {
    const current = getValues('events') || [];
    const updated = [...current];
    updated[index] = {
      sequenceNumber: index + 1,
      activityCategory: category as any,
      activityType: '',
    };
    setValue('events', updated, { shouldValidate: true, shouldDirty: true });
  };

  const handleTypeChange = (index: number, type: string) => {
    const current = getValues('events') || [];
    const updated = [...current];
    if (updated[index]) {
      updated[index] = { ...updated[index], activityType: type };
      setValue('events', updated, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-xl mx-auto space-y-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">New On-Duty Request</h1>
              <p className="text-xs text-gray-500">Submit event details for approval</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {isDailyLimitReached && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3.5 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Daily application limit reached. You can create a maximum of 3 applications per day. The limit resets at midnight.
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-800 text-sm p-3.5 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-sm font-semibold text-gray-700">Event Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Smart India Hackathon 2026"
                  {...register('title')}
                  disabled={submitMutation.isPending || isDailyLimitReached}
                  className="h-10"
                />
                {errors.title && <p className="text-xs text-red-600 font-medium">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-sm font-semibold text-gray-700">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. PSG College of Technology, Coimbatore"
                  {...register('location')}
                  disabled={submitMutation.isPending || isDailyLimitReached}
                  className="h-10"
                />
                {errors.location && <p className="text-xs text-red-600 font-medium">{errors.location.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fromDate" className="text-sm font-semibold text-gray-700">Start Date</Label>
                  <Input
                    id="fromDate"
                    type="date"
                    min={todayStr}
                    {...register('fromDate')}
                    disabled={submitMutation.isPending || isDailyLimitReached}
                    className="h-10"
                  />
                  {errors.fromDate && <p className="text-xs text-red-600 font-medium">{errors.fromDate.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="toDate" className="text-sm font-semibold text-gray-700">End Date</Label>
                  <Input
                    id="toDate"
                    type="date"
                    {...register('toDate')}
                    disabled={submitMutation.isPending || isDailyLimitReached}
                    className="h-10"
                  />
                  {errors.toDate && <p className="text-xs text-red-600 font-medium">{errors.toDate.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numberOfEvents" className="text-sm font-semibold text-gray-700">Number of Events</Label>
                <Input
                  id="numberOfEvents"
                  type="number"
                  min={1}
                  max={4}
                  step={1}
                  placeholder="4 events max"
                  {...register('numberOfEvents', {
                    setValueAs: (val) => {
                      if (val === '' || val === null || val === undefined) return val;
                      const num = parseInt(val, 10);
                      if (isNaN(num)) return val;
                      return Math.min(4, Math.max(1, num));
                    },
                  })}
                  disabled={submitMutation.isPending || isDailyLimitReached}
                  className="h-10"
                />
                {errors.numberOfEvents && <p className="text-xs text-red-600 font-medium">{errors.numberOfEvents.message}</p>}
              </div>

              {/* Dynamic Per-Event Activity Classification */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Event Activity Classifications ({watchedEvents.length})
                </p>

                {watchedEvents.map((evt, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-blue-700">Event {idx + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`category_${idx}`} className="text-xs font-semibold text-gray-700">Category</Label>
                        <Select
                          id={`category_${idx}`}
                          value={evt.activityCategory || ''}
                          onChange={(e) => handleCategoryChange(idx, e.target.value as any)}
                          disabled={submitMutation.isPending || isDailyLimitReached}
                          className="h-9 text-xs"
                        >
                          <option value="" disabled>Select Category...</option>
                          <option value="Co-curricular">Co-curricular</option>
                          <option value="Extracurricular">Extracurricular</option>
                          <option value="Others">Others</option>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`type_${idx}`} className="text-xs font-semibold text-gray-700">Activity Type</Label>
                        {!evt.activityCategory ? (
                          <Select id={`type_${idx}`} disabled className="h-9 text-xs opacity-60">
                            <option value="">Select Category first...</option>
                          </Select>
                        ) : evt.activityCategory === 'Extracurricular' ? (
                          <Select
                            id={`type_${idx}`}
                            value={evt.activityType || ''}
                            onChange={(e) => handleTypeChange(idx, e.target.value)}
                            disabled={submitMutation.isPending || isDailyLimitReached}
                            className="h-9 text-xs"
                          >
                            <option value="" disabled>Select Activity Type...</option>
                            {extracurricularTypes.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </Select>
                        ) : evt.activityCategory === 'Co-curricular' ? (
                          <Select
                            id={`type_${idx}`}
                            value={evt.activityType || ''}
                            onChange={(e) => handleTypeChange(idx, e.target.value)}
                            disabled={submitMutation.isPending || isDailyLimitReached}
                            className="h-9 text-xs"
                          >
                            <option value="" disabled>Select Activity Type...</option>
                            {cocurricularTypes.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            id={`type_${idx}`}
                            placeholder="Specify custom activity name..."
                            value={evt.activityType || ''}
                            onChange={(e) => handleTypeChange(idx, e.target.value)}
                            disabled={submitMutation.isPending || isDailyLimitReached}
                            className="h-9 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Link to="/dashboard" className="flex-1">
                  <Button type="button" variant="outline" className="w-full h-10" disabled={submitMutation.isPending}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  disabled={submitMutation.isPending || isDailyLimitReached}
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
};
