import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  Search, Users, GraduationCap, FileText, CheckCircle,
  Clock, ArrowLeft, ExternalLink, AlertCircle
} from 'lucide-react';

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

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const StudentsDirectory: React.FC = () => {
  // Directory Filters
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
  const [selectedSection, setSelectedSection] = React.useState<string | null>(null);
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

  // ── Queries ──
  const { data: studentsList = [], isLoading: listLoading } = useQuery<StudentRow[]>({
    queryKey: ['studentsDirectoryList', selectedYear, selectedSection],
    queryFn: async () => {
      const res = await apiFetch(`/students?year=${selectedYear}&section=${selectedSection}`);
      return res.json();
    },
    enabled: selectedYear !== null && selectedSection !== null,
  });

  const { data: studentDetails, isLoading: detailsLoading } = useQuery<StudentDetails>({
    queryKey: ['studentDetailsRecord', selectedStudentId],
    queryFn: async () => {
      const res = await apiFetch(`/students/${selectedStudentId}/details`);
      return res.json();
    },
    enabled: !!selectedStudentId,
  });

  // ── Handlers ──
  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    setDetailsTab('applications');
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

    // Sort based on roll number (userId)
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
          <h1 className="text-2xl font-bold text-gray-900">Student Directory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Hierarchical directory of students and event participation records</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left Pane: Directory Filters & List (Lg Col: 5 or 12) ── */}
          <div className={`${selectedStudentId ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-4`}>
            {/* Academic Year Tabs */}
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
                    setSelectedSection('A'); // Automatically default to Section A
                    setSelectedStudentId(null);
                  }}
                  className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all border border-transparent ${
                    selectedYear === item.value
                      ? 'bg-blue-50 text-blue-700 shadow-sm border-blue-200/50'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {selectedYear === null ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center border-dashed">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-900">Select Academic Year</p>
                <p className="text-xs text-gray-500 mt-1">Choose a B.E./B.Tech year above to browse student records.</p>
              </div>
            ) : (
              <>
                {/* Section Toggles & Search Bar */}
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
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
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

                {/* Students List */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" /> Students List
                    </h3>
                    <span className="text-[11px] text-gray-400 font-bold bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5">
                      {filteredStudents.length} Students
                    </span>
                  </div>

                  {listLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No students match selection filters.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[50vh] lg:max-h-[65vh] overflow-y-auto">
                      {filteredStudents.map((std) => (
                        <div
                          key={std.userId}
                          onClick={() => handleStudentSelect(std.userId)}
                          className={`px-5 py-3.5 flex items-center gap-3.5 cursor-pointer transition-all ${
                            selectedStudentId === std.userId
                              ? 'bg-blue-50/50 hover:bg-blue-50'
                              : 'hover:bg-gray-50/60'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
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
              </>
            )}
          </div>

          {/* ── Right Pane: Selected Student Detailed Profile ── */}
          {selectedStudentId && (
            <div className="lg:col-span-7 space-y-5 animate-in fade-in duration-200">
              {detailsLoading ? (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-24 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                        <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-md shadow-blue-100">
                          {studentDetails.student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900 leading-snug">{studentDetails.student.fullName}</h2>
                          <p className="text-xs font-mono font-medium text-gray-400 mt-0.5">Register: {studentDetails.student.userId}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-[10px]"
                        onClick={() => setSelectedStudentId(null)}
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Close Details
                      </Button>
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
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cohort Mentor</p>
                        <p className="text-xs font-bold text-gray-800">{studentDetails.student.mentorId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved OD</p>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{approvedApps.length}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Clock className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending OD</p>
                        <p className="text-lg font-bold text-gray-900 leading-tight">{pendingApps.length}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
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
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
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
                                <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${getStatusColor(app.status)}`}>
                                  {app.status}
                                </span>
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
                                <span className="text-[9px] font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full">
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
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline pt-1"
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
    </DashboardShell>
  );
};
export default StudentsDirectory;
