import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DashboardShell } from '../components/DashboardShell';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import {
  Search, Users, GraduationCap, FileText, CheckCircle,
  Clock, ArrowLeft, ExternalLink, AlertCircle, Edit2, CheckCircle2
} from 'lucide-react';

import { EventTagBadge } from '../components/EventTagBadge';

interface StudentRow {
  userId: string;
  fullName: string;
  admissionYear: number;
  section: string;
}

interface ApplicationRow {
  applicationId: string;
  studentId: string;
  title: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: string;
  eventTag?: string;
  createdAt: string;
}

interface CertificateRow {
  requirementId: string;
  applicationId: string;
  sequenceNumber: number;
  status: string;
  submissionDeadline: string;
  rejectionReason: string | null;
  fileUrl: string | null;
  uploadedAt: string | null;
}

interface StudentDetails {
  student: {
    userId: string;
    fullName: string;
    dateOfBirth: string;
    admissionYear: number;
    section: string;
    mentorId: string;
  };
  applications: ApplicationRow[];
  certificates: CertificateRow[];
}

const getAcademicYearName = (admissionYear: number): string => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const academicStartYear = currentMonth >= 5 ? currentYear : currentYear - 1;
  const diff = academicStartYear - admissionYear;
  
  if (diff === 3) return 'Fourth Year';
  if (diff === 2) return 'Third Year';
  if (diff === 1) return 'Second Year';
  if (diff === 0) return 'First Year';
  return `${diff + 1}th Year`;
};

