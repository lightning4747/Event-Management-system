import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Table, TableHeader } from '../components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { 
  FileText, Clock, CheckCircle, XCircle, AlertCircle, Plus, 
  ChevronRight, ExternalLink, Shield, Check, X, ClipboardList, Eye,
  User as UserIcon, UserPlus, Calendar, Hourglass, Download, Settings
} from 'lucide-react';

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

interface ApplicationDetails extends ApplicationRow {
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

const oneDriveSchema = z
  .string()
  .url('Please enter a valid URL.')
  .regex(/(onedrive\.live\.com|sharepoint\.com)/, 'URL must be a valid Microsoft OneDrive or SharePoint link.');

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAppId, setSelectedAppId] = React.useState<string | null>(null);
  
  // Extension request states (Student side)
  const [requestExtensionOpen, setRequestExtensionOpen] = React.useState(false);
  const [extensionReason, setExtensionReason] = React.useState('');
  const [requestedDays, setRequestedDays] = React.useState(7);
  const [extensionFormError, setExtensionFormError] = React.useState<string | null>(null);
  const [extensionFormSuccess, setExtensionFormSuccess] = React.useState<string | null>(null);

  // Extension grant states (Mentor side)
  const [grantExtensionOpen, setGrantExtensionOpen] = React.useState(false);
  const [grantAppId, setGrantAppId] = React.useState<string | null>(null);
  const [grantNewDeadline, setGrantNewDeadline] = React.useState('');
  const [grantReason, setGrantReason] = React.useState('');
  const [grantError, setGrantError] = React.useState<string | null>(null);

  // Faculty student onboarding form states
  const [createStudentOpen, setCreateStudentOpen] = React.useState(false);
  const [studentFormValues, setStudentFormValues] = React.useState({
    userId: '',
    username: '',
    fullName: '',
    dateOfBirth: '',
    admissionYear: new Date().getFullYear(),
    section: 'A',
  });
  const [createStudentError, setCreateStudentError] = React.useState<string | null>(null);
  const [createStudentSuccess, setCreateStudentSuccess] = React.useState<string | null>(null);

  // Admin Faculty Onboarding states (Module 9)
  const [createFacultyOpen, setCreateFacultyOpen] = React.useState(false);
  const [facultyFormValues, setFacultyFormValues] = React.useState({
    userId: '',
    username: '',
    fullName: '',
    password: '',
    role: 'Mentor',
    designation: 'Assistant Professor',
  });
  const [createFacultyError, setCreateFacultyError] = React.useState<string | null>(null);
  const [createFacultySuccess, setCreateFacultySuccess] = React.useState<string | null>(null);

  // CSV Export Filter states (Module 8)
  const [filterFromDate, setFilterFromDate] = React.useState('');
  const [filterToDate, setFilterToDate] = React.useState('');
  const [filterSection, setFilterSection] = React.useState('');
  const [filterYear, setFilterYear] = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);

  const tableHeaders: TableHeader[] = [
    { label: 'Student', key: 'studentName' },
    { label: 'Event Title', key: 'title' },
    { label: 'Dates', key: 'fromDate' },
    { label: 'Status', key: 'status' },
    { label: 'Action', key: 'action' },
  ];

  // Faculty decision form states
  const [decisionType, setDecisionType] = React.useState<'Approve' | 'Reject' | null>(null);
  const [decisionComments, setDecisionComments] = React.useState('');
  const [decisionError, setDecisionError] = React.useState<string | null>(null);

  // Certificate verification form states
  const [verifyType, setVerifyType] = React.useState<Record<string, 'Verified' | 'Rejected'>>({});
  const [verifyComments, setVerifyComments] = React.useState<Record<string, string>>({});
  const [verifyError, setVerifyError] = React.useState<Record<string, string | null>>({});

  // Student certificate upload states
  const [certUrls, setCertUrls] = React.useState<Record<string, string>>({});
  const [certErrors, setCertErrors] = React.useState<Record<string, string | null>>({});

  // Active queue filter tabs
  const [activeTab, setActiveTab] = React.useState<'pending' | 'certificates' | 'extensions' | 'all'>('pending');

  const isStudent = user?.role === 'Student';
  const isEC = user?.role === 'Event Coordinator';
  const isMentor = user?.role === 'Mentor';
  const isPC = user?.role === 'Program Coordinator';
  const isHOD = user?.role === 'Head of Department';
  const isAdmin = user?.role === 'Administrator';

  // 1. Fetch dashboard metrics depending on user role
  const { data: studentMetrics } = useQuery({
    queryKey: ['studentMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/student');
      return res.json();
    },
    enabled: isStudent,
  });

  const { data: ecMetrics } = useQuery({
    queryKey: ['ecMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/coordinator');
      return res.json();
    },
    enabled: isEC,
  });

  const { data: mentorMetrics } = useQuery({
    queryKey: ['mentorMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/mentor');
      return res.json();
    },
    enabled: isMentor,
  });

  const { data: hodMetrics } = useQuery({
    queryKey: ['hodMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/hod');
      return res.json();
    },
    enabled: isHOD,
  });

  // Admin: Fetch list of faculty (Module 9)
  const { data: facultyList = [], isLoading: facultyListLoading } = useQuery<FacultyRow[]>({
    queryKey: ['adminFacultyList'],
    queryFn: async () => {
      const res = await apiFetch('/admin/faculty');
      return res.json();
    },
    enabled: isAdmin,
  });

  // 2. Fetch applications lists
  const { data: studentApps = [], isLoading: studentAppsLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['studentApplications'],
    queryFn: async () => {
      const res = await apiFetch('/applications/my');
      return res.json();
    },
    enabled: isStudent,
  });

  const { data: departmentApps = [], isLoading: deptAppsLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['departmentApplications'],
    queryFn: async () => {
      const res = await apiFetch('/applications');
      return res.json();
    },
    enabled: !isStudent && !isAdmin,
  });

  // 3. Fetch specific application details
  const { data: appDetails } = useQuery<ApplicationDetails>({
    queryKey: ['applicationDetails', selectedAppId],
    queryFn: async () => {
      const res = await apiFetch(`/applications/${selectedAppId}`);
      return res.json();
    },
    enabled: !!selectedAppId,
  });

  // 4. Mutation to submit certificate OneDrive URL
  const uploadCertMutation = useMutation({
    mutationFn: async (payload: { requirementId: string; fileUrl: string }) => {
      const res = await apiFetch('/certificates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['studentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['studentMetrics'] });
    },
  });

  // 5. Mutation to submit faculty review decision
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

  // 6. Mutation to submit certificate verification
  const verifyCertMutation = useMutation({
    mutationFn: async (payload: { requirementId: string; status: 'Verified' | 'Rejected'; comments?: string }) => {
      const res = await apiFetch(`/certificates/${payload.requirementId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          status: payload.status,
          comments: payload.comments,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      queryClient.invalidateQueries({ queryKey: ['ecMetrics'] });
    },
  });

  // 7. Mutation to onboard student account
  const onboardStudentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiFetch('/mentor/student', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      setCreateStudentSuccess('Student account created successfully.');
      queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['departmentApplications'] });
      setStudentFormValues({
        userId: '',
        username: '',
        fullName: '',
        dateOfBirth: '',
        admissionYear: new Date().getFullYear(),
        section: 'A',
      });
      setTimeout(() => {
        setCreateStudentOpen(false);
        setCreateStudentSuccess(null);
      }, 1500);
    },
    onError: (err: any) => {
      setCreateStudentError(err.message || 'Failed to create student account.');
    },
  });

  // 8. Mutation to onboard faculty account (Admin side - Module 9)
  const onboardFacultyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiFetch('/admin/faculty', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      setCreateFacultySuccess('Faculty account created successfully.');
      queryClient.invalidateQueries({ queryKey: ['adminFacultyList'] });
      setFacultyFormValues({
        userId: '',
        username: '',
        fullName: '',
        password: '',
        role: 'Mentor',
        designation: 'Assistant Professor',
      });
      setTimeout(() => {
        setCreateFacultyOpen(false);
        setCreateFacultySuccess(null);
      }, 1500);
    },
    onError: (err: any) => {
      setCreateFacultyError(err.message || 'Failed to create faculty account.');
    },
  });

  // 9. Mutation to grant deadline extension (Mentor side)
  const grantExtensionMutation = useMutation({
    mutationFn: async (payload: { applicationId: string; newDeadline: string; reason: string }) => {
      const res = await apiFetch('/extensions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      if (grantAppId) {
        const stored = localStorage.getItem('mcet_extension_requests');
        if (stored) {
          const parsed = JSON.parse(stored) as ExtensionRequestMock[];
          const filtered = parsed.filter(r => r.applicationId !== grantAppId);
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
    onError: (err: any) => {
      setGrantError(err.message || 'Failed to grant deadline extension.');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Withdrawn':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getStepStatus = (stepRole: string, currentStatus: string, history: any[] = []) => {
    const roleOrder = ['Event Coordinator', 'Mentor', 'Program Coordinator', 'Head of Department'];
    const currentIdx = roleOrder.indexOf(currentStatus.replace('In Progress: ', ''));

    if (currentStatus === 'Approved') return 'completed';
    if (currentStatus === 'Rejected') {
      const decision = history.find(h => h.approverRole === stepRole && h.decision === 'Reject');
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

    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { isOverdue: true, text: 'Overdue', badgeColor: 'bg-red-100 text-red-800 border-red-200' };
    }
    if (diffDays === 0) {
      return { isOverdue: false, text: 'Due Today', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    return { isOverdue: false, text: `${diffDays} days left`, badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  const handleCertSubmit = async (reqId: string) => {
    const url = certUrls[reqId] || '';
    const validation = oneDriveSchema.safeParse(url);
    if (!validation.success) {
      setCertErrors(prev => ({ ...prev, [reqId]: validation.error.errors[0].message }));
      return;
    }
    setCertErrors(prev => ({ ...prev, [reqId]: null }));

    try {
      await uploadCertMutation.mutateAsync({ requirementId: reqId, fileUrl: url });
      setCertUrls(prev => ({ ...prev, [reqId]: '' }));
    } catch (err: any) {
      setCertErrors(prev => ({ ...prev, [reqId]: err.message || 'Submission failed.' }));
    }
  };

  // Submit decision for active step
  const handleDecideSubmit = () => {
    if (!decisionType) return;
    if (decisionType === 'Reject' && !decisionComments.trim()) {
      setDecisionError('Rejection comments are mandatory when rejecting.');
      return;
    }
    setDecisionError(null);
    decideMutation.mutate({ decision: decisionType, comments: decisionComments });
  };

  // Submit certificate verification decision
  const handleVerifySubmit = async (reqId: string) => {
    const type = verifyType[reqId];
    const comments = verifyComments[reqId] || '';

    if (!type) return;
    if (type === 'Rejected' && !comments.trim()) {
      setVerifyError(prev => ({ ...prev, [reqId]: 'Rejection comments are mandatory.' }));
      return;
    }
    setVerifyError(prev => ({ ...prev, [reqId]: null }));

    try {
      await verifyCertMutation.mutateAsync({ requirementId: reqId, status: type, comments });
      setVerifyComments(prev => ({ ...prev, [reqId]: '' }));
      setVerifyType(prev => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    } catch (err: any) {
      setVerifyError(prev => ({ ...prev, [reqId]: err.message || 'Verification failed.' }));
    }
  };

  const handleStudentOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStudentError(null);
    setCreateStudentSuccess(null);
    onboardStudentMutation.mutate(studentFormValues);
  };

  const handleFacultyOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFacultyError(null);
    setCreateFacultySuccess(null);
    onboardFacultyMutation.mutate(facultyFormValues);
  };

  // Trigger download stream with token support (Module 8)
  const handleExportCSV = async () => {
    const params = new URLSearchParams();
    if (filterFromDate) params.append('fromDate', filterFromDate);
    if (filterToDate) params.append('toDate', filterToDate);
    if (filterSection) params.append('section', filterSection);
    if (filterYear) params.append('admissionYear', filterYear);

    const path = isMentor ? `/reports/cohort?${params.toString()}` : `/reports/global?${params.toString()}`;
    
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

  // Submit simulated extension request to localStorage
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
      setExtensionFormError('Rule Check: Subsequent extensions are blocked. An extension was already granted.');
      return;
    }

    const newRequest: ExtensionRequestMock = {
      applicationId: appDetails.applicationId,
      title: appDetails.title,
      studentId: appDetails.studentId,
      studentName: appDetails.studentName,
      reason: extensionReason,
      requestedDays: requestedDays,
      requestedAt: new Date().toISOString(),
    };

    const stored = localStorage.getItem('mcet_extension_requests');
    const list: ExtensionRequestMock[] = stored ? JSON.parse(stored) : [];
    
    const exists = list.some(r => r.applicationId === appDetails.applicationId);
    if (exists) {
      setExtensionFormError('An extension request for this application is already pending review.');
      return;
    }

    list.push(newRequest);
    localStorage.setItem('mcet_extension_requests', JSON.stringify(list));

    setExtensionFormSuccess('Extension request submitted successfully to your Mentor!');
    setExtensionReason('');
    
    setTimeout(() => {
      setRequestExtensionOpen(false);
      setExtensionFormSuccess(null);
    }, 1500);
  };

  // Submit database extension grant (Mentor side)
  const handleGrantExtensionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);

    if (!grantAppId) return;
    if (grantReason.trim().length < 10) {
      setGrantError('Reason must be at least 10 characters long.');
      return;
    }

    const currentDateStr = new Date().toISOString().split('T')[0];
    if (grantNewDeadline <= currentDateStr) {
      setGrantError('The new deadline must be a future date.');
      return;
    }

    grantExtensionMutation.mutate({
      applicationId: grantAppId,
      newDeadline: grantNewDeadline,
      reason: grantReason,
    });
  };

  const getHasOverdueCerts = () => {
    if (!isStudent) return false;
    return studentApps.some(app => {
      if (app.status !== 'Approved') return false;
      const dl = getDeadlineInfo(app.toDate);
      return dl.isOverdue;
    });
  };

  const hasOverdueCerts = getHasOverdueCerts();

  const getFacultyPendingStatus = () => {
    if (isEC) return 'In Progress: Event Coordinator';
    if (isMentor) return 'In Progress: Mentor';
    if (isPC) return 'In Progress: Program Coordinator';
    if (isHOD) return 'In Progress: Head of Department';
    return '';
  };

  const mockExtensionRequests = isMentor ? (localStorage.getItem('mcet_extension_requests') ? JSON.parse(localStorage.getItem('mcet_extension_requests')!) : []) : [];

  const getFilteredApps = () => {
    const targetStatus = getFacultyPendingStatus();
    
    if (activeTab === 'pending') {
      return departmentApps.filter(app => app.status === targetStatus);
    }
    if (activeTab === 'certificates') {
      return departmentApps.filter(app => app.status === 'Approved');
    }
    return departmentApps;
  };

  const filteredApps = getFilteredApps();

  const isUserCurrentReviewer = appDetails ? appDetails.status === getFacultyPendingStatus() : false;
  const isPostEvent = appDetails ? new Date() >= new Date(appDetails.toDate) : false;
  const isAppApproved = appDetails?.status === 'Approved';
  const showUploadSection = isAppApproved && isPostEvent;

  const isExtensionPending = appDetails ? (localStorage.getItem('mcet_extension_requests') ? (JSON.parse(localStorage.getItem('mcet_extension_requests')!) as ExtensionRequestMock[]).some(r => r.applicationId === appDetails.applicationId) : false) : false;

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* ========================================================
            OVERDUE WARNING BANNER
           ======================================================== */}
        {hasOverdueCerts && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-lg flex items-start gap-2.5 animate-in slide-in-from-top duration-300 font-semibold shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold">⚠️ Overdue Upload Warning!</p>
              <p className="text-gray-700 font-medium mt-0.5">
                One or more of your approved On-Duty certificate deadlines have expired. Please submit your OneDrive links or contact your assigned cohort mentor immediately to request a deadline extension.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            1. ADMINISTRATOR CONSOLE (Module 9)
           ======================================================== */}
        {isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Administrator Console</h2>
                <p className="text-xs text-gray-500">Manage institutional faculty listings and onboarding authorizations</p>
              </div>
              <Button
                onClick={() => setCreateFacultyOpen(true)}
                className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 h-9"
              >
                <UserPlus className="w-4 h-4" /> Provision Faculty Account
              </Button>
            </div>

            {/* Faculty directory listing */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-gray-500" /> Faculty Accounts Registry
              </h3>

              {facultyListLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
                  LOADING REGISTRIES...
                </div>
              ) : facultyList.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500 font-medium">
                  No faculty accounts registered in the database.
                </div>
              ) : (
                <>
                  {/* Mobile Directory List */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {facultyList.map((fac) => (
                      <div
                        key={fac.userId}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm text-gray-900">{fac.fullName}</h4>
                          <span className="text-[9px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold border border-gray-200">
                            {fac.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium">
                          ID: {fac.userId} • Designation: {fac.designation}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Directory Table */}
                  <div className="hidden md:block">
                    <Table
                      headers={[
                        { label: 'Faculty ID', key: 'userId' },
                        { label: 'Full Name', key: 'fullName' },
                        { label: 'Designation', key: 'designation' },
                        { label: 'System Role', key: 'role' },
                      ]}
                      data={facultyList}
                      renderCell={(row: FacultyRow, key) => {
                        if (key === 'userId') {
                          return <span className="font-bold text-gray-900">{row.userId}</span>;
                        }
                        if (key === 'fullName') {
                          return <span className="font-medium text-gray-800">{row.fullName}</span>;
                        }
                        if (key === 'designation') {
                          return <span className="text-gray-500">{row.designation}</span>;
                        }
                        if (key === 'role') {
                          return (
                            <span className="border text-[10px] font-semibold px-2.5 py-0.5 rounded bg-gray-50 text-gray-700 border-gray-200">
                              {row.role}
                            </span>
                          );
                        }
                        return null;
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            2. STUDENT DASHBOARD
           ======================================================== */}
        {isStudent && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Student Dashboard</h2>
                <p className="text-xs text-gray-500">Track and manage your event On-Duty approvals</p>
              </div>
              <Link to="/applications/new">
                <Button className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 h-9">
                  <Plus className="w-4 h-4" /> New Request
                </Button>
              </Link>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded text-gray-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total OD</p>
                  <h3 className="text-base font-bold text-gray-900">{studentMetrics?.totalSubmitted ?? 0}</h3>
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pending</p>
                  <h3 className="text-base font-bold text-gray-900">{studentMetrics?.pendingCount ?? 0}</h3>
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Approved</p>
                  <h3 className="text-base font-bold text-gray-900">{studentMetrics?.approvedCount ?? 0}</h3>
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded text-red-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Rejected</p>
                  <h3 className="text-base font-bold text-gray-900">{studentMetrics?.rejectedCount ?? 0}</h3>
                </div>
              </div>
              <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3 col-span-2 md:col-span-1">
                <div className="p-2 bg-blue-50 rounded text-blue-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Upload Req.</p>
                  <h3 className="text-base font-bold text-gray-900">{studentMetrics?.certificatesActionCount ?? 0}</h3>
                </div>
              </div>
            </div>

            {/* Applications List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Your OD Applications</h3>
              {studentAppsLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
                  RETRIEVING REQUESTS...
                </div>
              ) : studentApps.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500 font-medium">
                  No On-Duty requests submitted yet. Click "New Request" to get started.
                </div>
              ) : (
                <>
                  {/* Mobile Feed */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {studentApps.map((app) => (
                      <div
                        key={app.applicationId}
                        onClick={() => setSelectedAppId(app.applicationId)}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer hover:border-gray-300 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-sm text-gray-900">{app.title}</h4>
                          <p className="text-[11px] text-gray-500 font-medium">
                            {app.fromDate} to {app.toDate} • {app.numberOfEvents} {app.numberOfEvents === 1 ? 'event' : 'events'}
                          </p>
                          <span className={`inline-block border text-[10px] font-semibold px-2 py-0.5 rounded ${getStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table
                      headers={[
                        { label: 'Title', key: 'title' },
                        { label: 'Dates', key: 'fromDate' },
                        { label: 'Events', key: 'numberOfEvents' },
                        { label: 'Status', key: 'status' },
                        { label: 'Action', key: 'action' },
                      ]}
                      data={studentApps}
                      renderCell={(row: ApplicationRow, key) => {
                        if (key === 'title') {
                          return <span className="font-bold text-gray-900">{row.title}</span>;
                        }
                        if (key === 'fromDate') {
                          return <span className="text-gray-500 font-medium">{row.fromDate} to {row.toDate}</span>;
                        }
                        if (key === 'status') {
                          return (
                            <span className={`border text-[10px] font-semibold px-2.5 py-0.5 rounded ${getStatusColor(row.status)}`}>
                              {row.status}
                            </span>
                          );
                        }
                        if (key === 'action') {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 px-2.5"
                              onClick={() => setSelectedAppId(row.applicationId)}
                            >
                              View Progress
                            </Button>
                          );
                        }
                        return null;
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            3. FACULTY APPROVAL & VERIFICATION CONSOLE
           ======================================================== */}
        {!isStudent && !isAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Faculty Approval Console</h2>
                <p className="text-xs text-gray-500">Manage pending requests and verify student credentials</p>
              </div>
              {isMentor && (
                <Button
                  onClick={() => setCreateStudentOpen(true)}
                  className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 h-9"
                >
                  <UserPlus className="w-4 h-4" /> Create Student Account
                </Button>
              )}
            </div>

            {/* Role-Specific Metrics Grid */}
            {isEC && ecMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded text-gray-600"><FileText className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Applications</p>
                    <h3 className="text-base font-bold text-gray-900">{ecMetrics.totalApplications}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded text-amber-600"><Clock className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pending EC Approvals</p>
                    <h3 className="text-base font-bold text-gray-900">{ecMetrics.pendingECApprovals}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded text-blue-600"><ClipboardList className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Certificates to Verify</p>
                    <h3 className="text-base font-bold text-gray-900">{ecMetrics.pendingCertificateVerifications}</h3>
                  </div>
                </div>
              </div>
            )}

            {isMentor && mentorMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded text-gray-600"><UserIcon className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Mentees</p>
                    <h3 className="text-base font-bold text-gray-900">{mentorMetrics.totalMentees}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded text-amber-600"><Clock className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pending Mentee Approvals</p>
                    <h3 className="text-base font-bold text-gray-900">{mentorMetrics.pendingMenteeApprovals}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded text-red-600"><AlertCircle className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Mentees Overdue</p>
                    <h3 className="text-base font-bold text-gray-900">{mentorMetrics.menteesWithExpiredDeadlines}</h3>
                  </div>
                </div>
              </div>
            )}

            {isHOD && hodMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded text-gray-600"><FileText className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total OD Requests</p>
                    <h3 className="text-base font-bold text-gray-900">{hodMetrics.totalApplications}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded text-green-600"><CheckCircle className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Approved Requests</p>
                    <h3 className="text-base font-bold text-gray-900">{hodMetrics.approvedApplications}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded text-blue-600"><UserIcon className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Active Students</p>
                    <h3 className="text-base font-bold text-gray-900">{hodMetrics.activeStudentsCount}</h3>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded text-amber-600"><Clock className="w-4 h-4" /></div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pending HOD Queue</p>
                    <h3 className="text-base font-bold text-gray-900">{hodMetrics.pendingHODApprovals}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                CSV EXPORT FILTER PANEL (Module 8 - Tasks 8.1 & 8.2)
               ======================================================== */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg space-y-3.5">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Download className="w-4 h-4 text-gray-600" /> Export On-Duty Data Report
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="repFrom" className="text-[10px] text-gray-400 uppercase font-bold">From Date</Label>
                  <Input
                    id="repFrom"
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repTo" className="text-[10px] text-gray-400 uppercase font-bold">To Date</Label>
                  <Input
                    id="repTo"
                    type="date"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repSection" className="text-[10px] text-gray-400 uppercase font-bold">Section</Label>
                  <Select
                    id="repSection"
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="text-xs h-8"
                  >
                    <option value="">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="repYear" className="text-[10px] text-gray-400 uppercase font-bold">Admission Year</Label>
                  <Input
                    id="repYear"
                    type="number"
                    placeholder="e.g. 2024"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleExportCSV}
                  disabled={exportLoading}
                  className="text-xs h-8 gap-1"
                >
                  {exportLoading ? 'Generating Export...' : 'Download CSV Report'}
                </Button>
              </div>
            </div>

            {/* Filter Navigation Tabs */}
            <div className="border-b border-gray-200 flex gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-2 px-3 border-b-2 text-xs font-bold transition-all -mb-px flex items-center gap-1.5 ${
                  activeTab === 'pending'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Pending Actions
              </button>
              {isEC && (
                <button
                  onClick={() => setActiveTab('certificates')}
                  className={`py-2 px-3 border-b-2 text-xs font-bold transition-all -mb-px flex items-center gap-1.5 ${
                    activeTab === 'certificates'
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Certificate Queue
                </button>
              )}
              {isMentor && (
                <button
                  onClick={() => setActiveTab('extensions')}
                  className={`py-2 px-3 border-b-2 text-xs font-bold transition-all -mb-px flex items-center gap-1.5 ${
                    activeTab === 'extensions'
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Hourglass className="w-3.5 h-3.5" /> Extension Requests ({mockExtensionRequests.length})
                </button>
              )}
              <button
                onClick={() => setActiveTab('all')}
                className={`py-2 px-3 border-b-2 text-xs font-bold transition-all -mb-px flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" /> All Applications
              </button>
            </div>

            {/* Active Queue lists */}
            <div className="space-y-4">
              {activeTab === 'extensions' && isMentor ? (
                /* ============ EXTENSION REVIEW CONSOLE ============ */
                mockExtensionRequests.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500 font-medium">
                    No pending deadline extension requests from cohort students.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mockExtensionRequests.map((req: any) => (
                      <div
                        key={req.applicationId}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                            {req.studentName} ({req.studentId})
                          </span>
                          <h4 className="font-bold text-sm text-gray-900 truncate">{req.title}</h4>
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5 mt-2 font-medium">
                            <span className="font-bold block">Requested Days: {req.requestedDays}</span>
                            Reason: {req.reason}
                          </p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-[11px] h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            onClick={() => {
                              const stored = localStorage.getItem('mcet_extension_requests');
                              if (stored) {
                                const list = JSON.parse(stored) as ExtensionRequestMock[];
                                const filtered = list.filter(r => r.applicationId !== req.applicationId);
                                localStorage.setItem('mcet_extension_requests', JSON.stringify(filtered));
                                queryClient.invalidateQueries({ queryKey: ['mentorMetrics'] });
                              }
                            }}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-[11px] h-8"
                            onClick={() => {
                              setGrantAppId(req.applicationId);
                              setGrantReason(`Granted requested extension of ${req.requestedDays} days: ${req.reason}`);
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
              ) : deptAppsLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
                  LOADING REGISTRY QUEUES...
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500 font-medium">
                  No records matching the selected queue filter.
                </div>
              ) : (
                <>
                  {/* Mobile Feed */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filteredApps.map((app) => (
                      <div
                        key={app.applicationId}
                        onClick={() => setSelectedAppId(app.applicationId)}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer hover:border-gray-300 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{app.studentName}</p>
                          <h4 className="font-bold text-sm text-gray-900">{app.title}</h4>
                          <p className="text-[11px] text-gray-500 font-medium">{app.fromDate} to {app.toDate}</p>
                          <span className={`inline-block border text-[10px] font-semibold px-2 py-0.5 rounded ${getStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <Table
                      headers={tableHeaders}
                      data={filteredApps}
                      renderCell={(row: ApplicationRow, key) => {
                        if (key === 'studentName') {
                          return (
                            <div className="font-medium text-gray-900">
                              <p className="font-bold">{row.studentName}</p>
                              <p className="text-[10px] text-gray-400 font-semibold">{row.studentId}</p>
                            </div>
                          );
                        }
                        if (key === 'title') {
                          return <span className="font-bold text-gray-800">{row.title}</span>;
                        }
                        if (key === 'fromDate') {
                          return <span className="text-gray-500 font-medium">{row.fromDate} to {row.toDate}</span>;
                        }
                        if (key === 'status') {
                          return (
                            <span className={`border text-[10px] font-semibold px-2.5 py-0.5 rounded ${getStatusColor(row.status)}`}>
                              {row.status}
                            </span>
                          );
                        }
                        if (key === 'action') {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 px-2.5 flex items-center gap-1"
                              onClick={() => setSelectedAppId(row.applicationId)}
                            >
                              <Eye className="w-3.5 h-3.5" /> Review details
                            </Button>
                          );
                        }
                        return null;
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            4. WORKFLOW DRAWER / DIALOG (UNIFIED REVIEW CONSOLE)
           ======================================================== */}
        <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
          <DialogContent className="max-w-md bg-white border border-gray-200 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Request Audit Details</DialogTitle>
            </DialogHeader>

            {appDetails ? (
              <div className="space-y-5 pt-2">
                {/* Core metadata card */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      StudentID: {appDetails.studentId}
                    </span>
                    <span className={`border text-[9px] font-bold px-2 py-0.5 rounded ${getStatusColor(appDetails.status)}`}>
                      {appDetails.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">{appDetails.title}</h4>
                  <p className="text-[10px] text-gray-500 font-medium">
                    {appDetails.location} • {appDetails.fromDate} to {appDetails.toDate} • {appDetails.numberOfEvents} {appDetails.numberOfEvents === 1 ? 'event' : 'events'}
                  </p>
                </div>

                {/* Extension alert banner */}
                {appDetails.extension && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] p-3 rounded-lg flex items-start gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Deadline Extension Active</p>
                      <p className="text-gray-700 font-medium mt-0.5">
                        New upload deadline granted: <span className="font-bold">{appDetails.extension.newDeadline}</span>.
                      </p>
                      <p className="text-gray-500 font-medium text-[10px] mt-0.5">Reason: {appDetails.extension.reason}</p>
                    </div>
                  </div>
                )}

                {/* Student upload console */}
                {isStudent && showUploadSection && appDetails.certificates && appDetails.certificates.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-gray-200 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center gap-2">
                      <h5 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Post-Event Certificate Submission</h5>
                      
                      {!appDetails.extension ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isExtensionPending}
                          onClick={() => setRequestExtensionOpen(true)}
                          className="text-[10px] h-7 px-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-1 font-bold"
                        >
                          <Hourglass className="w-3 h-3" />
                          {isExtensionPending ? 'Extension Pending' : 'Request Extension'}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold border border-gray-200 bg-gray-50 px-2 py-0.5 rounded select-none">
                          Extension Granted
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {appDetails.certificates.map((cert) => {
                        const deadlineInfo = getDeadlineInfo(cert.submissionDeadline);
                        const isUploaded = cert.status === 'Submitted' || cert.status === 'Verified';

                        return (
                          <div key={cert.requirementId} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50/50">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">
                                Certificate {appDetails.certificates.length > 1 ? `#${cert.sequenceNumber}` : ''}
                              </span>
                              <div className="flex gap-1.5 items-center">
                                <span className={`border text-[9px] font-bold px-2 py-0.5 rounded ${getStatusColor(cert.status)}`}>
                                  {cert.status}
                                </span>
                                {!isUploaded && (
                                  <span className={`border text-[9px] font-bold px-2 py-0.5 rounded ${deadlineInfo.badgeColor}`}>
                                    {deadlineInfo.text}
                                  </span>
                                )}
                              </div>
                            </div>

                            {cert.status === 'Rejected' && cert.rejectionReason && (
                              <div className="bg-red-50 border border-red-200 text-red-800 text-[11px] p-2.5 rounded font-medium">
                                <p className="font-bold mb-0.5">Rejection Comments:</p>
                                <p>{cert.rejectionReason}</p>
                              </div>
                            )}

                            {!isUploaded ? (
                              <div className="space-y-2">
                                <Label htmlFor={`url-${cert.requirementId}`} className="text-[11px] text-gray-500">
                                  OneDrive / SharePoint sharing link
                                </Label>
                                <div className="flex gap-2">
                                  <Input
                                    id={`url-${cert.requirementId}`}
                                    placeholder="https://onedrive.live.com/..."
                                    value={certUrls[cert.requirementId] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCertUrls(prev => ({ ...prev, [cert.requirementId]: val }));
                                    }}
                                    disabled={uploadCertMutation.isPending}
                                    className="text-xs h-8 flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleCertSubmit(cert.requirementId)}
                                    disabled={uploadCertMutation.isPending || !certUrls[cert.requirementId]}
                                    className="text-xs h-8 px-3"
                                  >
                                    Submit
                                  </Button>
                                </div>
                                {certErrors[cert.requirementId] && (
                                  <p className="text-[10px] text-destructive font-medium">
                                    {certErrors[cert.requirementId]}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50/50 p-2 border border-blue-100 rounded">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <a
                                  href={cert.fileUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline truncate"
                                >
                                  View Submitted URL
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Faculty review decisions console */}
                {!isStudent && isUserCurrentReviewer && (
                  <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-3 space-y-3.5">
                    <h5 className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-4 h-4 text-amber-600" /> Approvals Action Required
                    </h5>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDecisionType('Approve');
                          setDecisionError(null);
                        }}
                        className={`flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          decisionType === 'Approve'
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setDecisionType('Reject');
                          setDecisionError(null);
                        }}
                        className={`flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          decisionType === 'Reject'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>

                    {decisionType && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        <Label htmlFor="comments">
                          Comments {decisionType === 'Reject' && <span className="text-red-500 font-bold">*</span>}
                        </Label>
                        <Input
                          id="comments"
                          placeholder={
                            decisionType === 'Reject'
                              ? 'Explain why this request is being rejected...'
                              : 'Comments or recommendations (optional)...'
                          }
                          value={decisionComments}
                          onChange={(e) => setDecisionComments(e.target.value)}
                          className="text-xs h-9"
                        />
                      </div>
                    )}

                    {decisionError && (
                      <p className="text-[10px] text-destructive font-bold">{decisionError}</p>
                    )}

                    {decisionType && (
                      <Button
                        onClick={handleDecideSubmit}
                        disabled={decideMutation.isPending}
                        className="w-full text-xs h-9"
                      >
                        {decideMutation.isPending ? 'Logging Decision...' : 'Confirm Decision'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Certificate verification console */}
                {!isStudent && isEC && appDetails.certificates && appDetails.certificates.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h5 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Post-Event Certificate verification</h5>
                    <div className="space-y-4">
                      {appDetails.certificates.map((cert) => {
                        const isUploaded = cert.status === 'Uploaded';
                        const isRejected = cert.status === 'Rejected';

                        return (
                          <div key={cert.requirementId} className="border border-gray-250 rounded-lg p-3 space-y-3 bg-gray-50/50">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">
                                Certificate {appDetails.certificates.length > 1 ? `#${cert.sequenceNumber}` : ''}
                              </span>
                              <span className={`border text-[9px] font-bold px-2 py-0.5 rounded ${getStatusColor(cert.status)}`}>
                                {cert.status}
                              </span>
                            </div>

                            {cert.fileUrl ? (
                              <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50/30 p-2 border border-blue-100 rounded">
                                <ExternalLink className="w-3.5 h-3.5" />
                                <a
                                  href={cert.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline truncate"
                                >
                                  Open Student's OneDrive Link
                                </a>
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 italic">No certificate URL submitted yet.</p>
                            )}

                            {isUploaded && (
                              <div className="space-y-3 pt-2 border-t border-gray-200/50">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setVerifyType(prev => ({ ...prev, [cert.requirementId]: 'Verified' }));
                                      setVerifyError(prev => ({ ...prev, [cert.requirementId]: null }));
                                    }}
                                    className={`flex-1 py-1.5 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                                      verifyType[cert.requirementId] === 'Verified'
                                        ? 'bg-green-600 border-green-600 text-white'
                                        : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                                    }`}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => {
                                      setVerifyType(prev => ({ ...prev, [cert.requirementId]: 'Rejected' }));
                                      setVerifyError(prev => ({ ...prev, [cert.requirementId]: null }));
                                    }}
                                    className={`flex-1 py-1.5 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                                      verifyType[cert.requirementId] === 'Rejected'
                                        ? 'bg-red-600 border-red-600 text-white'
                                        : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                                    }`}
                                  >
                                    Reject
                                  </button>
                                </div>

                                {verifyType[cert.requirementId] && (
                                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <Label htmlFor={`vcomments-${cert.requirementId}`}>
                                      Review comments {verifyType[cert.requirementId] === 'Rejected' && <span className="text-red-500 font-bold">*</span>}
                                    </Label>
                                    <Input
                                      id={`vcomments-${cert.requirementId}`}
                                      placeholder={
                                        verifyType[cert.requirementId] === 'Rejected'
                                          ? 'Explain why this certificate is being rejected...'
                                          : 'Verification notes (optional)...'
                                      }
                                      value={verifyComments[cert.requirementId] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setVerifyComments(prev => ({ ...prev, [cert.requirementId]: val }));
                                      }}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                )}

                                {verifyError[cert.requirementId] && (
                                  <p className="text-[10px] text-destructive font-bold">
                                    {verifyError[cert.requirementId]}
                                  </p>
                                )}

                                {verifyType[cert.requirementId] && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleVerifySubmit(cert.requirementId)}
                                    disabled={verifyCertMutation.isPending}
                                    className="w-full text-xs h-8"
                                  >
                                    {verifyCertMutation.isPending ? 'Logging...' : 'Confirm Verification'}
                                  </Button>
                                )}
                              </div>
                            )}

                            {isRejected && cert.rejectionReason && (
                              <div className="bg-red-50 border border-red-200 text-red-800 text-[10px] p-2 rounded">
                                <p className="font-bold">Rejection comments:</p>
                                <p>{cert.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Progress timeline */}
                <div className="space-y-4 pt-3 border-t border-gray-200">
                  <h5 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Workflow Approvals Timeline</h5>
                  {[
                    { role: 'Event Coordinator', label: 'Event Coordinator Consent' },
                    { role: 'Mentor', label: 'Mentor Alignment Approval' },
                    { role: 'Program Coordinator', label: 'Program Coordinator Review' },
                    { role: 'Head of Department', label: 'HOD Final Sign-off' },
                  ].map((step, idx) => {
                    const stepStatus = getStepStatus(step.role, appDetails.status, appDetails.history);

                    return (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                              stepStatus === 'completed'
                                ? 'bg-green-100 border-green-500 text-green-700'
                                : stepStatus === 'rejected'
                                ? 'bg-red-100 border-red-500 text-red-700'
                                : stepStatus === 'active'
                                ? 'bg-amber-100 border-amber-500 text-amber-700 animate-pulse'
                                : 'bg-gray-100 border-gray-300 text-gray-400'
                            }`}
                          >
                            {stepStatus === 'completed' ? '✓' : stepStatus === 'rejected' ? '✗' : idx + 1}
                          </div>
                          {idx < 3 && <div className="w-0.5 h-8 bg-gray-200" />}
                        </div>

                        <div className="space-y-1 py-0.5">
                          <p className="text-xs font-bold text-gray-900">{step.label}</p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            {stepStatus === 'completed'
                              ? 'Approved & Logged'
                              : stepStatus === 'rejected'
                              ? 'Rejected by Reviewer'
                              : stepStatus === 'active'
                              ? 'Awaiting Review'
                              : 'Pending previous review'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* History list */}
                {appDetails.history.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <h5 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Review Comments History</h5>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {appDetails.history.map((hist, hidx) => (
                        <div key={hidx} className="text-xs bg-gray-50 p-2.5 border border-gray-150 rounded-lg">
                          <div className="flex justify-between font-semibold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                            <span>{hist.approverRole}</span>
                            <span className={hist.decision === 'Approve' ? 'text-green-700' : 'text-red-700'}>
                              {hist.decision}d
                            </span>
                          </div>
                          <p className="text-gray-900 leading-normal">{hist.comments || 'No comment provided.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <DialogClose asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
                RETRIEVING STEP PROGRESS...
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ========================================================
            5. COHORT STUDENT ONBOARDING DIALOG
           ======================================================== */}
        <Dialog open={createStudentOpen} onOpenChange={(open) => !open && setCreateStudentOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Onboard New Student Account</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleStudentOnboardSubmit} className="space-y-4 pt-2">
              {createStudentSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-lg text-center font-semibold animate-in fade-in duration-150">
                  {createStudentSuccess}
                </div>
              )}

              {createStudentError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium animate-in fade-in duration-150">
                  {createStudentError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sUserId">Register Number</Label>
                <Input
                  id="sUserId"
                  placeholder="e.g. 727624BAD001"
                  required
                  value={studentFormValues.userId}
                  onChange={(e) => setStudentFormValues(prev => ({ ...prev, userId: e.target.value }))}
                  disabled={onboardStudentMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sFullName">Student Full Name</Label>
                <Input
                  id="sFullName"
                  placeholder="e.g. NEERAJ K"
                  required
                  value={studentFormValues.fullName}
                  onChange={(e) => setStudentFormValues(prev => ({ ...prev, fullName: e.target.value }))}
                  disabled={onboardStudentMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sUsername">Login Username</Label>
                <Input
                  id="sUsername"
                  placeholder="e.g. neeraj_k"
                  required
                  value={studentFormValues.username}
                  onChange={(e) => setStudentFormValues(prev => ({ ...prev, username: e.target.value }))}
                  disabled={onboardStudentMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sDob">Date of Birth</Label>
                <Input
                  id="sDob"
                  type="date"
                  required
                  value={studentFormValues.dateOfBirth}
                  onChange={(e) => setStudentFormValues(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  disabled={onboardStudentMutation.isPending}
                />
                <span className="text-[10px] text-gray-400 font-medium block">
                  Note: The student's default password will be automatically formatted as DDMMYYYY from this birth date.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sYear">Admission Year</Label>
                  <Input
                    id="sYear"
                    type="number"
                    required
                    value={studentFormValues.admissionYear}
                    onChange={(e) => setStudentFormValues(prev => ({ ...prev, admissionYear: parseInt(e.target.value) || 2024 }))}
                    disabled={onboardStudentMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sSection">Class Section</Label>
                  <Select
                    id="sSection"
                    value={studentFormValues.section}
                    onChange={(e) => setStudentFormValues(prev => ({ ...prev, section: e.target.value }))}
                    disabled={onboardStudentMutation.isPending}
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs h-9"
                  onClick={() => setCreateStudentOpen(false)}
                  disabled={onboardStudentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 text-xs h-9"
                  disabled={onboardStudentMutation.isPending}
                >
                  {onboardStudentMutation.isPending ? 'Creating Account...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================
            6. ADMINISTRATOR: FACULTY ONBOARDING DIALOG (Module 9 - Task 9.1)
           ======================================================== */}
        <Dialog open={createFacultyOpen} onOpenChange={(open) => !open && setCreateFacultyOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Provision Faculty Account</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFacultyOnboardSubmit} className="space-y-4 pt-2">
              {createFacultySuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-lg text-center font-semibold animate-in fade-in duration-150">
                  {createFacultySuccess}
                </div>
              )}

              {createFacultyError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium animate-in fade-in duration-150">
                  {createFacultyError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fUserId">Faculty ID</Label>
                <Input
                  id="fUserId"
                  placeholder="e.g. FAC009"
                  required
                  value={facultyFormValues.userId}
                  onChange={(e) => setFacultyFormValues(prev => ({ ...prev, userId: e.target.value }))}
                  disabled={onboardFacultyMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fFullName">Full Name</Label>
                <Input
                  id="fFullName"
                  placeholder="e.g. Dr. ARUN PRASAD"
                  required
                  value={facultyFormValues.fullName}
                  onChange={(e) => setFacultyFormValues(prev => ({ ...prev, fullName: e.target.value }))}
                  disabled={onboardFacultyMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fUsername">Login Username</Label>
                <Input
                  id="fUsername"
                  placeholder="e.g. arun_p"
                  required
                  value={facultyFormValues.username}
                  onChange={(e) => setFacultyFormValues(prev => ({ ...prev, username: e.target.value }))}
                  disabled={onboardFacultyMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fPassword">Account Password</Label>
                <Input
                  id="fPassword"
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={facultyFormValues.password}
                  onChange={(e) => setFacultyFormValues(prev => ({ ...prev, password: e.target.value }))}
                  disabled={onboardFacultyMutation.isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fDesignation">Designation</Label>
                  <Input
                    id="fDesignation"
                    placeholder="e.g. Assistant Professor"
                    required
                    value={facultyFormValues.designation}
                    onChange={(e) => setFacultyFormValues(prev => ({ ...prev, designation: e.target.value }))}
                    disabled={onboardFacultyMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fRole">System Role</Label>
                  <Select
                    id="fRole"
                    value={facultyFormValues.role}
                    onChange={(e) => setFacultyFormValues(prev => ({ ...prev, role: e.target.value }))}
                    disabled={onboardFacultyMutation.isPending}
                  >
                    <option value="Mentor">Mentor</option>
                    <option value="Event Coordinator">Event Coordinator</option>
                    <option value="Program Coordinator">Program Coordinator</option>
                    <option value="Head of Department">Head of Department</option>
                    <option value="Administrator">Administrator</option>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs h-9"
                  onClick={() => setCreateFacultyOpen(false)}
                  disabled={onboardFacultyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 text-xs h-9"
                  disabled={onboardFacultyMutation.isPending}
                >
                  {onboardFacultyMutation.isPending ? 'Provisioning...' : 'Provision Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================
            7. STUDENT REQUEST EXTENSION DIALOG
           ======================================================== */}
        <Dialog open={requestExtensionOpen} onOpenChange={(open) => !open && setRequestExtensionOpen(false)}>
          <DialogContent className="max-w-sm bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Request Deadline Extension</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleExtensionRequestSubmit} className="space-y-4 pt-2">
              {extensionFormSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-lg text-center font-semibold">
                  {extensionFormSuccess}
                </div>
              )}

              {extensionFormError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                  {extensionFormError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reqDays">Days Requested (Max 7 days)</Label>
                <Select
                  id="reqDays"
                  value={requestedDays}
                  onChange={(e) => setRequestedDays(parseInt(e.target.value) || 7)}
                >
                  <option value="1">1 Day</option>
                  <option value="2">2 Days</option>
                  <option value="3">3 Days</option>
                  <option value="4">4 Days</option>
                  <option value="5">5 Days</option>
                  <option value="6">6 Days</option>
                  <option value="7">7 Days (Standard)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reqReason">Extension Reason (Min 10 chars)</Label>
                <textarea
                  id="reqReason"
                  rows={3}
                  required
                  placeholder="Explain why you need more time to upload the certificate..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs h-9"
                  onClick={() => setRequestExtensionOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 text-xs h-9">
                  Submit Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================
            8. MENTOR GRANT EXTENSION DIALOG
           ======================================================== */}
        <Dialog open={grantExtensionOpen} onOpenChange={(open) => !open && setGrantExtensionOpen(false)}>
          <DialogContent className="max-w-sm bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Grant Deadline Extension</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleGrantExtensionSubmit} className="space-y-4 pt-2">
              {grantError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                  {grantError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newDl">New Deadline Date</Label>
                <Input
                  id="newDl"
                  type="date"
                  required
                  value={grantNewDeadline}
                  onChange={(e) => setGrantNewDeadline(e.target.value)}
                  disabled={grantExtensionMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newReason">Extension Reason (Min 10 chars)</Label>
                <textarea
                  id="newReason"
                  rows={3}
                  required
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  disabled={grantExtensionMutation.isPending}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs h-9"
                  onClick={() => setGrantExtensionOpen(false)}
                  disabled={grantExtensionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 text-xs h-9"
                  disabled={grantExtensionMutation.isPending}
                >
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
