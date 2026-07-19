import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';

// Faculty updates schema requiring currentPassword whenever username/password is changed
const facultyUpdateSchema = z.object({
  username: z.string().min(1, 'Username cannot be empty.').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters.').or(z.literal('')),
  currentPassword: z.string().min(1, 'Current password is required to change credentials.'),
});

type FacultyUpdateValues = z.infer<typeof facultyUpdateSchema>;

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // 1. Fetch user profile payload using React Query
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiFetch('/profile');
      return res.json();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacultyUpdateValues>({
    resolver: zodResolver(facultyUpdateSchema),
    defaultValues: {
      username: '',
      password: '',
      currentPassword: '',
    },
  });

  // Automatically sync form default values once profile loads
  React.useEffect(() => {
    if (profile) {
      reset({
        username: profile.username || '',
        password: '',
        currentPassword: '',
      });
    }
  }, [profile, reset]);

  // 2. React Query Mutation to update credentials
  const updateMutation = useMutation({
    mutationFn: async (values: FacultyUpdateValues) => {
      const payload: any = {
        currentPassword: values.currentPassword,
      };
      if (values.username && values.username !== profile?.username) {
        payload.username = values.username;
      }
      if (values.password) {
        payload.password = values.password;
      }
      const res = await apiFetch('/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccessMsg('Profile credentials updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      reset({
        password: '',
        currentPassword: '',
      });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update credentials.');
    },
  });

  const onSubmit = (values: FacultyUpdateValues) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
          LOADING PROFILE DETAILS...
        </div>
      </DashboardShell>
    );
  }

  if (error || !profile) {
    return (
      <DashboardShell>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-lg text-center font-medium">
          Failed to load profile. Please sign out and sign in again.
        </div>
      </DashboardShell>
    );
  }

  const isStudent = user?.role === 'Student';

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">User Profile</h2>
          <p className="text-xs text-gray-500">View registry information and update security credentials</p>
        </div>

        {/* Core registry details (Read-Only fields) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 border border-gray-200 rounded-lg">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Full Name</span>
            <span className="text-sm font-semibold text-gray-900">{profile.fullName || 'N/A'}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
              {isStudent ? 'Register Number' : 'Faculty ID'}
            </span>
            <span className="text-sm font-semibold text-gray-900">{profile.userId}</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">System Role</span>
            <span className="text-sm font-semibold text-gray-900 uppercase tracking-wider text-xs bg-gray-200 px-2 py-0.5 rounded w-max block">
              {profile.role}
            </span>
          </div>

          {isStudent ? (
            <>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Class Section</span>
                <span className="text-sm font-semibold text-gray-900">{profile.section || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Admission Year</span>
                <span className="text-sm font-semibold text-gray-900">{profile.admissionYear || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Date of Birth</span>
                <span className="text-sm font-semibold text-gray-900">{profile.dateOfBirth || 'N/A'}</span>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Academic Designation</span>
              <span className="text-sm font-semibold text-gray-900">{profile.designation || 'N/A'}</span>
            </div>
          )}
        </div>

        {/* Security Settings Area */}
        {isStudent ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-4 rounded-lg font-medium">
            Note: Student credentials are managed by your supervisor. If you need to reset or update your credentials, please request changes through your assigned cohort mentor.
          </div>
        ) : (
          <div className="space-y-6 pt-4 border-t border-gray-200">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Security Credentials</h3>
              <p className="text-[11px] text-gray-500">Modify your login username and password settings</p>
            </div>

            {successMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-lg text-center font-semibold">
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="username">Login Username</Label>
                <Input
                  id="username"
                  {...register('username')}
                  disabled={updateMutation.isPending}
                />
                {errors.username && (
                  <p className="text-xs text-destructive font-medium">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">New Password (Optional)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={updateMutation.isPending}
                />
                {errors.password && (
                  <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Confirm Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register('currentPassword')}
                  disabled={updateMutation.isPending}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-destructive font-medium">{errors.currentPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving Changes...' : 'Update Credentials'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </DashboardShell>
  );
};
