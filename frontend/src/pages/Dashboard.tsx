import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { MenteeRosterDialog } from '../components/dashboard/MenteeRosterDialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import {
  FileText, Clock, CheckCircle, XCircle, PlusCircle,
  ChevronRight, ExternalLink, Shield, Check, X, ClipboardList,
  UserPlus, Calendar, Hourglass, Download, Settings,
  AlertTriangle, Users
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplicationRow {
  applicationId: string;
  studentId: string;
  studentName: string;
  title: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: string;
  createdAt: string;
}

interface ApplicationDetails {
  application: ApplicationRow;
  history: Array<{
    historyId: string;
    approverId: string;
    approverRole: string;
    decision: string;
    comments: string | null;
    decidedAt: string;
  }>;
  certificates: Array<{
    requirementId: string;
    sequenceNumber: number;
    status: string;
    submissionDeadline: string;
    rejectionReason: string | null;
    fileUrl?: string | null;
  }>;
  extension?: {
    extensionId: string;
    newDeadline: string;
    reason: string;
  } | null;
}

interface ExtensionRequestMock {
  applicationId: string;
  title: string;
  studentId: string;
  studentName: string;
  reason: string;
  requestedDays: number;
  requestedAt: string;
}

interface FacultyRow {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  designation: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const oneDriveSchema = z
  .string()
  .url('Please enter a valid URL.')
  .regex(/(onedrive\.live\.com|sharepoint\.com)/, 'URL must be a valid Microsoft OneDrive or SharePoint link.');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Approved':
    case 'Verified':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'Rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Withdrawn':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'Submitted':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
};

const getStepStatus = (stepRole: string, currentStatus: string, history: any[] = []) => {
  if (!currentStatus) return 'pending';
  const roleOrder = ['Event Coordinator', 'Mentor', 'Program Coordinator', 'Head of Department'];
  const currentIdx = roleOrder.indexOf(currentStatus.replace('In Progress: ', ''));
  if (currentStatus === 'Approved') return 'completed';
  if (currentStatus === 'Rejected') {
    const decision = history.find((h) => h.approverRole === stepRole && h.decision === 'Reject');
    return decision ? 'rejected' : 'skipped';
  }
  if (currentStatus === 'Withdrawn') return 'skipped';
  const stepIdx = roleOrder.indexOf(stepRole);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
};

