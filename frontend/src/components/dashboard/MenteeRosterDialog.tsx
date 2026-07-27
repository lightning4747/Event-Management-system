import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Search, Users, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Mentee {
  userId: string;
  username: string;
  fullName: string;
  dateOfBirth?: string;
  section: string;
  admissionYear: number;
}

interface MenteeRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MenteeRosterDialog: React.FC<MenteeRosterDialogProps> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [editingMentee, setEditingMentee] = React.useState<Mentee | null>(null);
  const [editForm, setEditForm] = React.useState({
    fullName: '',
    dateOfBirth: '',
    section: 'A',
    password: '',
  });
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = React.useState<string | null>(null);

  const { data: mentees = [], isLoading } = useQuery<Mentee[]>({
    queryKey: ['menteesList'],
    queryFn: async () => {
      const res = await apiFetch('/mentor/mentees');
      return res.json();
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { fullName?: string; dateOfBirth?: string; section?: string; password?: string }) => {
      if (!editingMentee) return;
      const cleanPayload: Record<string, string> = {};
      if (payload.fullName) cleanPayload.fullName = payload.fullName;
      if (payload.dateOfBirth) cleanPayload.dateOfBirth = payload.dateOfBirth;
      if (payload.section) cleanPayload.section = payload.section;
      if (payload.password) cleanPayload.password = payload.password;

      const res = await apiFetch(`/mentor/students/${editingMentee.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanPayload),
      });
      return res.json();
    },
    onSuccess: () => {
      setUpdateSuccess('Mentee details updated successfully.');
      setUpdateError(null);
      queryClient.invalidateQueries({ queryKey: ['menteesList'] });
      setTimeout(() => {
        setEditingMentee(null);
        setUpdateSuccess(null);
      }, 1200);
    },
    onError: (err: Error) => {
      setUpdateError(err.message || 'Failed to update mentee details.');
      setUpdateSuccess(null);
    },
  });

  const handleEditClick = (mentee: Mentee) => {
    setEditingMentee(mentee);
    setEditForm({
      fullName: mentee.fullName || '',
      dateOfBirth: mentee.dateOfBirth || '',
      section: mentee.section || 'A',
      password: '',
    });
    setUpdateError(null);
    setUpdateSuccess(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(null);
    updateMutation.mutate(editForm);
  };

  const filtered = mentees.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.userId.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q) ||
      m.fullName.toLowerCase().includes(q)
    );
  });

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Users className="w-5 h-5 text-primary" />
              My Mentees ({mentees.length})
            </DialogTitle>
          </DialogHeader>

          <div className="shrink-0 pb-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by roll number or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">
                  {search ? 'No mentees match your search.' : 'No mentees in your cohort yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {filtered.map((mentee) => (
                  <div
                    key={mentee.userId}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5 hover:border-border hover:bg-muted/30 transition-colors relative group"
                  >
                    <button
                      type="button"
                      onClick={() => handleEditClick(mentee)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-primary hover:bg-white p-1 rounded-lg border border-transparent hover:border-gray-200 transition-colors"
                      title="Edit Mentee Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-foreground">
                      {getInitials(mentee.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight pr-6">{mentee.fullName}</p>
                      <p className="text-[11px] text-gray-500 font-mono font-medium mt-0.5">{mentee.userId}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {mentee.section && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full">
                          Sec {mentee.section}
                        </span>
                      )}
                      {mentee.admissionYear && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full">
                          {mentee.admissionYear}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Mentee Modal */}
      <Dialog open={!!editingMentee} onOpenChange={(open) => !open && setEditingMentee(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Edit Mentee Details ({editingMentee?.userId})
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
              <Label className="text-sm font-semibold text-gray-700">Full Name</Label>
              <Input
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                disabled={updateMutation.isPending}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Date of Birth</Label>
              <Input
                type="date"
                required
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                disabled={updateMutation.isPending}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Section</Label>
              <Select
                value={editForm.section}
                onChange={(e) => setEditForm((prev) => ({ ...prev, section: e.target.value }))}
                disabled={updateMutation.isPending}
                className="h-10"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </Select>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <Label className="text-sm font-semibold text-gray-700">Reset Password (Optional)</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep current password"
                value={editForm.password}
                onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                disabled={updateMutation.isPending}
                className="h-10"
              />
              <p className="text-[11px] text-gray-400">Minimum 6 characters if resetting password.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setEditingMentee(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
