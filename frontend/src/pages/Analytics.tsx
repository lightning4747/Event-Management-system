import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import {
  BarChart3,
  RotateCcw,
  Filter,
} from 'lucide-react';

const extracurricularTypes = ['Sports', 'NCC', 'NSS', 'Dance'];
const cocurricularTypes = ['Hackathon', 'Seminar', 'Workshop', 'Symposium', 'Conference'];

const currentYear = new Date().getFullYear();

interface AnalyticsData {
  summary: {
    totalApplications: number;
    approved: number;
    pending: number;
    rejected: number;
    certificatesUploaded: number;
    certificatesVerified: number;
  };
  monthlyTrend: Array<{
    month: string;
    totalCount: number;
    approvedCount: number;
  }>;
  byStudentYear: Array<{
    yearLabel: string;
    admissionYear: number;
    count: number;
  }>;
  bySectionGrouped: Array<{
    yearLabel: string;
    admissionYear: number;
    sections: Array<{ section: string; count: number }>;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  activityTypeDistribution: Array<{
    activityType: string;
    count: number;
  }>;
  certificateStatusDistribution: Array<{
    status: string;
    count: number;
  }>;
}

export const Analytics: React.FC = () => {
  // Draft Filter Controls State
  const [draftFromDate, setDraftFromDate] = React.useState('');
  const [draftToDate, setDraftToDate] = React.useState('');
  const [draftSelectedYear, setDraftSelectedYear] = React.useState('');
  const [draftSection, setDraftSection] = React.useState('');
  const [draftActivityCategory, setDraftActivityCategory] = React.useState('');
  const [draftActivityType, setDraftActivityType] = React.useState('');

  // Active Applied Query Filters State
  const [appliedFilters, setAppliedFilters] = React.useState({
    fromDate: '',
    toDate: '',
    selectedYear: '',
    section: '',
    activityCategory: '',
    activityType: '',
  });

  // Handle category change -> reset activity type if incompatible
  const handleCategoryChange = (val: string) => {
    setDraftActivityCategory(val);
    if (val === 'Extracurricular' && !extracurricularTypes.includes(draftActivityType)) {
      setDraftActivityType('');
    } else if (val === 'Co-curricular' && !cocurricularTypes.includes(draftActivityType)) {
      setDraftActivityType('');
    }
  };

  // Handle activity type change -> auto update category
  const handleActivityTypeChange = (val: string) => {
    setDraftActivityType(val);
    if (val) {
      if (extracurricularTypes.includes(val)) {
        setDraftActivityCategory('Extracurricular');
      } else if (cocurricularTypes.includes(val)) {
        setDraftActivityCategory('Co-curricular');
      }
    }
  };

  // Handle year change -> reset section
  const handleYearChange = (val: string) => {
    setDraftSelectedYear(val);
    setDraftSection('');
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      fromDate: draftFromDate,
      toDate: draftToDate,
      selectedYear: draftSelectedYear,
      section: draftSection,
      activityCategory: draftActivityCategory,
      activityType: draftActivityType,
    });
  };

  const handleResetFilters = () => {
    setDraftFromDate('');
    setDraftToDate('');
    setDraftSelectedYear('');
    setDraftSection('');
    setDraftActivityCategory('');
    setDraftActivityType('');

    setAppliedFilters({
      fromDate: '',
      toDate: '',
      selectedYear: '',
      section: '',
      activityCategory: '',
      activityType: '',
    });
  };

  // Fetch Analytics Data
  const { data, isLoading, isError, error } = useQuery<AnalyticsData>({
    queryKey: [
      'analyticsData',
      appliedFilters.fromDate,
      appliedFilters.toDate,
      appliedFilters.selectedYear,
      appliedFilters.section,
      appliedFilters.activityCategory,
      appliedFilters.activityType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedFilters.fromDate) params.append('fromDate', appliedFilters.fromDate);
      if (appliedFilters.toDate) params.append('toDate', appliedFilters.toDate);
      if (appliedFilters.selectedYear) params.append('admissionYear', appliedFilters.selectedYear);
      if (appliedFilters.section) params.append('section', appliedFilters.section);
      if (appliedFilters.activityCategory) params.append('activityCategory', appliedFilters.activityCategory);
      if (appliedFilters.activityType) params.append('activityType', appliedFilters.activityType);

      const res = await apiFetch(`/analytics?${params.toString()}`);
      return res.json();
    },
  });

  const summary = data?.summary || {
    totalApplications: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    certificatesUploaded: 0,
    certificatesVerified: 0,
  };

  const totalApps = summary.totalApplications;
  const approvedRate = totalApps ? Math.round((summary.approved / totalApps) * 100) : 0;
  const rejectedRate = totalApps ? ((summary.rejected / totalApps) * 100).toFixed(1) : '0.0';

  const sectionOptions = ['A', 'B', 'C'];

  const activityTypeOptions =
    draftActivityCategory === 'Extracurricular'
      ? extracurricularTypes
      : draftActivityCategory === 'Co-curricular'
      ? cocurricularTypes
      : [...cocurricularTypes, ...extracurricularTypes];

  return (
    <DashboardShell>
      <div className="space-y-8 pb-16 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              High-level departmental On-Duty activity metrics, participation trends, and institutional insights
            </p>
          </div>
        </div>

        {/* Compact Metabase-Style Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Filters
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleApplyFilters}
                className="h-8 px-3.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Apply Filters
              </Button>

              <Button
                onClick={handleResetFilters}
                variant="outline"
                className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {/* From Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                From Date
              </label>
              <Input
                type="date"
                value={draftFromDate}
                onChange={(e) => setDraftFromDate(e.target.value)}
                className="h-8 text-xs border-slate-200 px-2"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                To Date
              </label>
              <Input
                type="date"
                value={draftToDate}
                onChange={(e) => setDraftToDate(e.target.value)}
                className="h-8 text-xs border-slate-200 px-2"
              />
            </div>

            {/* Student Year */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Student Year
              </label>
              <Select
                value={draftSelectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="h-8 text-xs border-slate-200"
              >
                <option value="">All Years</option>
                <option value={currentYear - 1}>2nd Year ({currentYear - 1})</option>
                <option value={currentYear - 2}>3rd Year ({currentYear - 2})</option>
                <option value={currentYear - 3}>4th Year ({currentYear - 3})</option>
              </Select>
            </div>

            {/* Section */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Section
              </label>
              <Select
                value={draftSection}
                onChange={(e) => setDraftSection(e.target.value)}
                className="h-8 text-xs border-slate-200"
              >
                <option value="">All Sections</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Category
              </label>
              <Select
                value={draftActivityCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-8 text-xs border-slate-200"
              >
                <option value="">All Categories</option>
                <option value="Co-curricular">Co-curricular</option>
                <option value="Extracurricular">Extracurricular</option>
                <option value="Others">Others</option>
              </Select>
            </div>

            {/* Activity Type (Auto-updates category when selected) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Activity Type
              </label>
              <Select
                value={draftActivityType}
                onChange={(e) => handleActivityTypeChange(e.target.value)}
                className="h-8 text-xs border-slate-200"
              >
                <option value="">All Types</option>
                {activityTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Loading dashboard analytics...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl font-semibold">
            {error?.message || 'Failed to load analytics data.'}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* Metabase KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Applications
                </p>
                <p className="text-2xl font-bold text-slate-900">{totalApps}</p>
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Approved
                </p>
                <p className="text-2xl font-bold text-blue-600">{summary.approved}</p>
                <p className="text-[10px] text-slate-400 font-medium">{approvedRate}% rate</p>
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rejected
                </p>
                <p className="text-2xl font-bold text-red-600">{summary.rejected}</p>
                <p className="text-[10px] text-slate-400 font-medium">{rejectedRate}% rate</p>
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Pending
                </p>
                <p className="text-2xl font-bold text-slate-700">{summary.pending}</p>
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Certs Uploaded
                </p>
                <p className="text-2xl font-bold text-emerald-600">
                  {summary.certificatesUploaded}
                </p>
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Certs Verified
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  {summary.certificatesVerified}
                </p>
              </div>
            </div>

            {/* Participation & Trends Section */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 tracking-tight uppercase">
                Participation Overview
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly OD Applications Chart */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Monthly Applications Trend
                  </span>

                  {data?.monthlyTrend && data.monthlyTrend.length > 0 ? (
                    <div className="h-60 flex items-end justify-between gap-3 pt-4 px-2">
                      {data.monthlyTrend.map((m) => {
                        const maxCount = Math.max(...data.monthlyTrend.map((t) => t.totalCount), 1);
                        const heightPct = Math.round((m.totalCount / maxCount) * 100);

                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                            <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              {m.totalCount}
                            </span>
                            <div className="w-full bg-slate-100 rounded-t flex items-end h-44 overflow-hidden">
                              <div
                                className="w-full bg-blue-600 rounded-t transition-all duration-300 group-hover:bg-blue-700"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 truncate max-w-[50px]">
                              {m.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-xs text-slate-400 font-medium">
                      No monthly application trend recorded for selected criteria
                    </div>
                  )}
                </div>

                {/* Application Status Distribution (Donut Chart) */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Application Status Distribution
                  </span>

                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2 h-60">
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#F1F5F9" strokeWidth="3.5" />
                        <circle
                          cx="18"
                          cy="18"
                          fill="transparent"
                          r="15.915"
                          stroke="#2563EB"
                          strokeWidth="3.5"
                          strokeDasharray={`${approvedRate} ${100 - approvedRate}`}
                          strokeDashoffset="0"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="block text-2xl font-bold text-slate-900">{totalApps}</span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Total</span>
                      </div>
                    </div>

                    <div className="space-y-3 w-full sm:w-auto">
                      {data?.statusDistribution.map((item) => (
                        <div key={item.status} className="flex items-center justify-between gap-6 text-xs">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                item.status === 'Approved'
                                  ? 'bg-blue-600'
                                  : item.status === 'Rejected'
                                  ? 'bg-red-500'
                                  : item.status === 'Pending'
                                  ? 'bg-slate-500'
                                  : 'bg-slate-300'
                              }`}
                            />
                            <span className="font-medium text-slate-700">{item.status}</span>
                          </div>
                          <span className="font-semibold text-slate-900">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Year & Section Breakdown Section */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 tracking-tight uppercase">
                Demographic Analytics
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Apps by Student Year */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Applications by Student Year
                  </span>

                  {data?.byStudentYear && data.byStudentYear.length > 0 ? (
                    <div className="space-y-4 pt-2">
                      {data.byStudentYear.map((yr) => {
                        const pct = totalApps ? Math.round((yr.count / totalApps) * 100) : 0;
                        return (
                          <div key={yr.admissionYear} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-slate-700">
                              <span>{yr.yearLabel}</span>
                              <span className="font-semibold text-slate-900">{yr.count} ({pct}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 font-medium">
                      No year breakdown recorded for selected criteria
                    </div>
                  )}
                </div>

                {/* Apps by Section Grouped under Year */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Applications by Section (Grouped by Year)
                  </span>

                  {data?.bySectionGrouped && data.bySectionGrouped.length > 0 ? (
                    <div className="space-y-4 pt-1">
                      {data.bySectionGrouped.map((grp) => (
                        <div key={grp.admissionYear} className="space-y-2">
                          <span className="text-xs font-semibold text-blue-700">{grp.yearLabel}</span>
                          <div className="grid grid-cols-3 gap-2">
                            {grp.sections.map((sec) => (
                              <div
                                key={sec.section}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center space-y-0.5"
                              >
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                  Sec {sec.section}
                                </span>
                                <p className="text-base font-bold text-slate-900">{sec.count}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 font-medium">
                      No section breakdown recorded for selected criteria
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Category & Type Distribution Section */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 tracking-tight uppercase">
                Activity Analytics
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Apps by Category */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Applications by Category
                  </span>

                  <div className="space-y-4 pt-1">
                    {data?.categoryDistribution.map((cat) => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span>{cat.category}</span>
                          <span className="font-semibold text-slate-900">{cat.count} ({cat.percentage}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Apps by Activity Type */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Applications by Activity Type
                  </span>

                  {data?.activityTypeDistribution && data.activityTypeDistribution.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {data.activityTypeDistribution.map((act) => (
                        <div
                          key={act.activityType}
                          className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs"
                        >
                          <span className="font-medium text-slate-800">{act.activityType}</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            {act.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 font-medium">
                      No activity type breakdown available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Certificate Status Analytics Section */}
            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                Certificate Status Distribution
              </span>

              {data?.certificateStatusDistribution && data.certificateStatusDistribution.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                  {data.certificateStatusDistribution.map((st) => (
                    <div
                      key={st.status}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1"
                    >
                      <span className="text-[10px] font-semibold text-slate-500 uppercase truncate block">
                        {st.status}
                      </span>
                      <p className="text-lg font-bold text-slate-900">{st.count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No certificate status metrics recorded
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
};
