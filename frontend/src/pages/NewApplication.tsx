import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { ArrowLeft } from 'lucide-react';

const newAppSchema = z
  .object({
    title: z.string().min(1, 'Event title is required.'),
    location: z.string().min(1, 'Event location is required.'),
    fromDate: z.string().min(1, 'Start date is required.'),
    toDate: z.string().min(1, 'End date is required.'),
    numberOfEvents: z.coerce
      .number()
      .int()
      .min(1, 'Number of events must be at least 1.'),
  })
  .refine(
    (data) => {
      const from = new Date(data.fromDate);
      const to = new Date(data.toDate);
      return to >= from;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['toDate'],
    }
  );

type NewAppValues = z.infer<typeof newAppSchema>;

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewAppValues>({
    resolver: zodResolver(newAppSchema),
    defaultValues: {
      title: '',
      location: '',
      fromDate: '',
      toDate: '',
      numberOfEvents: 1,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: NewAppValues) => {
      const res = await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          location: values.location,
          fromDate: values.fromDate,
          toDate: values.toDate,
          numberOfEvents: values.numberOfEvents,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
      navigate('/dashboard');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to submit On-Duty request.');
    },
  });

  const onSubmit = (values: NewAppValues) => {
    setErrorMsg(null);
    submitMutation.mutate(values);
  };

  return (
    <DashboardShell>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors font-semibold"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Dashboard
        </Link>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">New On-Duty Request</h2>
          <p className="text-xs text-gray-500">Provide details of the event or seminar to request On-Duty approval</p>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="e.g. Smart India Hackathon 2026"
              {...register('title')}
              disabled={submitMutation.isPending}
            />
            {errors.title && (
              <p className="text-xs text-destructive font-medium">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Event Location / Organizers</Label>
            <Input
              id="location"
              placeholder="e.g. PSG Tech, Coimbatore"
              {...register('location')}
              disabled={submitMutation.isPending}
            />
            {errors.location && (
              <p className="text-xs text-destructive font-medium">{errors.location.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromDate">Start Date</Label>
              <Input
                id="fromDate"
                type="date"
                {...register('fromDate')}
                disabled={submitMutation.isPending}
              />
              {errors.fromDate && (
                <p className="text-xs text-destructive font-medium">{errors.fromDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="toDate">End Date</Label>
              <Input
                id="toDate"
                type="date"
                {...register('toDate')}
                disabled={submitMutation.isPending}
              />
              {errors.toDate && (
                <p className="text-xs text-destructive font-medium">{errors.toDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numberOfEvents">Number of Days / Events</Label>
            <Input
              id="numberOfEvents"
              type="number"
              min="1"
              {...register('numberOfEvents')}
              disabled={submitMutation.isPending}
            />
            {errors.numberOfEvents && (
              <p className="text-xs text-destructive font-medium">{errors.numberOfEvents.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Link to="/dashboard" className="flex-1">
              <Button type="button" variant="outline" className="w-full text-xs h-10" disabled={submitMutation.isPending}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="flex-1 text-xs h-10" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
};
