import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { FileSpreadsheet, Download, RefreshCw, Filter, AlertCircle, Calendar, Sheet } from 'lucide-react';

const extracurricularTypes = ['Sports', 'NCC', 'NSS', 'Dance'];
const cocurricularTypes = ['Hackathon', 'Seminar', 'Workshop', 'Symposium', 'Conference'];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

export const Reports: React.FC = () => {
  const { user } = useAuth();

  const isAllowedRole = ['Event Coordinator', 'Program Coordinator', 'Head of Department'].includes(user?.role || '');

  if (user && !isAllowedRole) {
    return <Navigate to="/dashboard" replace />;
  }

  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [activityType, setActivityType] = React.useState('');
  const [section, setSection] = React.useState('');
  const [admissionYear, setAdmissionYear] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [loadingExcel, setLoadingExcel] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setActivityType('');
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setCategory('');
    setActivityType('');
    setSection('');
    setAdmissionYear('');
    setErrorMsg(null);
  };

  const handleInitiateExport = () => {
    setErrorMsg(null);
    if (!fromDate || !toDate) {
      setErrorMsg('Please select both From Date and To Date before exporting the report.');
      return;
    }
    if (fromDate > toDate) {
      setErrorMsg('From Date cannot be later than To Date.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmExport = async () => {
    setShowConfirmModal(false);
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (section) params.append('section', section);
    if (admissionYear) params.append('admissionYear', admissionYear);
    if (category) params.append('activityCategory', category);
    if (activityType) params.append('activityType', activityType);

    const path = `/reports/global?${params}`;
    try {
      setLoading(true);
      const res = await apiFetch(path);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'global_od_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to download report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelExport = async () => {
    setErrorMsg(null);
    if (!fromDate || !toDate) {
      setErrorMsg('Please select both From Date and To Date before exporting the Excel report.');
      return;
    }
    if (fromDate > toDate) {
      setErrorMsg('From Date cannot be later than To Date.');
      return;
    }
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (section) params.append('section', section);
    if (admissionYear) params.append('admissionYear', admissionYear);
    if (category) params.append('activityCategory', category);
    if (activityType) params.append('activityType', activityType);

    const path = `/reports/global-excel?${params}`;
    try {
      setLoadingExcel(true);
      const res = await apiFetch(path);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Master_OD_Report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download Excel report.');
    } finally {
      setLoadingExcel(false);
    }
  };

  const activeFiltersCount = [fromDate, toDate, category, activityType, section, admissionYear].filter(Boolean).length;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-blue-600" />
              Export On-Duty Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate custom department-wide On-Duty CSV reports with criteria filters
            </p>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Report Filter Criteria</h2>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-800 text-sm p-3.5 rounded-xl font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* From Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                From Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setErrorMsg(null); }}
                className={`h-10 text-sm ${!fromDate && errorMsg ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
            </div>

            {/* To Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                To Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setErrorMsg(null); }}
                className={`h-10 text-sm ${!toDate && errorMsg ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
            </div>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Activity Category</Label>
              <Select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-10 text-sm"
              >
                <option value="">All Categories</option>
                <option value="Co-curricular">Co-curricular</option>
                <option value="Extracurricular">Extracurricular</option>
                <option value="Others">Others</option>
              </Select>
            </div>

            {/* Cascading Activity Type Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Activity Type</Label>
              {!category ? (
                <Select disabled className="h-10 text-sm opacity-60">
                  <option value="">Select Category first...</option>
                </Select>
              ) : category === 'Extracurricular' ? (
                <Select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="h-10 text-sm"
                >
                  <option value="">All Extracurricular Types</option>
                  {extracurricularTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              ) : category === 'Co-curricular' ? (
                <Select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="h-10 text-sm"
                >
                  <option value="">All Co-curricular Types</option>
                  {cocurricularTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  placeholder="Specify custom activity name..."
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="h-10 text-sm"
                />
              )}
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Class Section</Label>
              <Select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="h-10 text-sm"
              >
                <option value="">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </Select>
            </div>

            {/* Admission Year */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Admission Year</Label>
              <Select
                value={admissionYear}
                onChange={(e) => setAdmissionYear(e.target.value)}
                className="h-10 text-sm"
              >
                <option value="">All Admission Years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              <span className="text-red-500 font-bold">*</span> Select both From Date and To Date to generate a report.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                id="btn-download-csv"
                onClick={handleInitiateExport}
                disabled={loading || loadingExcel}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-10 px-5 gap-2 shrink-0 shadow-sm"
              >
                <Download className="w-4 h-4" />
                {loading ? 'Generating CSV...' : 'Download CSV'}
              </Button>
              <Button
                id="btn-download-excel"
                onClick={handleExcelExport}
                disabled={loading || loadingExcel}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm h-10 px-5 gap-2 shrink-0 shadow-sm"
              >
                <Sheet className="w-4 h-4" />
                {loadingExcel ? 'Generating Excel...' : 'Download Excel (.xlsx)'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Download Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md bg-white space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Confirm CSV Report Download
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to download the On-Duty report for the selected date range and criteria?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                <span className="font-semibold text-gray-500">Date Range</span>
                <span className="font-bold text-gray-900 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {fromDate} → {toDate}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-500">Activity Category</span>
                <span className="font-bold text-gray-900">{category || 'All Categories'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-500">Activity Type</span>
                <span className="font-bold text-gray-900">{activityType || 'All Types'}</span>
              </div>
              {section && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">Class Section</span>
                  <span className="font-bold text-gray-900">Section {section}</span>
                </div>
              )}
              {admissionYear && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">Admission Year</span>
                  <span className="font-bold text-gray-900">{admissionYear}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-9 text-xs font-semibold">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleConfirmExport}
              className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Confirm & Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};