const getStatusColor = (status: string) => {
  if (status === 'Approved' || status === 'Completed' || status === 'Verified') {
    return 'bg-primary/10 text-primary border-primary/20';
  }
  if (status === 'Rejected' || status === 'Withdrawn') {
    return 'bg-destructive/10 text-destructive border-destructive/20';
  }
  if (status === 'Submitted' || status.startsWith('In Progress')) {
    return 'bg-primary/10 text-primary border-primary/20';
  }
  return 'bg-muted text-muted-foreground border-border';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const StudentsDirectory: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMentor = user?.role === 'Mentor';

  // Directory Filters (for non-mentors)
  const [selectedYear, setSelectedYear] = React.useState<number | null>(isMentor ? null : 2);
  const [selectedSection, setSelectedSection] = React.useState<string | null>(isMentor ? null : 'A');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState<string>('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  
  // Selected Student
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  
  // Tabs for student detailed profile
  const [detailsTab, setDetailsTab] = React.useState<'applications' | 'pending' | 'certificates'>('applications');

  // Edit Student State & Form
  const [editStudentOpen, setEditStudentOpen] = React.useState(false);
  const [editFormValues, setEditFormValues] = React.useState({
    fullName: '',
    dateOfBirth: '',
    section: 'A',
  });
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = React.useState<string | null>(null);

  // ── Queries ──
  // 1. Fetch Mentees list if user is a Mentor
  const { data: mentorMenteesList = [], isLoading: mentorMenteesLoading } = useQuery<StudentRow[]>({
    queryKey: ['mentorMenteesDirectoryList'],
    queryFn: async () => {
      const res = await apiFetch('/mentor/mentees');
      return res.json();
    },
    enabled: isMentor,
  });

  // 2. Fetch Department-wide students list if user is NOT a Mentor
  const { data: deptStudentsList = [], isLoading: deptStudentsLoading } = useQuery<StudentRow[]>({
    queryKey: ['studentsDirectoryList', selectedYear, selectedSection],
    queryFn: async () => {
      const res = await apiFetch(`/students?year=${selectedYear}&section=${selectedSection}`);
      return res.json();
    },
    enabled: !isMentor && selectedYear !== null && selectedSection !== null,
  });

  const studentsList = isMentor ? mentorMenteesList : deptStudentsList;
  const listLoading = isMentor ? mentorMenteesLoading : deptStudentsLoading;

  const { data: studentDetails, isLoading: detailsLoading } = useQuery<StudentDetails>({
    queryKey: ['studentDetailsRecord', selectedStudentId],
    queryFn: async () => {
      const res = await apiFetch(`/students/${selectedStudentId}/details`);
      return res.json();
    },
    enabled: !!selectedStudentId,
  });

  // ── Edit Mutation ──
  const updateStudentMutation = useMutation({
    mutationFn: async (payload: { fullName?: string; dateOfBirth?: string; section?: string }) => {
      if (!selectedStudentId) return;
      const res = await apiFetch(`/mentor/students/${selectedStudentId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      setUpdateSuccess('Student details updated successfully.');
      setUpdateError(null);
      queryClient.invalidateQueries({ queryKey: ['studentDetailsRecord', selectedStudentId] });
      queryClient.invalidateQueries({ queryKey: ['mentorMenteesDirectoryList'] });
      queryClient.invalidateQueries({ queryKey: ['studentsDirectoryList', selectedYear, selectedSection] });
      setTimeout(() => {
        setEditStudentOpen(false);
        setUpdateSuccess(null);
      }, 1200);
    },
    onError: (err: Error) => {
      setUpdateError(err.message || 'Failed to update student details.');
      setUpdateSuccess(null);
    },
  });

  // ── Handlers ──
  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    setDetailsTab('applications');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(null);
    updateStudentMutation.mutate(editFormValues);
  };

  // Filter and sort students based on search query
  const filteredStudents = React.useMemo(() => {
    const filtered = studentsList.filter((std) => {
      if (debouncedSearchQuery.trim() !== '') {
        const query = debouncedSearchQuery.toLowerCase();
        return (
          std.fullName.toLowerCase().includes(query) ||
          std.userId.toLowerCase().includes(query)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => a.userId.localeCompare(b.userId));
  }, [studentsList, debouncedSearchQuery]);

  // Derived counts for selected student
  const approvedApps = studentDetails?.applications.filter(a => a.status === 'Approved') || [];
  const pendingApps = studentDetails?.applications.filter(a => a.status.startsWith('In Progress:')) || [];
  const verifiedCerts = studentDetails?.certificates.filter(c => c.status === 'Verified') || [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isMentor ? 'My Mentees Directory' : 'Student Directory'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isMentor ? 'Overview of your assigned mentee cohort and event records' : 'Hierarchical directory of students and event participation records'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Pane: Directory Filters & List (Lg Col: 5 or 12) ── */}
          <div className={`${selectedStudentId ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-4`}>
            
            {/* Show Academic Year & Section filters ONLY for non-mentors */}
            {!isMentor && (
              <>
                <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex">
                  {[
                    { label: 'Second Year', value: 2 },
                    { label: 'Third Year', value: 3 },
                    { label: 'Fourth Year', value: 4 }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => {
                        setSelectedYear(item.value);
                        setSelectedSection('A');
                        setSelectedStudentId(null);
                      }}
                      className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all border border-transparent ${
                        selectedYear === item.value
                          ? 'bg-primary/10 text-primary shadow-sm border-primary/20'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Section</p>
                    <div className="flex gap-1.5">
                      {['A', 'B'].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => {
                            setSelectedSection(sec);
                            setSelectedStudentId(null);
                          }}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all border ${
                            selectedSection === sec
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Section {sec}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or register number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mentor Search Bar */}
            {isMentor && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search mentees by name or register number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Students / Mentees List */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" /> {isMentor ? 'My Mentees Cohort' : 'Students List'}
                </h3>
                <span className="text-[11px] text-gray-400 font-bold bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5">
                  {filteredStudents.length} {isMentor ? 'Mentees' : 'Students'}
                </span>
              </div>

              {listLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">
                    {isMentor ? 'No mentees assigned to your cohort yet.' : 'No students match selection filters.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[50vh] lg:max-h-[65vh] overflow-y-auto">
                  {filteredStudents.map((std) => (
                    <div
                      key={std.userId}
                      onClick={() => handleStudentSelect(std.userId)}
                      className={`px-5 py-3.5 flex items-center gap-3.5 cursor-pointer transition-all ${
                        selectedStudentId === std.userId
                          ? 'bg-primary/5 hover:bg-primary/5'
                          : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center shrink-0">
                        {std.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{std.fullName}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{std.userId}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-full shrink-0">
                        Sec {std.section}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Pane: Selected Student Detailed Profile ── */}
          {selectedStudentId && (
            <div className="lg:col-span-7 space-y-5 animate-in fade-in duration-200">
              {detailsLoading ? (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-24 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-500 font-medium">Retrieving student records...</p>
                </div>
              ) : !studentDetails ? (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center text-red-500 font-medium">
                  Failed to load records for this student.
                </div>
              ) : (
                <>
                  {/* Profile Header Details Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-lg font-bold shadow-md shadow-sm">
                          {studentDetails.student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900 leading-snug">{studentDetails.student.fullName}</h2>
                          <p className="text-xs font-mono font-medium text-gray-400 mt-0.5">Register: {studentDetails.student.userId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMentor && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
                            onClick={() => {
                              setEditFormValues({
                                fullName: studentDetails.student.fullName,
                                dateOfBirth: studentDetails.student.dateOfBirth || '',
                                section: studentDetails.student.section || 'A',
                              });
                              setUpdateError(null);
                              setUpdateSuccess(null);
                              setEditStudentOpen(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Update Details
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[10px]"
                          onClick={() => setSelectedStudentId(null)}
                        >
                          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Close
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Academic Year</p>
                        <p className="text-xs font-bold text-gray-800">{getAcademicYearName(studentDetails.student.admissionYear)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Class Section</p>
                        <p className="text-xs font-bold text-gray-800">Section {studentDetails.student.section}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Date of Birth</p>
                        <p className="text-xs font-bold text-gray-800">{formatDate(studentDetails.student.dateOfBirth)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved OD</p>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{approvedApps.length}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <Clock className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending OD</p>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{pendingApps.length}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Verified Certs</p>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{verifiedCerts.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* History Tabs Navigation */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="border-b border-gray-100 flex p-1">
                      {[
                        { id: 'applications', label: 'All OD Applications', icon: FileText },
                        { id: 'pending', label: 'Pending Reviews', icon: Clock },
                        { id: 'certificates', label: 'Certificates Registry', icon: GraduationCap }
                      ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setDetailsTab(tab.id as any)}
                            className={`flex-1 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                              detailsTab === tab.id
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-5 max-h-[40vh] overflow-y-auto">
                      {/* ── Subtab: All OD History ── */}
                      {detailsTab === 'applications' && (
                        studentDetails.applications.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">No OD applications submitted yet.</div>
                        ) : (
                          <div className="space-y-3.5">
                            {studentDetails.applications.map((app) => (
                              <div key={app.applicationId} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-gray-900 leading-tight">{app.title}</h4>
                                  <p className="text-[10px] text-gray-500 font-medium">
                                    {formatDate(app.fromDate)} → {formatDate(app.toDate)} · {app.numberOfEvents} {app.numberOfEvents === 1 ? 'day' : 'days'}
                                  </p>
                                  <p className="text-[10px] text-gray-400">{app.location}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${getStatusColor(app.status)}`}>
                                    {app.status}
                                  </span>
                                  {app.eventTag && <EventTagBadge tag={app.eventTag} />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* ── Subtab: Pending Reviews ── */}
                      {detailsTab === 'pending' && (
                        pendingApps.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">No pending applications awaiting decision.</div>
                        ) : (
                          <div className="space-y-3.5">
                            {pendingApps.map((app) => (
                              <div key={app.applicationId} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-gray-900 leading-tight">{app.title}</h4>
                                  <p className="text-[10px] text-gray-500 font-medium">
                                    {formatDate(app.fromDate)} → {formatDate(app.toDate)} · {app.numberOfEvents} {app.numberOfEvents === 1 ? 'day' : 'days'}
                                  </p>
                                </div>
                                <span className="text-[9px] font-bold px-2.5 py-1 bg-muted border border-border text-muted-foreground rounded-full">
                                  {app.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* ── Subtab: Certificate Uploads ── */}
                      {detailsTab === 'certificates' && (
                        studentDetails.certificates.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">No event certificate requirements recorded.</div>
                        ) : (
                          <div className="space-y-3.5">
                            {studentDetails.certificates.map((cert) => (
                              <div key={cert.requirementId} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-900">Certificate Requirement #{cert.sequenceNumber}</h4>
                                    <p className="text-[10px] text-gray-500 font-medium">Deadline: {formatDate(cert.submissionDeadline)}</p>
                                  </div>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${getStatusColor(cert.status)}`}>
                                    {cert.status}
                                  </span>
                                </div>
                                
                                {cert.fileUrl && (
                                  <a
                                    href={cert.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 hover:underline pt-1"
                                  >
                                    <ExternalLink className="w-3 h-3" /> View OneDrive Certificate
                                  </a>
                                )}

                                {cert.status === 'Rejected' && cert.rejectionReason && (
                                  <div className="flex items-start gap-1.5 text-[10px] text-red-700 bg-red-50/50 border border-red-100 rounded px-2.5 py-1.5 mt-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
                                    <span>Reason: {cert.rejectionReason}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Student Modal Dialog ── */}
      <Dialog open={editStudentOpen} onOpenChange={setEditStudentOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Update Student Details ({selectedStudentId})
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {updateSuccess && (
              <div className="flex items-center gap-2 bg-muted border border-border text-foreground text-sm p-3 rounded-xl font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                {updateSuccess}
              </div>
            )}
            {updateError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                {updateError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  Full Name
                </Label>
                <span title="Editable field"><Edit2 className="w-3.5 h-3.5 text-primary shrink-0" /></span>
              </div>
              <Input
                required
                value={editFormValues.fullName}
                onChange={(e) => setEditFormValues((prev) => ({ ...prev, fullName: e.target.value }))}
                disabled={updateStudentMutation.isPending}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  Date of Birth
                </Label>
                <span title="Editable field"><Edit2 className="w-3.5 h-3.5 text-primary shrink-0" /></span>
              </div>
              <Input
                type="date"
                required
                value={editFormValues.dateOfBirth}
                onChange={(e) => setEditFormValues((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                disabled={updateStudentMutation.isPending}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  Section
                </Label>
                <span title="Editable field"><Edit2 className="w-3.5 h-3.5 text-primary shrink-0" /></span>
              </div>
              <Select
                value={editFormValues.section}
                onChange={(e) => setEditFormValues((prev) => ({ ...prev, section: e.target.value }))}
                disabled={updateStudentMutation.isPending}
                className="h-10"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setEditStudentOpen(false)}
                disabled={updateStudentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={updateStudentMutation.isPending}
              >
                {updateStudentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};
export default StudentsDirectory;
