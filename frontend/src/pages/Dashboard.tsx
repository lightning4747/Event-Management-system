import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Table, TableHeader } from '../components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Plus, ChevronRight } from 'lucide-react';

interface ApplicationRow {
  applicationId: string;
  title: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: string;
  finalApprovedAt: string | null;
  withdrawnAt: string | null;
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
  }>;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedAppId, setSelectedAppId] = React.useState<string | null>(null);

  // 1. Fetch dashboard counts
  const { data: metrics } = useQuery({
    queryKey: ['studentMetrics'],
    queryFn: async () => {
      const res = await apiFetch('/dashboards/student');
      return res.json();
    },
    enabled: user?.role === 'Student',
  });

  // 2. Fetch student applications
  const { data: myApps = [], isLoading: appsLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['myApplications'],
    queryFn: async () => {
      const res = await apiFetch('/applications/my');
      return res.json();
    },
    enabled: user?.role === 'Student',
  });

  // 3. Fetch specific application details (for modal timeline)
  const { data: appDetails } = useQuery<ApplicationDetails>({
    queryKey: ['applicationDetails', selectedAppId],
    queryFn: async () => {
      const res = await apiFetch(`/applications/${selectedAppId}`);
      return res.json();
    },
    enabled: !!selectedAppId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
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

  const headers: TableHeader[] = [
    { label: 'Title', key: 'title' },
    { label: 'Dates', key: 'fromDate' },
    { label: 'Events', key: 'numberOfEvents' },
    { label: 'Status', key: 'status' },
    { label: 'Action', key: 'action' },
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header Block */}
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded text-gray-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total OD</p>
              <h3 className="text-base font-bold text-gray-900">{metrics?.total ?? 0}</h3>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pending</p>
              <h3 className="text-base font-bold text-gray-900">{metrics?.pending ?? 0}</h3>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded text-green-600">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Approved</p>
              <h3 className="text-base font-bold text-gray-900">{metrics?.approved ?? 0}</h3>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded text-red-600">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Rejected</p>
              <h3 className="text-base font-bold text-gray-900">{metrics?.rejected ?? 0}</h3>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-3 sm:p-4 rounded-lg flex items-center gap-3 col-span-2 md:col-span-1">
            <div className="p-2 bg-blue-50 rounded text-blue-600">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Upload Req.</p>
              <h3 className="text-base font-bold text-gray-900">{metrics?.certificatesActionRequired ?? 0}</h3>
            </div>
          </div>
        </div>

        {/* Requests List Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Your OD Applications</h3>

          {appsLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-medium">
              RETRIEVING REQUESTS...
            </div>
          ) : myApps.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500 font-medium">
              No On-Duty requests submitted yet. Click "New Request" to get started.
            </div>
          ) : (
            <>
              {/* Mobile Card Feed (shown on small screens) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {myApps.map((app) => (
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

              {/* Desktop Table View (shown on medium+ screens) */}
              <div className="hidden md:block">
                <Table
                  headers={headers}
                  data={myApps}
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

        {/* Real-time Status Timeline Dialog */}
        <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
          <DialogContent className="max-w-md bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Application Progress</DialogTitle>
            </DialogHeader>

            {appDetails ? (
              <div className="space-y-6 pt-2">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-900">{appDetails.title}</h4>
                  <p className="text-[11px] text-gray-500 font-medium">{appDetails.location} • {appDetails.fromDate} to {appDetails.toDate}</p>
                </div>

                {/* Vertical Step-by-Step Status Timeline */}
                <div className="space-y-4">
                  {[
                    { role: 'Event Coordinator', label: 'Event Coordinator Consent' },
                    { role: 'Mentor', label: 'Mentor Alignment Approval' },
                    { role: 'Program Coordinator', label: 'Program Coordinator Review' },
                    { role: 'Head of Department', label: 'HOD Final Sign-off' },
                  ].map((step, idx) => {
                    const stepStatus = getStepStatus(step.role, appDetails.status, appDetails.history);

                    return (
                      <div key={idx} className="flex gap-3">
                        {/* Bullet indicators */}
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

                        {/* Step Details */}
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

                {/* Audit Comments history */}
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
      </div>
    </DashboardShell>
  );
};
