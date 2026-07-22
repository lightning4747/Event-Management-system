import * as React from 'react';
import { Calendar, Clock, AlertCircle, FileCheck, CheckCircle2, XCircle } from 'lucide-react';

export type EventTagType =
  | 'Upcoming'
  | 'Ongoing'
  | 'Action Required'
  | 'Reviewing'
  | 'Completed'
  | 'Pending Approval'
  | 'Rejected'
  | 'Withdrawn';

interface EventTagBadgeProps {
  tag?: EventTagType | string;
  className?: string;
}

export const EventTagBadge: React.FC<EventTagBadgeProps> = ({ tag, className = '' }) => {
  if (!tag) return null;

  const getBadgeStyle = () => {
    switch (tag) {
      case 'Upcoming':
        return {
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Calendar,
          label: 'Upcoming Event',
        };
      case 'Ongoing':
        return {
          color: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
          icon: Clock,
          label: 'Event Ongoing',
          pulse: true,
        };
      case 'Action Required':
        return {
          color: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: AlertCircle,
          label: 'Cert-Upload Required',
        };
      case 'Reviewing':
        return {
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: FileCheck,
          label: 'Reviewing Certs',
        };
      case 'Completed':
        return {
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
          label: 'Event Completed',
        };
      case 'Pending Approval':
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Clock,
          label: 'Approval Pending',
        };
      case 'Rejected':
        return {
          color: 'bg-red-50 text-red-700 border-red-200',
          icon: XCircle,
          label: 'Application Rejected',
        };
      case 'Withdrawn':
        return {
          color: 'bg-gray-100 text-gray-500 border-gray-200',
          icon: XCircle,
          label: 'Application Withdrawn',
        };
      default:
        return {
          color: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: Calendar,
          label: tag,
        };
    }
  };

  const { color, icon: Icon, label, pulse } = getBadgeStyle();

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${color} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${pulse ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </span>
  );
};