const getDeadlineInfo = (toDateStr: string) => {
  const toDate = new Date(toDateStr);
  const deadline = new Date(toDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  deadline.setHours(23, 59, 59, 999);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { isOverdue: true, text: 'Overdue', badgeColor: 'bg-red-50 text-red-700 border-red-200' };
  if (diffDays === 0) return { isOverdue: false, text: 'Due Today', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { isOverdue: false, text: `${diffDays}d left`, badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};



const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusColor(status)}`}>
    {status}
  </span>
);

const SectionTitle: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <div>
    <h2 className="text-lg font-bold text-gray-900">{children}</h2>
    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Main Dashboard Component ─────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── UI State ──
  const [selectedAppId, setSelectedAppId] = React.useState<string | null>(null);
  const [menteeRosterOpen, setMenteeRosterOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'pending' | 'certificates' | 'extensions' | 'all'>('pending');

  // ── Decision state ──
  const [decisionType, setDecisionType] = React.useState<'Approve' | 'Reject' | null>(null);
  const [decisionComments, setDecisionComments] = React.useState('');
  const [decisionError, setDecisionError] = React.useState<string | null>(null);

  // ── Certificate verify state ──
  const [verifyType, setVerifyType] = React.useState<Record<string, 'Verified' | 'Rejected'>>({});
  const [verifyComments, setVerifyComments] = React.useState<Record<string, string>>({});
  const [verifyError, setVerifyError] = React.useState<Record<string, string | null>>({});

  // ── Certificate upload (student) ──
  const [certUrls, setCertUrls] = React.useState<Record<string, string>>({});
  const [certErrors, setCertErrors] = React.useState<Record<string, string | null>>({});

  // ── Extension request (student) ──
  const [requestExtensionOpen, setRequestExtensionOpen] = React.useState(false);
  const [extensionReason, setExtensionReason] = React.useState('');
  const [requestedDays, setRequestedDays] = React.useState(7);
  const [extensionFormError, setExtensionFormError] = React.useState<string | null>(null);
  const [extensionFormSuccess, setExtensionFormSuccess] = React.useState<string | null>(null);

  // ── Extension grant (mentor) ──
  const [grantExtensionOpen, setGrantExtensionOpen] = React.useState(false);
  const [grantAppId, setGrantAppId] = React.useState<string | null>(null);
  const [grantNewDeadline, setGrantNewDeadline] = React.useState('');
  const [grantReason, setGrantReason] = React.useState('');
  const [grantError, setGrantError] = React.useState<string | null>(null);

  // ── Student onboard (mentor) ──
  const [createStudentOpen, setCreateStudentOpen] = React.useState(false);
  const [studentFormValues, setStudentFormValues] = React.useState({
    userId: '', fullName: '', dateOfBirth: '', section: 'A',
  });
  const [createStudentError, setCreateStudentError] = React.useState<string | null>(null);
  const [createStudentSuccess, setCreateStudentSuccess] = React.useState<string | null>(null);

  // ── Faculty onboard (admin) ──
  const [createFacultyOpen, setCreateFacultyOpen] = React.useState(false);
  const [facultyFormValues, setFacultyFormValues] = React.useState({
    userId: '', fullName: '', password: '', role: 'Mentor', designation: 'Assistant Professor',
  });
  const [createFacultyError, setCreateFacultyError] = React.useState<string | null>(null);
  const [createFacultySuccess, setCreateFacultySuccess] = React.useState<string | null>(null);

  const yearOptions = React.useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let y = 2026; y <= current; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // ── CSV Export ──
  const [filterFromDate, setFilterFromDate] = React.useState('');
  const [filterToDate, setFilterToDate] = React.useState('');
  const [filterSection, setFilterSection] = React.useState('');
  const [filterYear, setFilterYear] = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);

  // ── Role flags ──
  const isStudent = user?.role === 'Student';
  const isEC = user?.role === 'Event Coordinator';
  const isMentor = user?.role === 'Mentor';
  const isPC = user?.role === 'Program Coordinator';
  const isHOD = user?.role === 'Head of Department';
  const isAdmin = user?.role === 'Administrator';
  const isFaculty = isEC || isMentor || isPC || isHOD;

  // ─── Queries ──────────────────────────────────────────────────────────────────

  const { data: _studentMetrics } = useQuery({
    queryKey: ['studentMetrics'],
    queryFn: async () => { const res = await apiFetch('/dashboards/student'); return res.json(); },
    enabled: isStudent,
  });

  const { data: _ecMetrics } = useQuery({
    queryKey: ['ecMetrics'],
    queryFn: async () => { const res = await apiFetch('/dashboards/coordinator'); return res.json(); },
    enabled: isEC,
  });

  const { data: _mentorMetrics } = useQuery({
    queryKey: ['mentorMetrics'],
    queryFn: async () => { const res = await apiFetch('/dashboards/mentor'); return res.json(); },
    enabled: isMentor,
  });

  const { data: _hodMetrics } = useQuery({
    queryKey: ['hodMetrics'],
    queryFn: async () => { const res = await apiFetch('/dashboards/hod'); return res.json(); },
    enabled: isHOD,
  });

  const { data: facultyList = [], isLoading: facultyListLoading } = useQuery<FacultyRow[]>({
    queryKey: ['adminFacultyList'],
    queryFn: async () => { const res = await apiFetch('/admin/faculty'); return res.json(); },
    enabled: isAdmin,
  });

  const { data: studentApps = [], isLoading: studentAppsLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['studentApplications'],
    queryFn: async () => { const res = await apiFetch('/applications/my'); return res.json(); },
    enabled: isStudent,
  });

  const { data: departmentApps = [], isLoading: deptAppsLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['departmentApplications'],
    queryFn: async () => { const res = await apiFetch('/applications'); return res.json(); },
    enabled: isFaculty,
  });

  const { data: appDetails } = useQuery<ApplicationDetails>({
    queryKey: ['applicationDetails', selectedAppId],
    queryFn: async () => { const res = await apiFetch(`/applications/${selectedAppId}`); return res.json(); },
    enabled: !!selectedAppId,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────

  const withdrawMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiFetch(`/applications/${applicationId}/withdraw`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
      setSelectedAppId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to withdraw application.');
    },
  });

  const uploadCertMutation = useMutation({
    mutationFn: async (payload: { requirementId: string; fileUrl: string }) => {
      const res = await apiFetch('/certificates', { method: 'POST', body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
    },
  });

  const decideMutation = useMutation({
    mutationFn: async (payload: { decision: 'Approve' | 'Reject'; comments: string }) => {
      const res = await apiFetch(`/applications/${selectedAppId}/decide`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['ecMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['hodMetrics'] });
      setDecisionType(null);
      setDecisionComments('');
      setSelectedAppId(null);
    },
    onError: (err: any) => {
      setDecisionError(err.message || 'Failed to submit decision.');
    },
  });

  const verifyCertMutation = useMutation({
    mutationFn: async (payload: { requirementId: string; status: 'Verified' | 'Rejected'; comments?: string }) => {
      const res = await apiFetch(`/certificates/${payload.requirementId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status: payload.status, comments: payload.comments }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['ecMetrics'] });
    },
  });

  const onboardStudentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiFetch('/mentor/students', { method: 'POST', body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: () => {
      setCreateStudentSuccess('Student account created successfully.');
      queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['menteesList'] });
      setStudentFormValues({ userId: '', fullName: '', dateOfBirth: '', section: 'A' });
      setTimeout(() => { setCreateStudentOpen(false); setCreateStudentSuccess(null); }, 1500);
    },
    onError: (err: any) => setCreateStudentError(err.message || 'Failed to create student account.'),
  });

  const onboardFacultyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiFetch('/admin/faculty', { method: 'POST', body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: () => {
      setCreateFacultySuccess('Faculty account created successfully.');
      queryClient.invalidateQueries({ queryKey: ['adminFacultyList'] });
      setFacultyFormValues({ userId: '', fullName: '', password: '', role: 'Mentor', designation: 'Assistant Professor' });
      setTimeout(() => { setCreateFacultyOpen(false); setCreateFacultySuccess(null); }, 1500);
    },
    onError: (err: any) => setCreateFacultyError(err.message || 'Failed to create faculty account.'),
  });

  const assignRoleMutation = useMutation({
    mutationFn: async (payload: { userId: string; role: 'Head of Department' | 'Program Coordinator' | 'Event Coordinator' | 'Mentor' }) => {
      const res = await apiFetch('/admin/assign-role', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error?.message || errorBody.message || 'Failed to assign role.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFacultyList'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to assign role.');
    },
  });

  const grantExtensionMutation = useMutation({
    mutationFn: async (payload: { applicationId: string; newDeadline: string; reason: string }) => {
      const res = await apiFetch('/extensions', { method: 'POST', body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: () => {
      if (grantAppId) {
        const stored = localStorage.getItem('mcet_extension_requests');
        if (stored) {
          const filtered = (JSON.parse(stored) as ExtensionRequestMock[]).filter((r) => r.applicationId !== grantAppId);
          localStorage.setItem('mcet_extension_requests', JSON.stringify(filtered));
        }
      }
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId || grantAppId] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
      setGrantExtensionOpen(false);
      setGrantAppId(null);
      setGrantReason('');
      setGrantNewDeadline('');
      setSelectedAppId(null);
    },
    onError: (err: any) => setGrantError(err.message || 'Failed to grant extension.'),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleCertSubmit = async (reqId: string) => {
    const url = certUrls[reqId] || '';
    const validation = oneDriveSchema.safeParse(url);
    if (!validation.success) {
      setCertErrors((prev) => ({ ...prev, [reqId]: validation.error.errors[0].message }));
      return;
    }
    setCertErrors((prev) => ({ ...prev, [reqId]: null }));
    try {
      await uploadCertMutation.mutateAsync({ requirementId: reqId, fileUrl: url });
      setCertUrls((prev) => ({ ...prev, [reqId]: '' }));
    } catch (err: any) {
      setCertErrors((prev) => ({ ...prev, [reqId]: err.message || 'Submission failed.' }));
    }
  };

  const handleDecideSubmit = () => {
    if (!decisionType) return;
    if (decisionType === 'Reject' && !decisionComments.trim()) {
      setDecisionError('Rejection comments are required when rejecting.');
      return;
    }
    setDecisionError(null);
    decideMutation.mutate({
      decision: decisionType,
      comments: decisionType === 'Approve' ? '' : decisionComments,
    });
  };

  const handleVerifySubmit = async (reqId: string) => {
    const type = verifyType[reqId];
    const comments = verifyComments[reqId] || '';
    if (!type) return;
    if (type === 'Rejected' && !comments.trim()) {
      setVerifyError((prev) => ({ ...prev, [reqId]: 'Rejection comments are mandatory.' }));
      return;
    }
    setVerifyError((prev) => ({ ...prev, [reqId]: null }));
    try {
      await verifyCertMutation.mutateAsync({ requirementId: reqId, status: type, comments });
      setVerifyComments((prev) => ({ ...prev, [reqId]: '' }));
      setVerifyType((prev) => { const copy = { ...prev }; delete copy[reqId]; return copy; });
    } catch (err: any) {
      setVerifyError((prev) => ({ ...prev, [reqId]: err.message || 'Verification failed.' }));
    }
  };

  const handleExportCSV = async () => {
    const params = new URLSearchParams();
    if (filterFromDate) params.append('fromDate', filterFromDate);
    if (filterToDate) params.append('toDate', filterToDate);
    if (filterSection) params.append('section', filterSection);
    if (filterYear) params.append('admissionYear', filterYear);
    const path = isMentor ? `/reports/cohort?${params}` : `/reports/global?${params}`;
    try {
      setExportLoading(true);
      const res = await apiFetch(path);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', isMentor ? 'cohort_od_report.csv' : 'global_od_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to download report.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExtensionRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExtensionFormError(null);
    setExtensionFormSuccess(null);
    if (extensionReason.trim().length < 10) {
      setExtensionFormError('Please provide a descriptive reason (minimum 10 characters).');
      return;
    }
    if (!appDetails) return;
    if (appDetails.extension) {
      setExtensionFormError('An extension was already granted for this application.');
      return;
    }
    const stored = localStorage.getItem('mcet_extension_requests');
    const list: ExtensionRequestMock[] = stored ? JSON.parse(stored) : [];
    if (list.some((r) => r.applicationId === appDetails.application.applicationId)) {
      setExtensionFormError('An extension request is already pending review.');
      return;
    }
    list.push({
      applicationId: appDetails.application.applicationId,
      title: appDetails.application.title,
      studentId: appDetails.application.studentId,
      studentName: appDetails.application.studentName,
      reason: extensionReason,
      requestedDays,
      requestedAt: new Date().toISOString(),
    });
    localStorage.setItem('mcet_extension_requests', JSON.stringify(list));
    setExtensionFormSuccess('Extension request submitted to your Mentor!');
    setExtensionReason('');
    setTimeout(() => { setRequestExtensionOpen(false); setExtensionFormSuccess(null); }, 1500);
  };

  const handleGrantExtensionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    if (!grantAppId) return;
    if (grantReason.trim().length < 10) { setGrantError('Reason must be at least 10 characters.'); return; }
    const today = new Date().toISOString().split('T')[0];
    if (grantNewDeadline <= today) { setGrantError('The new deadline must be a future date.'); return; }
    grantExtensionMutation.mutate({ applicationId: grantAppId, newDeadline: grantNewDeadline, reason: grantReason });
  };

  // ─── Derived state ────────────────────────────────────────────────────────────

  const getFacultyPendingStatus = () => {
    if (isEC) return 'In Progress: Event Coordinator';
    if (isMentor) return 'In Progress: Mentor';
    if (isPC) return 'In Progress: Program Coordinator';
    if (isHOD) return 'In Progress: Head of Department';
    return '';
  };

  const getFilteredApps = () => {
    if (activeTab === 'pending') return departmentApps.filter((a) => a.status === getFacultyPendingStatus());
    if (activeTab === 'certificates') return departmentApps.filter((a) => a.status === 'Approved');
    return departmentApps;
  };

  const filteredApps = getFilteredApps();
  const mockExtensionRequests = isMentor
    ? JSON.parse(localStorage.getItem('mcet_extension_requests') || '[]')
    : [];

  const isUserCurrentReviewer = appDetails ? appDetails.application.status === getFacultyPendingStatus() : false;
  const isPostEvent = appDetails ? new Date() >= new Date(appDetails.application.toDate) : false;
  const isAppApproved = appDetails?.application.status === 'Approved';
  const showUploadSection = isAppApproved && isPostEvent;
  const isExtensionPending = appDetails
    ? (JSON.parse(localStorage.getItem('mcet_extension_requests') || '[]') as ExtensionRequestMock[]).some(
        (r) => r.applicationId === appDetails.application.applicationId
      )
    : false;
  const hasOverdueCerts = isStudent &&
    studentApps.some((app) => app.status === 'Approved' && getDeadlineInfo(app.toDate).isOverdue);

  // ─── Render Helpers ───────────────────────────────────────────────────────────

  const AppCard = ({ app, onClick }: { app: ApplicationRow; onClick: () => void }) => (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99]"
    >
      <div className="flex-1 min-w-0">
        {!isStudent && (
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
            {app.studentName} · {app.studentId}
          </p>
        )}
        <h4 className="text-sm font-bold text-gray-900 truncate">{app.title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatDate(app.fromDate)} → {formatDate(app.toDate)} · {app.numberOfEvents} {app.numberOfEvents === 1 ? 'day' : 'days'}
        </p>
        <div className="mt-2">
          <StatusBadge status={app.status} />
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );

  const LoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardShell>
      <div className="space-y-6">

        {/* ── Overdue Warning Banner ───────────────────────────────────────── */}
        {hasOverdueCerts && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Certificate Submission Overdue</p>
              <p className="text-xs text-red-700 mt-0.5">
                One or more of your approved OD applications have passed the 7-day certificate upload deadline. Contact your Mentor to request an extension.
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ADMINISTRATOR CONSOLE
        ══════════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <SectionTitle subtitle="Manage institutional faculty accounts and system onboarding">
                Administrator Console
              </SectionTitle>
              <Button
                onClick={() => setCreateFacultyOpen(true)}
                className="flex items-center gap-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
              >
                <UserPlus className="w-4 h-4" /> Provision Faculty
              </Button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900">Faculty Accounts Registry</h3>
                <span className="ml-auto text-xs text-gray-400 font-medium">{facultyList.length} accounts</span>
              </div>
              {facultyListLoading ? <LoadingState /> : facultyList.length === 0 ? (
                <EmptyState message="No faculty accounts registered yet." />
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...facultyList]
                    .sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((fac) => (
                      <div key={fac.userId} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-xs text-gray-600">
                          {fac.fullName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{fac.fullName}</p>
                          <p className="text-xs text-gray-500">{fac.designation} · ID: {fac.userId}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {fac.role !== 'Administrator' && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => assignRoleMutation.mutate({ userId: fac.userId, role: 'Head of Department' })}
                                disabled={fac.role === 'Head of Department' || assignRoleMutation.isPending}
                                className="text-[10px] h-7 px-2"
                              >
                                {fac.role === 'Head of Department' ? 'HOD' : 'Assign HOD'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => assignRoleMutation.mutate({ userId: fac.userId, role: 'Program Coordinator' })}
                                disabled={fac.role === 'Program Coordinator' || assignRoleMutation.isPending}
                                className="text-[10px] h-7 px-2"
                              >
                                {fac.role === 'Program Coordinator' ? 'PC' : 'Assign PC'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => assignRoleMutation.mutate({ userId: fac.userId, role: 'Event Coordinator' })}
                                disabled={fac.role === 'Event Coordinator' || assignRoleMutation.isPending}
                                className="text-[10px] h-7 px-2"
                              >
                                {fac.role === 'Event Coordinator' ? 'EC' : 'Assign EC'}
                              </Button>
                              {(fac.role === 'Head of Department' || fac.role === 'Program Coordinator' || fac.role === 'Event Coordinator') && (
                                <Button
                                  variant="outline"
                                  onClick={() => assignRoleMutation.mutate({ userId: fac.userId, role: 'Mentor' })}
                                  disabled={assignRoleMutation.isPending}
                                  className="text-[10px] h-7 px-2 border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Revert
                                </Button>
                              )}
                            </>
                          )}
                        <span className="text-[11px] font-bold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {fac.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STUDENT DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        {isStudent && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <SectionTitle subtitle="Track and manage your event On-Duty approvals">
                Student Dashboard
              </SectionTitle>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 gap-4">
              <Link
                to="/applications/new"
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Create New OD Application</h3>
                  <p className="text-[11px] text-gray-500 mt-1 leading-normal">Submit a new request for academic event On-Duty approval and verification steps.</p>
                </div>
              </Link>
            </div>

            {/* Applications */}
            <div id="applications-section" className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-gray-900">Your Applications</h3>
              {studentAppsLoading ? <LoadingState /> : studentApps.length === 0 ? (
                <EmptyState message='No On-Duty requests yet. Click "New Request" to submit one.' />
              ) : (
                <div className="space-y-3">
                  {studentApps.map((app) => (
                    <AppCard key={app.applicationId} app={app} onClick={() => setSelectedAppId(app.applicationId)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            FACULTY APPROVAL CONSOLE
        ══════════════════════════════════════════════════════════════════ */}
        {isFaculty && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <SectionTitle subtitle="Review pending OD applications and manage your cohort">
                {user?.role} Console
              </SectionTitle>
              {isMentor && (
                <Button
                  onClick={() => setCreateStudentOpen(true)}
                  className="flex items-center gap-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <UserPlus className="w-4 h-4" /> Add Student
                </Button>
              )}
            </div>

            {/* Primary Action Tasks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div
                onClick={() => setActiveTab('pending')}
                className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm ${
                  activeTab === 'pending'
                    ? 'bg-blue-50/50 border-blue-200 text-blue-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Pending Reviews</h3>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">Review and decide on active OD requests.</p>
                </div>
              </div>

              {isEC && (
                <div
                  onClick={() => setActiveTab('certificates')}
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm ${
                    activeTab === 'certificates'
                      ? 'bg-blue-50/50 border-blue-200 text-blue-700 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-900 leading-none">Verify Certificates</h3>
                    <p className="text-[10px] text-gray-400 mt-1 leading-tight">Check and verify student credentials.</p>
                  </div>
                </div>
              )}

              {isMentor && (
                <div
                  onClick={() => setActiveTab('extensions')}
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm ${
                    activeTab === 'extensions'
                      ? 'bg-blue-50/50 border-blue-200 text-blue-700 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-900 leading-none">Extension Requests</h3>
                    <p className="text-[10px] text-gray-400 mt-1 leading-tight">Grant deadline extensions for mentees.</p>
                  </div>
                </div>
              )}

              <div
                onClick={() => setActiveTab('all')}
                className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm ${
                  activeTab === 'all'
                    ? 'bg-blue-50/50 border-blue-200 text-blue-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Application History</h3>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">View all resolved department OD records.</p>
                </div>
              </div>

              <div
                onClick={() => navigate('/students')}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer text-gray-700 text-left"
              >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Students Directory</h3>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">Search profiles and participation logs.</p>
                </div>
              </div>
            </div>

            {/* CSV Export Panel */}
            {isEC && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">Export OD Data Report</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">From Date</Label>
                      <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">To Date</Label>
                      <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">Section</Label>
                      <Select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="h-9 text-sm">
                        <option value="">All Sections</option>
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">Admission Year</Label>
                      <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="h-9 text-sm">
                        <option value="">All Years</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleExportCSV}
                      disabled={exportLoading}
                      className="flex items-center gap-2 text-sm h-9 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Download className="w-4 h-4" />
                      {exportLoading ? 'Generating...' : 'Download CSV'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(['pending', ...(isEC ? ['certificates'] : []), ...(isMentor ? ['extensions'] : []), 'all'] as const).map((tab) => {
                const labels: Record<string, string> = {
                  pending: 'Pending Review',
                  certificates: 'Certificate Queue',
                  extensions: `Extensions (${mockExtensionRequests.length})`,
                  all: 'All Applications',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Queue Content */}
            {activeTab === 'extensions' && isMentor ? (
              mockExtensionRequests.length === 0 ? (
                <EmptyState message="No pending extension requests from your cohort." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mockExtensionRequests.map((req: any) => (
                    <div key={req.applicationId} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          {req.studentName} · {req.studentId}
                        </p>
                        <h4 className="text-sm font-bold text-gray-900 mt-0.5">{req.title}</h4>
                        <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                          <p className="text-xs font-bold text-amber-800">Requested: {req.requestedDays} days</p>
                          <p className="text-xs text-amber-700 mt-0.5">{req.reason}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            const stored = localStorage.getItem('mcet_extension_requests');
                            if (stored) {
                              const filtered = (JSON.parse(stored) as ExtensionRequestMock[]).filter((r) => r.applicationId !== req.applicationId);
                              localStorage.setItem('mcet_extension_requests', JSON.stringify(filtered));
                              queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
                            }
                          }}
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setGrantAppId(req.applicationId);
                            setGrantReason(`Granted ${req.requestedDays} day extension: ${req.reason}`);
                            setGrantExtensionOpen(true);
                          }}
                        >
                          Grant Extension
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : deptAppsLoading ? <LoadingState /> : filteredApps.length === 0 ? (
              <EmptyState message="No applications in this queue." />
            ) : (
              <div className="space-y-3">
                {filteredApps.map((app) => (
                  <AppCard key={app.applicationId} app={app} onClick={() => setSelectedAppId(app.applicationId)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            APPLICATION DETAIL DIALOG
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
          <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Application Details</DialogTitle>
            </DialogHeader>

            {appDetails ? (
              <div className="space-y-5 pt-1">

                {/* ── Full OD Form Details ── */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{appDetails.application.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{appDetails.application.location}</p>
                    </div>
                    <StatusBadge status={appDetails.application.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Student</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">{appDetails.application.studentName}</p>
                      <p className="text-[11px] text-gray-500 font-mono">{appDetails.application.studentId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {formatDate(appDetails.application.fromDate)} → {formatDate(appDetails.application.toDate)}
                      </p>
                      <p className="text-[11px] text-gray-500">{appDetails.application.numberOfEvents} {appDetails.application.numberOfEvents === 1 ? 'day' : 'days'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted On</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">{formatDate(appDetails.application.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Events</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">{appDetails.application.numberOfEvents}</p>
                    </div>
                  </div>
                </div>

                {/* ── Extension Banner ── */}
                {appDetails.extension && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-blue-800">Deadline Extension Active</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        New deadline: <strong>{formatDate(appDetails.extension.newDeadline)}</strong>
                      </p>
                      <p className="text-[11px] text-blue-600 mt-0.5">Reason: {appDetails.extension.reason}</p>
                    </div>
                  </div>
                )}

                {/* ── Student: Certificate Upload ── */}
                {isStudent && showUploadSection && appDetails.certificates.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Certificate Submission</h5>
                      {!appDetails.extension && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isExtensionPending}
                          onClick={() => setRequestExtensionOpen(true)}
                          className="text-xs h-8 px-3 border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          <Hourglass className="w-3.5 h-3.5 mr-1.5" />
                          {isExtensionPending ? 'Extension Pending' : 'Request Extension'}
                        </Button>
                      )}
                    </div>
                    {appDetails.certificates.map((cert) => {
                      const deadlineInfo = getDeadlineInfo(cert.submissionDeadline);
                      const isUploaded = cert.status === 'Submitted' || cert.status === 'Verified';
                      return (
                        <div key={cert.requirementId} className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-800">
                              {appDetails.certificates.length > 1 ? `Certificate #${cert.sequenceNumber}` : 'Certificate'}
                            </span>
                            <div className="flex gap-1.5">
                              <StatusBadge status={cert.status} />
                              {!isUploaded && (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${deadlineInfo.badgeColor}`}>
                                  {deadlineInfo.text}
                                </span>
                              )}
                            </div>
                          </div>
                          {cert.status === 'Rejected' && cert.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                              <p className="text-xs font-bold text-red-800">Rejection reason:</p>
                              <p className="text-xs text-red-700 mt-0.5">{cert.rejectionReason}</p>
                            </div>
                          )}
                          {!isUploaded ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-600">OneDrive / SharePoint link</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="https://onedrive.live.com/..."
                                  value={certUrls[cert.requirementId] || ''}
                                  onChange={(e) => setCertUrls((prev) => ({ ...prev, [cert.requirementId]: e.target.value }))}
                                  disabled={uploadCertMutation.isPending}
                                  className="flex-1 h-9 text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCertSubmit(cert.requirementId)}
                                  disabled={uploadCertMutation.isPending || !certUrls[cert.requirementId]}
                                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                >
                                  Submit
                                </Button>
                              </div>
                              {certErrors[cert.requirementId] && (
                                <p className="text-xs text-red-600 font-medium">{certErrors[cert.requirementId]}</p>
                              )}
                            </div>
                          ) : (
                            <a
                              href={cert.fileUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> View Submitted Document
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Faculty: Decision Panel ── */}
                {!isStudent && isUserCurrentReviewer && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Action Required</h5>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setDecisionType('Approve'); setDecisionError(null); setDecisionComments(''); }}
                        className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                          decisionType === 'Approve'
                            ? 'bg-green-600 border-green-600 text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => { setDecisionType('Reject'); setDecisionError(null); }}
                        className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                          decisionType === 'Reject'
                            ? 'bg-red-600 border-red-600 text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                        }`}
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>

                    {/* Only show comments when REJECTING */}
                    {decisionType === 'Reject' && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <Label className="text-xs font-semibold text-gray-700">
                          Rejection Reason <span className="text-red-500">*</span>
                        </Label>
                        <textarea
                          rows={3}
                          placeholder="Explain why this request is being rejected..."
                          value={decisionComments}
                          onChange={(e) => setDecisionComments(e.target.value)}
                          className="flex w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
                        />
                      </div>
                    )}

                    {decisionType === 'Approve' && (
                      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-medium">
                        This will approve the OD application and forward it to the next reviewer.
                      </p>
                    )}

                    {decisionError && <p className="text-xs text-red-600 font-medium">{decisionError}</p>}

                    {decisionType && (
                      <Button
                        onClick={handleDecideSubmit}
                        disabled={decideMutation.isPending}
                        className={`w-full h-10 text-sm font-bold ${
                          decisionType === 'Approve'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {decideMutation.isPending ? 'Submitting...' : `Confirm ${decisionType}`}
                      </Button>
                    )}
                  </div>
                )}

                {/* ── EC: Certificate Verification ── */}
                {!isStudent && isEC && appDetails.certificates.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Certificate Verification</h5>
                    {appDetails.certificates.map((cert) => {
                      const isSubmitted = cert.status === 'Submitted';
                      return (
                        <div key={cert.requirementId} className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-800">
                              {appDetails.certificates.length > 1 ? `Cert #${cert.sequenceNumber}` : 'Certificate'}
                            </span>
                            <StatusBadge status={cert.status} />
                          </div>
                          {cert.fileUrl && (
                            <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" /> Open Student's Document
                            </a>
                          )}
                          {!cert.fileUrl && <p className="text-xs text-gray-400 italic">No document submitted yet.</p>}
                          {isSubmitted && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => { setVerifyType((prev) => ({ ...prev, [cert.requirementId]: 'Verified' })); setVerifyError((prev) => ({ ...prev, [cert.requirementId]: null })); }}
                                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                    verifyType[cert.requirementId] === 'Verified'
                                      ? 'bg-green-600 border-green-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                                  }`}
                                >Verify</button>
                                <button
                                  onClick={() => { setVerifyType((prev) => ({ ...prev, [cert.requirementId]: 'Rejected' })); setVerifyError((prev) => ({ ...prev, [cert.requirementId]: null })); }}
                                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                    verifyType[cert.requirementId] === 'Rejected'
                                      ? 'bg-red-600 border-red-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-700 hover:border-red-300'
                                  }`}
                                >Reject</button>
                              </div>
                              {verifyType[cert.requirementId] === 'Rejected' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-gray-600">Rejection comments <span className="text-red-500">*</span></Label>
                                  <Input
                                    placeholder="Explain why this certificate is rejected..."
                                    value={verifyComments[cert.requirementId] || ''}
                                    onChange={(e) => setVerifyComments((prev) => ({ ...prev, [cert.requirementId]: e.target.value }))}
                                    className="h-9 text-sm"
                                  />
                                </div>
                              )}
                              {verifyError[cert.requirementId] && (
                                <p className="text-xs text-red-600 font-medium">{verifyError[cert.requirementId]}</p>
                              )}
                              {verifyType[cert.requirementId] && (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifySubmit(cert.requirementId)}
                                  disabled={verifyCertMutation.isPending}
                                  className="w-full h-9 text-sm"
                                >
                                  {verifyCertMutation.isPending ? 'Saving...' : 'Confirm Verification'}
                                </Button>
                              )}
                            </div>
                          )}
                          {cert.status === 'Rejected' && cert.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                              <p className="text-xs text-red-800"><strong>Rejection reason:</strong> {cert.rejectionReason}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Workflow Timeline ── */}
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Approval Timeline</h5>
                  <div className="space-y-3">
                    {[
                      { role: 'Event Coordinator', label: 'Event Coordinator' },
                      { role: 'Mentor', label: 'Mentor' },
                      { role: 'Program Coordinator', label: 'Program Coordinator' },
                      { role: 'Head of Department', label: 'Head of Department' },
                    ].map((step, idx) => {
                      const stepStatus = getStepStatus(step.role, appDetails.application.status, appDetails.history);
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            stepStatus === 'completed' ? 'bg-green-100 text-green-700'
                            : stepStatus === 'rejected' ? 'bg-red-100 text-red-700'
                            : stepStatus === 'active' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 ring-offset-1'
                            : 'bg-gray-100 text-gray-400'
                          }`}>
                            {stepStatus === 'completed' ? '✓' : stepStatus === 'rejected' ? '✗' : idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                            <p className="text-[11px] text-gray-500">
                              {stepStatus === 'completed' ? 'Approved'
                                : stepStatus === 'rejected' ? 'Rejected'
                                : stepStatus === 'active' ? 'Awaiting review'
                                : 'Pending'}
                            </p>
                          </div>
                          {stepStatus === 'completed' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                          {stepStatus === 'rejected' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                          {stepStatus === 'active' && <Clock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Review History ── */}
                {appDetails.history.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Review Comments</h5>
                    <div className="space-y-2">
                      {appDetails.history.filter((h) => h.comments).map((hist, hidx) => (
                        <div key={hidx} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-700">{hist.approverRole}</span>
                            <span className={`text-[11px] font-bold ${
                              hist.decision === 'Approve' ? 'text-green-600'
                              : hist.decision === 'Withdraw' ? 'text-gray-500'
                              : 'text-red-600'
                            }`}>
                              {hist.decision === 'Approve' ? 'Approved'
                                : hist.decision === 'Withdraw' ? 'Withdrawn'
                                : 'Rejected'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700">{hist.comments}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end items-center gap-2 pt-1">
                  {isStudent &&
                    appDetails.application.status !== 'Approved' &&
                    appDetails.application.status !== 'Rejected' &&
                    appDetails.application.status !== 'Withdrawn' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={withdrawMutation.isPending}
                        onClick={() => {
                          if (confirm('Are you sure you want to withdraw this application?')) {
                            withdrawMutation.mutate(appDetails.application.applicationId);
                          }
                        }}
                        className="text-xs h-9 px-4 bg-red-600 hover:bg-red-700 text-white mr-auto rounded-lg font-bold"
                      >
                        {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw Request'}
                      </Button>
                    )}
                  <DialogClose asChild>
                    <Button variant="outline" size="sm" className="text-sm h-9 px-5">
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Mentee Roster Dialog ── */}
        <MenteeRosterDialog open={menteeRosterOpen} onOpenChange={setMenteeRosterOpen} />

        {/* ── Create Student Dialog ── */}
        <Dialog open={createStudentOpen} onOpenChange={(open) => !open && setCreateStudentOpen(false)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Onboard New Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); setCreateStudentError(null); setCreateStudentSuccess(null); onboardStudentMutation.mutate(studentFormValues); }} className="space-y-4 pt-2">
              {createStudentSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded-xl font-medium">{createStudentSuccess}</div>
              )}
              {createStudentError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{createStudentError}</div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Register Number</Label>
                <Input placeholder="e.g. 727624BAD001" required value={studentFormValues.userId} onChange={(e) => setStudentFormValues((prev) => ({ ...prev, userId: e.target.value }))} disabled={onboardStudentMutation.isPending} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Full Name</Label>
                <Input placeholder="e.g. NEERAJ K" required value={studentFormValues.fullName} onChange={(e) => setStudentFormValues((prev) => ({ ...prev, fullName: e.target.value }))} disabled={onboardStudentMutation.isPending} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Date of Birth</Label>
                <Input type="date" required value={studentFormValues.dateOfBirth} onChange={(e) => setStudentFormValues((prev) => ({ ...prev, dateOfBirth: e.target.value }))} disabled={onboardStudentMutation.isPending} className="h-10" />
                <p className="text-[11px] text-gray-400">Default password: DDMMYYYY from this date.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Section</Label>
                <Select value={studentFormValues.section} onChange={(e) => setStudentFormValues((prev) => ({ ...prev, section: e.target.value }))} disabled={onboardStudentMutation.isPending} className="h-10">
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </Select>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setCreateStudentOpen(false)} disabled={onboardStudentMutation.isPending}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white" disabled={onboardStudentMutation.isPending}>
                  {onboardStudentMutation.isPending ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Create Faculty Dialog (Admin) ── */}
        <Dialog open={createFacultyOpen} onOpenChange={(open) => !open && setCreateFacultyOpen(false)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Provision Faculty Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); setCreateFacultyError(null); setCreateFacultySuccess(null); onboardFacultyMutation.mutate(facultyFormValues); }} className="space-y-4 pt-2">
              {createFacultySuccess && <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded-xl font-medium">{createFacultySuccess}</div>}
              {createFacultyError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{createFacultyError}</div>}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Faculty ID</Label>
                <Input placeholder="e.g. FAC009" required value={facultyFormValues.userId} onChange={(e) => setFacultyFormValues((prev) => ({ ...prev, userId: e.target.value }))} disabled={onboardFacultyMutation.isPending} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Full Name</Label>
                <Input placeholder="e.g. Dr. ARUN PRASAD" required value={facultyFormValues.fullName} onChange={(e) => setFacultyFormValues((prev) => ({ ...prev, fullName: e.target.value }))} disabled={onboardFacultyMutation.isPending} className="h-10" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Account Password <span className="text-red-500">*</span></Label>
                <Input type="password" placeholder="Minimum 6 characters" required value={facultyFormValues.password} onChange={(e) => setFacultyFormValues((prev) => ({ ...prev, password: e.target.value }))} disabled={onboardFacultyMutation.isPending} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Designation</Label>
                  <Input placeholder="e.g. Assistant Professor" required value={facultyFormValues.designation} onChange={(e) => setFacultyFormValues((prev) => ({ ...prev, designation: e.target.value }))} disabled={onboardFacultyMutation.isPending} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">System Role</Label>
                  <Select value={facultyFormValues.role} onChange={(e) => setFacultyFormValues((prev) => ({ ...prev, role: e.target.value }))} disabled={onboardFacultyMutation.isPending} className="h-10">
                    <option value="Mentor">Mentor</option>
                    <option value="Event Coordinator">Event Coordinator</option>
                    <option value="Administrator">Administrator</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setCreateFacultyOpen(false)} disabled={onboardFacultyMutation.isPending}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white" disabled={onboardFacultyMutation.isPending}>
                  {onboardFacultyMutation.isPending ? 'Provisioning...' : 'Provision Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Student Extension Request Dialog ── */}
        <Dialog open={requestExtensionOpen} onOpenChange={(open) => !open && setRequestExtensionOpen(false)}>
          <DialogContent className="max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Request Deadline Extension</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleExtensionRequestSubmit} className="space-y-4 pt-2">
              {extensionFormSuccess && <div className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded-xl font-medium">{extensionFormSuccess}</div>}
              {extensionFormError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{extensionFormError}</div>}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Days Requested</Label>
                <Select value={requestedDays} onChange={(e) => setRequestedDays(parseInt(e.target.value) || 7)} className="h-10">
                  {[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'Day' : 'Days'}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Reason <span className="text-red-500">*</span></Label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why you need more time..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setRequestExtensionOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Mentor Grant Extension Dialog ── */}
        <Dialog open={grantExtensionOpen} onOpenChange={(open) => !open && setGrantExtensionOpen(false)}>
          <DialogContent className="max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Grant Deadline Extension</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGrantExtensionSubmit} className="space-y-4 pt-2">
              {grantError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{grantError}</div>}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">New Deadline Date <span className="text-red-500">*</span></Label>
                <Input type="date" required value={grantNewDeadline} onChange={(e) => setGrantNewDeadline(e.target.value)} disabled={grantExtensionMutation.isPending} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Reason <span className="text-red-500">*</span></Label>
                <textarea
                  rows={3}
                  required
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  disabled={grantExtensionMutation.isPending}
                  className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setGrantExtensionOpen(false)} disabled={grantExtensionMutation.isPending}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white" disabled={grantExtensionMutation.isPending}>
                  {grantExtensionMutation.isPending ? 'Saving...' : 'Grant Extension'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardShell>
  );
};
