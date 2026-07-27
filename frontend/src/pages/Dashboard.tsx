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
  AlertTriangle, Users, Edit2, Search
} from 'lucide-react';

import { EventTagBadge } from '../components/EventTagBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplicationRow {
  applicationId: string;
  studentId: string;
  studentName: string;
  title: string;
  activityCategory?: 'Extracurricular' | 'Co-curricular' | 'Others';
  activityType?: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: string;
  eventTag?: string;
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
    requestedDays?: number;
    reason: string;
    status?: 'Pending' | 'Approved' | 'Rejected';
    rejectionReason?: string | null;
  } | null;
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
  if (status === 'Approved' || status === 'Completed' || status === 'Verified') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status === 'Rejected' || status === 'Withdrawn') {
    return 'bg-destructive/10 text-destructive border-destructive/20';
  }
  if (status === 'Uploaded' || status === 'Cert-Verification' || status === 'cert-verification') {
    return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
  }
  if (status === 'Submitted' || status.startsWith('In Progress')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-muted text-muted-foreground border-border';
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
  if (diffDays < 0) return { isOverdue: true, text: 'Overdue', badgeColor: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (diffDays === 0) return { isOverdue: false, text: 'Due Today', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { isOverdue: false, text: `${diffDays}d left`, badgeColor: 'bg-primary/10 text-primary border-primary/20' };
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};



const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const displayStatus = (status === 'Uploaded' || status === 'cert-verification') ? 'Cert-Verification' : status;
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusColor(status)}`}>
      {displayStatus}
    </span>
  );
};

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
  const [certFiles, setCertFiles] = React.useState<Record<string, File>>({});
  const [certUrls, setCertUrls] = React.useState<Record<string, string>>({});
  const [certErrors, setCertErrors] = React.useState<Record<string, string | null>>({});

  // ── Extension request (student) ──
  const [requestExtensionOpen, setRequestExtensionOpen] = React.useState(false);
  const [extensionReason, setExtensionReason] = React.useState('');
  const [requestedDays, setRequestedDays] = React.useState(7);
  const [extensionFormError, setExtensionFormError] = React.useState<string | null>(null);
  const [extensionFormSuccess, setExtensionFormSuccess] = React.useState<string | null>(null);

  // ── Extension decide modal (mentor) ──
  const [mentorDecideExtId, setMentorDecideExtId] = React.useState<string | null>(null);
  const [mentorRejectComments, setMentorRejectComments] = React.useState('');
  const [mentorDecideError, setMentorDecideError] = React.useState<string | null>(null);

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

  // ── Faculty edit (admin) ──
  const [selectedFacultyId, setSelectedFacultyId] = React.useState<string | null>(null);
  const [editingFaculty, setEditingFaculty] = React.useState<FacultyRow | null>(null);
  const [editFacultyForm, setEditFacultyForm] = React.useState({
    fullName: '', designation: '', role: 'Mentor', password: '',
  });
  const [editFacultyError, setEditFacultyError] = React.useState<string | null>(null);
  const [editFacultySuccess, setEditFacultySuccess] = React.useState<string | null>(null);

  // Double verification role change state
  const [pendingRoleChange, setPendingRoleChange] = React.useState<{
    userId: string;
    facultyName: string;
    currentRole: string;
    newRole: string;
    actionType: 'assign' | 'edit';
    editPayload?: any;
  } | null>(null);

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
  const [filterActivityCategory, setFilterActivityCategory] = React.useState('');
  const [filterActivityType, setFilterActivityType] = React.useState('');

  // ── All Applications Date Range Filter ──
  const [allAppsFromDate, setAllAppsFromDate] = React.useState('');
  const [allAppsToDate, setAllAppsToDate] = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);

  // ── Faculty Search Filter (Admin Console) ──
  const [facultySearchQuery, setFacultySearchQuery] = React.useState('');
  const [debouncedFacultySearch, setDebouncedFacultySearch] = React.useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFacultySearch(facultySearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [facultySearchQuery]);

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

  const filteredFacultyList = React.useMemo(() => {
    const q = debouncedFacultySearch.trim().toLowerCase();
    if (!q) return facultyList;
    return facultyList.filter(
      (fac) =>
        fac.fullName.toLowerCase().includes(q) ||
        fac.userId.toLowerCase().includes(q)
    );
  }, [facultyList, debouncedFacultySearch]);

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
    mutationFn: async (payload: { requirementId: string; file?: File; fileUrl?: string }) => {
      if (payload.file) {
        const formData = new FormData();
        formData.append('requirementId', payload.requirementId);
        formData.append('file', payload.file);
        const res = await apiFetch('/certificates', { method: 'POST', body: formData });
        return res.json();
      } else {
        const res = await apiFetch('/certificates', { method: 'POST', body: JSON.stringify(payload) });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
    },
  });

  const skipCertMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const res = await apiFetch(`/certificates/${reqId}/skip`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to skip certificate upload.');
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

  const updateFacultyMutation = useMutation({
    mutationFn: async (payload: { fullName?: string; designation?: string; role?: string; password?: string }) => {
      if (!editingFaculty) return;
      const cleanPayload: Record<string, string> = {};
      if (payload.fullName) cleanPayload.fullName = payload.fullName;
      if (payload.designation) cleanPayload.designation = payload.designation;
      if (payload.role) cleanPayload.role = payload.role;
      if (payload.password) cleanPayload.password = payload.password;

      const res = await apiFetch(`/admin/faculty/${editingFaculty.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanPayload),
      });
      return res.json();
    },
    onSuccess: () => {
      setEditFacultySuccess('Faculty account updated successfully.');
      setEditFacultyError(null);
      queryClient.invalidateQueries({ queryKey: ['adminFacultyList'] });
      setTimeout(() => {
        setEditingFaculty(null);
        setEditFacultySuccess(null);
      }, 1200);
    },
    onError: (err: any) => {
      setEditFacultyError(err.message || 'Failed to update faculty account.');
      setEditFacultySuccess(null);
    },
  });



  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleCertSubmit = async (reqId: string) => {
    const selectedFile = certFiles[reqId];
    const url = certUrls[reqId] || '';

    if (!selectedFile && !url) {
      setCertErrors((prev) => ({ ...prev, [reqId]: 'Please choose a PDF file to upload.' }));
      return;
    }

    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setCertErrors((prev) => ({ ...prev, [reqId]: 'Only PDF files are accepted.' }));
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setCertErrors((prev) => ({ ...prev, [reqId]: 'File size must be 10MB or less.' }));
        return;
      }
    } else {
      const validation = oneDriveSchema.safeParse(url);
      if (!validation.success) {
        setCertErrors((prev) => ({ ...prev, [reqId]: validation.error.errors[0].message }));
        return;
      }
    }

    setCertErrors((prev) => ({ ...prev, [reqId]: null }));
    try {
      await uploadCertMutation.mutateAsync({ requirementId: reqId, file: selectedFile, fileUrl: url });
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
    if (filterActivityCategory) params.append('activityCategory', filterActivityCategory);
    if (filterActivityType) params.append('activityType', filterActivityType);
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

  const requestExtensionMutation = useMutation({
    mutationFn: async (payload: { applicationId: string; requestedDays: number; reason: string }) => {
      const res = await apiFetch('/extensions/request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      setExtensionFormSuccess('Extension request submitted to your Mentor!');
      setExtensionReason('');
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      setTimeout(() => { setRequestExtensionOpen(false); setExtensionFormSuccess(null); }, 1500);
    },
    onError: (err: any) => {
      setExtensionFormError(err.message || 'Failed to submit extension request.');
    },
  });

  const { data: pendingExtensions = [] } = useQuery({
    queryKey: ['pendingExtensions'],
    queryFn: async () => {
      const res = await apiFetch('/extensions/pending');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!isMentor,
  });

  const decideExtensionMutation = useMutation({
    mutationFn: async (payload: { extensionId: string; decision: 'Approve' | 'Reject'; comments?: string }) => {
      const res = await apiFetch(`/extensions/${payload.extensionId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision: payload.decision, comments: payload.comments }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingExtensions'] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
      setMentorDecideExtId(null);
      setMentorRejectComments('');
      setMentorDecideError(null);
    },
    onError: (err: any) => {
      setMentorDecideError(err.message || 'Failed to process extension decision.');
    },
  });

  const handleExtensionRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExtensionFormError(null);
    setExtensionFormSuccess(null);
    if (extensionReason.trim().length < 10) {
      setExtensionFormError('Please provide a descriptive reason (minimum 10 characters).');
      return;
    }
    if (!appDetails) return;
    requestExtensionMutation.mutate({
      applicationId: appDetails.application.applicationId,
      requestedDays,
      reason: extensionReason,
    });
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
    if (activeTab === 'pending') {
      return departmentApps.filter((a) => a.status === getFacultyPendingStatus());
    }
    if (activeTab === 'certificates') {
      return departmentApps.filter(
        (a) => a.status === 'Approved' && (a.eventTag === 'Reviewing' || a.eventTag === 'Action Required')
      );
    }
    if (activeTab === 'all') {
      return departmentApps.filter((a) => {
        if (allAppsFromDate && a.fromDate < allAppsFromDate) return false;
        if (allAppsToDate && a.toDate > allAppsToDate) return false;
        return true;
      });
    }
    return departmentApps;
  };

  const filteredApps = getFilteredApps();
  const isUserCurrentReviewer = appDetails ? appDetails.application.status === getFacultyPendingStatus() : false;
  const isPostEvent = appDetails ? new Date() >= new Date(appDetails.application.toDate) : false;
  const isAppApproved = appDetails?.application.status === 'Approved';
  const showUploadSection = isAppApproved && isPostEvent;
  const hasOverdueCerts = isStudent &&
    studentApps.some((app) => app.status === 'Approved' && getDeadlineInfo(app.toDate).isOverdue);

  // ─── Render Helpers ───────────────────────────────────────────────────────────

  const AppCard = ({ app, onClick }: { app: ApplicationRow; onClick: () => void }) => (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.99]"
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
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <StatusBadge status={app.status} />
          {app.eventTag && <EventTagBadge tag={app.eventTag} />}
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
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                className="flex items-center gap-2 h-9 text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <UserPlus className="w-4 h-4" /> Provision Faculty
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Faculty List */}
              <div className={`${selectedFacultyId ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden`}>
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">Faculty Accounts Registry</h3>
                  <span className="ml-auto text-xs text-gray-400 font-medium">
                    {debouncedFacultySearch ? `${filteredFacultyList.length} of ${facultyList.length} accounts` : `${facultyList.length} accounts`}
                  </span>
                </div>
                <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search faculty by name or ID / register number..."
                      value={facultySearchQuery}
                      onChange={(e) => setFacultySearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs bg-white"
                    />
                  </div>
                </div>
                {facultyListLoading ? <LoadingState /> : filteredFacultyList.length === 0 ? (
                  <EmptyState message={debouncedFacultySearch ? 'No faculty accounts match your search.' : 'No faculty accounts registered yet.'} />
                ) : (
                  <div className="divide-y divide-gray-100">
                    {[...filteredFacultyList]
                      .sort((a, b) => a.fullName.localeCompare(b.fullName))
                      .map((fac) => {
                        const isSelected = selectedFacultyId === fac.userId;
                        return (
                          <div
                            key={fac.userId}
                            onClick={() => setSelectedFacultyId(isSelected ? null : fac.userId)}
                            className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/5 hover:bg-primary/5' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-xs text-gray-600">
                              {fac.fullName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900">{fac.fullName}</p>
                              <p className="text-xs text-gray-500">{fac.designation} · ID: {fac.userId}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {fac.role !== 'Administrator' && (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ userId: fac.userId, facultyName: fac.fullName, currentRole: fac.role, newRole: 'Head of Department', actionType: 'assign' })}
                                    disabled={fac.role === 'Head of Department' || assignRoleMutation.isPending}
                                    className="text-[10px] h-7 px-2"
                                  >
                                    {fac.role === 'Head of Department' ? 'HOD' : 'Assign HOD'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ userId: fac.userId, facultyName: fac.fullName, currentRole: fac.role, newRole: 'Program Coordinator', actionType: 'assign' })}
                                    disabled={fac.role === 'Program Coordinator' || assignRoleMutation.isPending}
                                    className="text-[10px] h-7 px-2"
                                  >
                                    {fac.role === 'Program Coordinator' ? 'PC' : 'Assign PC'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setPendingRoleChange({ userId: fac.userId, facultyName: fac.fullName, currentRole: fac.role, newRole: 'Event Coordinator', actionType: 'assign' })}
                                    disabled={fac.role === 'Event Coordinator' || assignRoleMutation.isPending}
                                    className="text-[10px] h-7 px-2"
                                  >
                                    {fac.role === 'Event Coordinator' ? 'EC' : 'Assign EC'}
                                  </Button>
                                  {(fac.role === 'Head of Department' || fac.role === 'Program Coordinator' || fac.role === 'Event Coordinator') && (
                                    <Button
                                      variant="outline"
                                      onClick={() => setPendingRoleChange({ userId: fac.userId, facultyName: fac.fullName, currentRole: fac.role, newRole: 'Mentor', actionType: 'assign' })}
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
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Selected Faculty Details Card */}
              {selectedFacultyId && (
                <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
                  {(() => {
                    const selFac = facultyList.find(f => f.userId === selectedFacultyId);
                    if (!selFac) return null;
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                              {selFac.fullName.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-gray-900 leading-tight">{selFac.fullName}</h3>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">Faculty ID: {selFac.userId}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => setSelectedFacultyId(null)}
                          >
                            Close
                          </Button>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Academic Designation</p>
                            <p className="font-semibold text-gray-800 mt-0.5">{selFac.designation}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Role</p>
                            <span className="inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
                              {selFac.role}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Creation Date</p>
                            <p className="font-semibold text-gray-800 mt-0.5">
                              {selFac.createdAt ? new Date(selFac.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button
                            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5"
                            onClick={() => {
                              setEditingFaculty(selFac);
                              setEditFacultyForm({
                                fullName: selFac.fullName,
                                designation: selFac.designation,
                                role: selFac.role,
                                password: '',
                              });
                              setEditFacultyError(null);
                              setEditFacultySuccess(null);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Update Faculty Details
                          </Button>
                        </div>
                      </>
                    );
                  })()}
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
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer"
              >
                <div className="w-12 h-12 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Create New OD Application</h3>
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
              <SectionTitle>
                {user?.role} Console
              </SectionTitle>
              {isMentor && (
                <Button
                  onClick={() => setCreateStudentOpen(true)}
                  className="flex items-center gap-2 h-9 text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <UserPlus className="w-4 h-4" /> Add Student
                </Button>
              )}
            </div>

            {/* Primary Action Tasks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div
                onClick={() => setActiveTab('pending')}
                className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-primary/30 hover:shadow-sm ${
                  activeTab === 'pending'
                    ? 'bg-primary/5 border-primary/20 text-primary shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Pending Reviews</h3>
                </div>
              </div>

              {isEC && (
                <div
                  onClick={() => setActiveTab('certificates')}
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-primary/30 hover:shadow-sm ${
                    activeTab === 'certificates'
                      ? 'bg-primary/5 border-primary/20 text-primary shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-900 leading-none">Verify Certificates</h3>
                  </div>
                </div>
              )}

              {isMentor && (
                <div
                  onClick={() => setActiveTab('extensions')}
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-primary/30 hover:shadow-sm ${
                    activeTab === 'extensions'
                      ? 'bg-primary/5 border-primary/20 text-primary shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-900 leading-none">Extension Requests</h3>
                  </div>
                </div>
              )}

              <div
                onClick={() => setActiveTab('all')}
                className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer hover:border-primary/30 hover:shadow-sm ${
                  activeTab === 'all'
                    ? 'bg-primary/5 border-primary/20 text-primary shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Application History</h3>
                </div>
              </div>

              <div
                onClick={() => navigate('/students')}
                className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer text-gray-700 text-left"
              >
                <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-900 leading-none">Students Directory</h3>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">From Date</Label>
                      <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">To Date</Label>
                      <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">Category</Label>
                      <Select value={filterActivityCategory} onChange={(e) => setFilterActivityCategory(e.target.value)} className="h-9 text-sm">
                        <option value="">All Categories</option>
                        <option value="Co-curricular">Co-curricular</option>
                        <option value="Extracurricular">Extracurricular</option>
                        <option value="Others">Others</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-500">Activity Type</Label>
                      <Input
                        placeholder="Search type..."
                        value={filterActivityType}
                        onChange={(e) => setFilterActivityType(e.target.value)}
                        className="h-9 text-sm"
                      />
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
                      className="flex items-center gap-2 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
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
                  extensions: `Extensions (${Array.isArray(pendingExtensions) ? pendingExtensions.length : 0})`,
                  all: 'All Applications',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Date Range Search Filter Bar for All Applications */}
            {activeTab === 'all' && (
              <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-gray-400" /> Filter Applications by Event Date Range
                  </p>
                  {(allAppsFromDate || allAppsToDate) && (
                    <button
                      type="button"
                      onClick={() => { setAllAppsFromDate(''); setAllAppsToDate(''); }}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Clear Date Filter
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-gray-500">From Date</Label>
                    <Input
                      type="date"
                      value={allAppsFromDate}
                      onChange={(e) => setAllAppsFromDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-gray-500">To Date</Label>
                    <Input
                      type="date"
                      value={allAppsToDate}
                      onChange={(e) => setAllAppsToDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Queue Content */}
            {activeTab === 'extensions' && isMentor ? (
              pendingExtensions.length === 0 ? (
                <EmptyState message="No pending extension requests from your cohort." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pendingExtensions.map((req: any) => (
                    <div key={req.extensionId} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          {req.studentName} · {req.studentId}
                        </p>
                        <h4 className="text-sm font-bold text-gray-900 mt-0.5">{req.title}</h4>
                        <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                          <p className="text-xs font-bold text-amber-800">Requested Extension: +{req.requestedDays} days</p>
                          <p className="text-xs text-amber-700 mt-0.5">New Target Deadline: <strong>{formatDate(req.newDeadline)}</strong></p>
                          <p className="text-[11px] text-amber-800 mt-1 italic">"{req.reason}"</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                          onClick={() => {
                            setMentorDecideExtId(req.extensionId);
                            setMentorRejectComments('');
                            setMentorDecideError(null);
                          }}
                        >
                          Reject Request
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          disabled={decideExtensionMutation.isPending}
                          onClick={() => {
                            decideExtensionMutation.mutate({ extensionId: req.extensionId, decision: 'Approve' });
                          }}
                        >
                          Approve (+{req.requestedDays}d)
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={appDetails.application.status} />
                      {appDetails.application.eventTag && <EventTagBadge tag={appDetails.application.eventTag} />}
                    </div>
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
                  <>
                    {appDetails.extension.status === 'Pending' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                        <Hourglass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Extension Request Pending Mentor Review</p>
                          <p className="text-xs text-amber-800 mt-0.5">
                            Requested extension: +{appDetails.extension.requestedDays || 7} days (Target deadline: <strong>{formatDate(appDetails.extension.newDeadline)}</strong>)
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5 italic">Reason: "{appDetails.extension.reason}"</p>
                        </div>
                      </div>
                    )}
                    {appDetails.extension.status === 'Approved' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-emerald-600">Deadline Extension Granted</p>
                          <p className="text-xs text-gray-700 mt-0.5">
                            New submission deadline: <strong className="text-emerald-600">{formatDate(appDetails.extension.newDeadline)}</strong>
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 italic">Reason: "{appDetails.extension.reason}"</p>
                        </div>
                      </div>
                    )}
                    {appDetails.extension.status === 'Rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-900">Extension Request Rejected</p>
                          <p className="text-xs text-red-800 mt-0.5">
                            Reason: <strong>{appDetails.extension.rejectionReason || 'Extension request rejected by mentor.'}</strong>
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Student: Certificate Upload ── */}
                {isStudent && showUploadSection && appDetails.certificates.length > 0 && (() => {
                  const totalCerts = appDetails.certificates.length;
                  const submittedCertsCount = appDetails.certificates.filter(
                    (c) => c.status === 'Uploaded' || c.status === 'Verified' || c.status === 'Submitted'
                  ).length;
                  const isAllCertsSubmitted = totalCerts > 0 && submittedCertsCount === totalCerts;

                  return (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Certificate Submission</h5>
                          <span className="text-[11px] font-bold text-emerald-600 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                            {submittedCertsCount} / {totalCerts} Submitted
                          </span>
                        </div>
                        {!appDetails.extension && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRequestExtensionOpen(true)}
                            className="text-xs h-8 px-3 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold"
                          >
                            <Hourglass className="w-3.5 h-3.5 mr-1.5" />
                            Request Extension
                          </Button>
                        )}
                      </div>

                      {isAllCertsSubmitted && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-emerald-600">All Required Certificates Submitted ({submittedCertsCount} / {totalCerts})</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              You have uploaded all {totalCerts} required certificate(s) for this OD application. Your submission is complete and awaiting verification by the Event Coordinator.
                            </p>
                          </div>
                        </div>
                      )}

                      {appDetails.certificates.map((cert) => {
                        const deadlineInfo = getDeadlineInfo(cert.submissionDeadline);
                        const isUploaded = cert.status === 'Uploaded' || cert.status === 'Verified' || cert.status === 'Submitted';
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
                          {cert.status === 'Skipped' ? (
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              Certificate Upload Skipped by Student — Event Marked Complete
                            </div>
                          ) : !isUploaded ? (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-gray-700">Upload Participation Certificate (PDF)</Label>
                                <span className="text-[11px] text-gray-400 font-medium">Max: 1 MB</span>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                  type="file"
                                  accept="application/pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 1 * 1024 * 1024) {
                                        setCertErrors((prev) => ({
                                          ...prev,
                                          [cert.requirementId]: 'Certificate file size must not exceed 1 MB.',
                                        }));
                                        e.target.value = '';
                                        return;
                                      }
                                      setCertFiles((prev) => ({ ...prev, [cert.requirementId]: file }));
                                      setCertErrors((prev) => ({ ...prev, [cert.requirementId]: null }));
                                    }
                                  }}
                                  disabled={uploadCertMutation.isPending || skipCertMutation.isPending}
                                  className="flex-1 text-xs h-9 py-1 file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-2 file:py-0.5 file:text-xs file:font-semibold"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCertSubmit(cert.requirementId)}
                                  disabled={uploadCertMutation.isPending || skipCertMutation.isPending || (!certFiles[cert.requirementId] && !certUrls[cert.requirementId])}
                                  className="h-9 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs shrink-0"
                                >
                                  {uploadCertMutation.isPending ? 'Uploading...' : 'Upload & Submit'}
                                </Button>
                                {isStudent && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to skip uploading a certificate for this event? The event will be marked as completed.')) {
                                        skipCertMutation.mutate(cert.requirementId);
                                      }
                                    }}
                                    disabled={uploadCertMutation.isPending || skipCertMutation.isPending}
                                    className="h-9 px-3 text-xs shrink-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    {skipCertMutation.isPending ? 'Skipping...' : 'Skip (No Cert)'}
                                  </Button>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 font-medium">
                                Accepted format: PDF only. Maximum file size: 1 MB.
                              </p>
                              {certFiles[cert.requirementId] && (
                                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                  Selected: {certFiles[cert.requirementId].name} ({Math.round(certFiles[cert.requirementId].size / 1024)} KB)
                                </p>
                              )}
                              {certErrors[cert.requirementId] && (
                                <p className="text-xs text-red-600 font-medium">{certErrors[cert.requirementId]}</p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                              {cert.status === 'Verified' ? 'Certificate Verified & Stored in OneDrive' : 'Uploaded — Pending Event Coordinator Verification'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  );
                })()}

                {/* ── Faculty: Certificate Verification Panel ── */}
                {!isStudent && isEC && (
                  appDetails.certificates.some((c) => c.status === 'Uploaded')
                ) && (
                  <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Certificate Review Required</h5>
                    </div>
                    {appDetails.certificates.filter((c) => c.status === 'Uploaded').map((cert) => (
                      <div key={cert.requirementId} className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">
                            Certificate #{cert.sequenceNumber} (Uploaded by Student)
                          </span>
                          <StatusBadge status={cert.status} />
                        </div>
                        
                        {/* Mentor can view uploaded PDF for review before approving */}
                        {cert.fileUrl && (
                          <a
                            href={cert.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Preview Uploaded Certificate PDF
                          </a>
                        )}

                        {/* Decision Selection Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => {
                              setVerifyType({ ...verifyType, [cert.requirementId]: 'Verified' });
                              setVerifyError({ ...verifyError, [cert.requirementId]: null });
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-all ${
                              verifyType[cert.requirementId] === 'Verified'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setVerifyType({ ...verifyType, [cert.requirementId]: 'Rejected' });
                              setVerifyError({ ...verifyError, [cert.requirementId]: null });
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-all ${
                              verifyType[cert.requirementId] === 'Rejected'
                                ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>

                        {/* Dedicated Rejection Comment Space */}
                        {verifyType[cert.requirementId] === 'Rejected' && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150 pt-1">
                            <Label className="text-xs font-semibold text-gray-700">
                              Rejection Reason <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                              rows={2}
                              placeholder="Explain why this certificate is being rejected..."
                              value={verifyComments[cert.requirementId] || ''}
                              onChange={(e) => setVerifyComments({ ...verifyComments, [cert.requirementId]: e.target.value })}
                              className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                            />
                          </div>
                        )}

                        {verifyError[cert.requirementId] && (
                          <p className="text-xs text-red-600 font-medium">{verifyError[cert.requirementId]}</p>
                        )}

                        {/* Confirm Action Button */}
                        {verifyType[cert.requirementId] && (
                          <Button
                            size="sm"
                            onClick={() => handleVerifySubmit(String(cert.requirementId))}
                            disabled={verifyCertMutation.isPending}
                            className={`w-full font-bold text-xs h-9 ${
                              verifyType[cert.requirementId] === 'Verified'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {verifyCertMutation.isPending ? 'Submitting...' : verifyType[cert.requirementId] === 'Verified' ? 'Confirm Approval & Store in OneDrive' : 'Confirm Certificate Rejection'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Faculty: Decision Panel ── */}
                {!isStudent && isUserCurrentReviewer && (
                  <div className="border border-border bg-muted rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Action Required</h5>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setDecisionType('Approve'); setDecisionError(null); setDecisionComments(''); }}
                        className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                          decisionType === 'Approve'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
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
                          className="flex w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                      </div>
                    )}

                    {decisionType === 'Approve' && (
                      <p className="text-xs text-emerald-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-medium">
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
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
                              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold hover:underline">
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
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
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
                            stepStatus === 'completed' ? 'bg-primary/10 text-primary'
                            : stepStatus === 'rejected' ? 'bg-destructive/10 text-destructive'
                            : stepStatus === 'active' ? 'bg-primary/10 text-primary ring-2 ring-primary/30 ring-offset-1'
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

                {/* ── Rejection Reason (Shown only if application is rejected) ── */}
                {appDetails.history.some((h) => h.decision === 'Reject' && h.comments && h.comments.trim().length > 0) && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <h5 className="text-xs font-bold text-red-800 uppercase tracking-wider">Rejection Reason</h5>
                    <div className="space-y-2">
                      {appDetails.history
                        .filter((h) => h.decision === 'Reject' && h.comments && h.comments.trim().length > 0)
                        .map((hist, hidx) => (
                          <div key={hidx} className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-red-900">{hist.approverRole}</span>
                              <span className="text-[11px] font-bold text-red-700">Rejected</span>
                            </div>
                            <p className="text-xs text-red-800">{hist.comments}</p>
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
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                <div className="bg-muted border border-border text-foreground text-sm p-3 rounded-xl font-medium">{createStudentSuccess}</div>
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
                <Label className="text-sm font-semibold text-gray-700">Date of Birth <span className="text-red-500">*</span></Label>
                <Input type="date" required value={studentFormValues.dateOfBirth} onChange={(e) => setStudentFormValues((prev) => ({ ...prev, dateOfBirth: e.target.value }))} disabled={onboardStudentMutation.isPending} className="h-10" />
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
                <Button type="submit" className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={onboardStudentMutation.isPending}>
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
              {createFacultySuccess && <div className="bg-muted border border-border text-foreground text-sm p-3 rounded-xl font-medium">{createFacultySuccess}</div>}
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
                <Button type="submit" className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={onboardFacultyMutation.isPending}>
                  {onboardFacultyMutation.isPending ? 'Provisioning...' : 'Provision Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Edit Faculty Dialog (Admin) ── */}
        <Dialog open={!!editingFaculty} onOpenChange={(open) => !open && setEditingFaculty(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">
                Edit Faculty Details ({editingFaculty?.userId})
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              setEditFacultyError(null);
              setEditFacultySuccess(null);
              if (editingFaculty && editFacultyForm.role !== editingFaculty.role) {
                setPendingRoleChange({
                  userId: editingFaculty.userId,
                  facultyName: editFacultyForm.fullName,
                  currentRole: editingFaculty.role,
                  newRole: editFacultyForm.role,
                  actionType: 'edit',
                  editPayload: editFacultyForm,
                });
              } else {
                updateFacultyMutation.mutate(editFacultyForm);
              }
            }} className="space-y-4 pt-2">
              {editFacultySuccess && <div className="bg-muted border border-border text-foreground text-sm p-3 rounded-xl font-medium">{editFacultySuccess}</div>}
              {editFacultyError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{editFacultyError}</div>}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Full Name</Label>
                <Input placeholder="e.g. Dr. ARUN PRASAD" required value={editFacultyForm.fullName} onChange={(e) => setEditFacultyForm((prev) => ({ ...prev, fullName: e.target.value }))} disabled={updateFacultyMutation.isPending} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Designation</Label>
                  <Input placeholder="e.g. Assistant Professor" required value={editFacultyForm.designation} onChange={(e) => setEditFacultyForm((prev) => ({ ...prev, designation: e.target.value }))} disabled={updateFacultyMutation.isPending} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">System Role</Label>
                  <Select value={editFacultyForm.role} onChange={(e) => setEditFacultyForm((prev) => ({ ...prev, role: e.target.value }))} disabled={updateFacultyMutation.isPending} className="h-10">
                    <option value="Mentor">Mentor</option>
                    <option value="Event Coordinator">Event Coordinator</option>
                    <option value="Program Coordinator">Program Coordinator</option>
                    <option value="Head of Department">Head of Department</option>
                    <option value="Administrator">Administrator</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <Label className="text-sm font-semibold text-gray-700">Reset Password (Optional)</Label>
                <Input type="password" placeholder="Leave blank to keep current password" value={editFacultyForm.password} onChange={(e) => setEditFacultyForm((prev) => ({ ...prev, password: e.target.value }))} disabled={updateFacultyMutation.isPending} className="h-10" />
                <p className="text-[11px] text-gray-400 font-medium">Minimum 6 characters if resetting password.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setEditingFaculty(null)} disabled={updateFacultyMutation.isPending}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={updateFacultyMutation.isPending}>
                  {updateFacultyMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Double Verification Role Change Dialog ── */}
        <Dialog open={!!pendingRoleChange} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm Faculty Role Change
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to change the system role of{' '}
                <strong className="text-gray-900">{pendingRoleChange?.facultyName}</strong> ({pendingRoleChange?.userId}) from{' '}
                <span className="font-bold text-gray-700">{pendingRoleChange?.currentRole}</span> to{' '}
                <span className="font-bold text-primary">{pendingRoleChange?.newRole}</span>?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 font-medium">
                This action will immediately update access permissions for this faculty account.
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setPendingRoleChange(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  onClick={() => {
                    if (!pendingRoleChange) return;
                    if (pendingRoleChange.actionType === 'assign') {
                      assignRoleMutation.mutate({
                        userId: pendingRoleChange.userId,
                        role: pendingRoleChange.newRole as any,
                      });
                    } else if (pendingRoleChange.actionType === 'edit') {
                      updateFacultyMutation.mutate(pendingRoleChange.editPayload);
                    }
                    setPendingRoleChange(null);
                  }}
                >
                  Confirm Role Change
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Student Extension Request Dialog ── */}
        <Dialog open={requestExtensionOpen} onOpenChange={(open) => !open && setRequestExtensionOpen(false)}>
          <DialogContent className="max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Request Deadline Extension</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleExtensionRequestSubmit} className="space-y-4 pt-2">
              {extensionFormSuccess && <div className="bg-muted border border-border text-foreground text-sm p-3 rounded-xl font-medium">{extensionFormSuccess}</div>}
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
                  className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setRequestExtensionOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Mentor Extension Rejection Dialog ── */}
        <Dialog open={!!mentorDecideExtId} onOpenChange={(open) => !open && setMentorDecideExtId(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Reject Deadline Extension</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!mentorDecideExtId) return;
              if (mentorRejectComments.trim().length < 5) {
                setMentorDecideError('Please provide a reason for rejecting the extension (minimum 5 characters).');
                return;
              }
              decideExtensionMutation.mutate({
                extensionId: mentorDecideExtId,
                decision: 'Reject',
                comments: mentorRejectComments,
              });
            }} className="space-y-4 pt-2">
              {mentorDecideError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">{mentorDecideError}</div>}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Rejection Reason <span className="text-red-500">*</span></Label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this extension request is being rejected..."
                  value={mentorRejectComments}
                  onChange={(e) => setMentorRejectComments(e.target.value)}
                  disabled={decideExtensionMutation.isPending}
                  className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setMentorDecideExtId(null)} disabled={decideExtensionMutation.isPending}>Cancel</Button>
                <Button type="submit" className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm" disabled={decideExtensionMutation.isPending}>
                  {decideExtensionMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardShell>
  );
};
