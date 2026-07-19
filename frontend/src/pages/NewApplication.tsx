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
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react';

const newAppSchema = z
  .object({
    title: z.string().min(1, 'Event title is required.'),
    location: z.string().min(1, 'Event location is required.'),
    fromDate: z.string().min(1, 'Start date is required.'),
    toDate: z.string().min(1, 'End date is required.'),
    numberOfEvents: z.coerce.number().int().min(1, 'Number of days must be at least 1.'),
  })
  .refine(
    (data) => new Date(data.toDate) >= new Date(data.fromDate),
    { message: 'End date must be on or after start date.', path: ['toDate'] }
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
    defaultValues: { title: '', location: '', fromDate: '', toDate: '', numberOfEvents: 1 },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: NewAppValues) => {
      const res = await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify(values),
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
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">New On-Duty Request</h1>
              <p className="text-xs text-gray-500">Submit event details for approval</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
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
                  disabled={submitMutation.isPending}
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
                  disabled={submitMutation.isPending}
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
                    {...register('fromDate')}
                    disabled={submitMutation.isPending}
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
                    disabled={submitMutation.isPending}
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
                  min="1"
                  {...register('numberOfEvents')}
                  disabled={submitMutation.isPending}
                  className="h-10"
                />
                {errors.numberOfEvents && <p className="text-xs text-red-600 font-medium">{errors.numberOfEvents.message}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <Link to="/dashboard" className="flex-1">
                  <Button type="button" variant="outline" className="w-full h-10" disabled={submitMutation.isPending}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  disabled={submitMutation.isPending}
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
