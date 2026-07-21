import * as React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { User, Shield, GraduationCap, CheckCircle2, AlertCircle, FileText, Clock, XCircle, Users, BarChart3, LogOut } from 'lucide-react';

const facultyUpdateSchema = z.object({
  username: z.string().min(1, 'Username cannot be empty.').optional(),
  password: z
    .string()
    .refine((val) => val === '' || val.length >= 6, {
      message: 'New password must be at least 6 characters.',
    }),
  currentPassword: z.string().min(1, 'Current password is required to make any changes.'),
});

type FacultyUpdateValues = z.infer<typeof facultyUpdateSchema>;

const FieldItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold text-gray-900">{value || 'N/A'}</p>
  </div>
);

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiFetch('/profile');
      return res.json();
    },
  });

  const isStudent = user?.role === 'Student';
  const isMentor = user?.role === 'Mentor';
  const isEC = user?.role === 'Event Coordinator';
  const isHOD = user?.role === 'Head of Department';

  const getMetricsPath = () => {
    if (isStudent) return '/dashboards/student';
    if (isMentor) return '/dashboards/mentor';
    if (isEC) return '/dashboards/coordinator';
    if (isHOD) return '/dashboards/hod';
    return null;
  };

  const metricsPath = getMetricsPath();

  const { data: metrics } = useQuery({
    queryKey: ['profileMetrics', metricsPath],
    queryFn: async () => {
      const res = await apiFetch(metricsPath!);
      return res.json();
    },
    enabled: !!metricsPath,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacultyUpdateValues>({
    resolver: zodResolver(facultyUpdateSchema),
    defaultValues: { username: '', password: '', currentPassword: '' },
  });

  React.useEffect(() => {
    if (profile) {
      reset({ username: profile.username || '', password: '', currentPassword: '' });
    }
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: FacultyUpdateValues) => {
      const payload: any = { currentPassword: values.currentPassword };
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
      setSuccessMsg('Your credentials have been updated successfully.');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      reset({ password: '', currentPassword: '' });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update credentials.');
      setSuccessMsg(null);
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
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Loading profile...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !profile) {
    return (
      <DashboardShell>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl font-medium">
          Failed to load profile. Please sign out and sign in again.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-1">View your registry details and manage account security</p>
        </div>

        {/* Identity Card */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Identity Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldItem label="Full Name" value={profile.fullName} />
            <FieldItem label={isStudent ? 'Register Number' : 'Faculty ID'} value={profile.userId} />
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Role</p>
              <span className="inline-block text-xs font-bold px-3 py-1 bg-muted text-muted-foreground border border-border rounded-full">
                {profile.role}
              </span>
            </div>

            {isStudent ? (
              <>
                <FieldItem label="Class Section" value={profile.section} />
                <FieldItem label="Admission Year" value={String(profile.admissionYear)} />
                <FieldItem label="Date of Birth" value={profile.dateOfBirth} />
              </>
            ) : (
              <>
                <FieldItem label="Academic Designation" value={profile.designation} />
                <FieldItem label="Login Username" value={profile.username} />
              </>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        {metrics && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">System Statistics</h2>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {isStudent && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total OD</p>
                      <p className="text-xl font-bold text-gray-900 leading-none mt-1">{metrics.totalSubmitted ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending</p>
                      <p className="text-xl font-bold text-muted-foreground leading-none mt-1">{metrics.pendingCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Approved</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.approvedCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Rejected</p>
                      <p className="text-xl font-bold text-destructive leading-none mt-1">{metrics.rejectedCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Upload Req.</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.certificatesActionCount ?? 0}</p>
                    </div>
                  </div>
                </>
              )}
              {isMentor && (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Total Mentees</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.totalMentees ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Reviews</p>
                      <p className="text-xl font-bold text-muted-foreground leading-none mt-1">{metrics.pendingMenteeApprovals ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Mentees Overdue</p>
                      <p className="text-xl font-bold text-destructive leading-none mt-1">{metrics.menteesWithExpiredDeadlines ?? 0}</p>
                    </div>
                  </div>
                </>
              )}
              {isEC && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Applications</p>
                      <p className="text-xl font-bold text-gray-900 leading-none mt-1">{metrics.totalApplications ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Reviews</p>
                      <p className="text-xl font-bold text-muted-foreground leading-none mt-1">{metrics.pendingECApprovals ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Certs to Verify</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.pendingCertificateVerifications ?? 0}</p>
                    </div>
                  </div>
                </>
              )}
              {isHOD && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Applications</p>
                      <p className="text-xl font-bold text-gray-900 leading-none mt-1">{metrics.totalApplications ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Approved Applications</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.approvedApplications ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Active Students</p>
                      <p className="text-xl font-bold text-primary leading-none mt-1">{metrics.activeStudentsCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
                      <p className="text-xl font-bold text-muted-foreground leading-none mt-1">{metrics.pendingHODApprovals ?? 0}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Security Section */}
        {isStudent ? (
          <div className="bg-muted border border-border rounded-2xl p-5 flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Student credentials are managed by faculty</p>
              <p className="text-xs text-muted-foreground mt-1">
                If you need to reset or update your login credentials, please contact your assigned cohort Mentor.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">Security & Credentials</h2>
            </div>

            <div className="p-6 space-y-5">
              {successMsg && (
                <div className="flex items-center gap-2.5 bg-muted border border-border text-foreground text-sm p-3.5 rounded-xl font-medium">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  {successMsg}
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
                  <Label htmlFor="username" className="text-sm font-semibold text-gray-700">Login Username</Label>
                  <Input
                    id="username"
                    {...register('username')}
                    disabled={updateMutation.isPending}
                    className="h-10"
                  />
                  {errors.username && (
                    <p className="text-xs text-red-600 font-medium">{errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    disabled={updateMutation.isPending}
                    className="h-10"
                  />
                  <p className="text-[11px] text-gray-400 font-medium">
                    Leave blank to keep your current password. Minimum 6 characters if changing.
                  </p>
                  {errors.password && (
                    <p className="text-xs text-red-600 font-medium">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <Label htmlFor="currentPassword" className="text-sm font-semibold text-gray-700">
                    Current Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    {...register('currentPassword')}
                    disabled={updateMutation.isPending}
                    className="h-10"
                  />
                  <p className="text-[11px] text-gray-400 font-medium">Required to confirm any credential changes.</p>
                  {errors.currentPassword && (
                    <p className="text-xs text-red-600 font-medium">{errors.currentPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm"
                >
                  {updateMutation.isPending ? 'Saving Changes...' : 'Update Credentials'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Mobile-Friendly Sign Out Button */}
        <div className="pt-4 border-t border-gray-200 mt-6">
          <Button
            onClick={handleLogout}
            className="w-full h-10 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
};
