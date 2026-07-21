import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Search, Users } from 'lucide-react';

interface Mentee {
  userId: string;
  username: string;
  fullName: string;
  section: string;
  admissionYear: number;
}

interface MenteeRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MenteeRosterDialog: React.FC<MenteeRosterDialogProps> = ({ open, onOpenChange }) => {
  const [search, setSearch] = React.useState('');

  const { data: mentees = [], isLoading } = useQuery<Mentee[]>({
    queryKey: ['menteesList'],
    queryFn: async () => {
      const res = await apiFetch('/mentor/mentees');
      return res.json();
    },
    enabled: open,
  });

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

  const avatarColors = [
    'bg-muted text-foreground',
  ];

  return (
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
              placeholder="Search by roll number, username, or name..."
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
              {filtered.map((mentee, idx) => (
                <div
                  key={mentee.userId}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5 hover:border-border hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${avatarColors[idx % avatarColors.length]}`}>
                    {getInitials(mentee.fullName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{mentee.fullName}</p>
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
  );
};
