import React from 'react';

interface StudentAvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function getInitials(name: string): string {
  if (!name) return 'AL';
  const clean = name.trim().replace(/^[\d.\-_()[\]]+/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): {
  bg: string;
  text: string;
  border: string;
} {
  const hash = (name || 'A').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = hash % 6;

  switch (colorIndex) {
    case 0:
      return { bg: 'bg-gradient-to-br from-sky-50 to-sky-100/90', text: 'text-sky-800', border: 'border-sky-200/80 shadow-xs' };
    case 1:
      return { bg: 'bg-gradient-to-br from-teal-50 to-teal-100/90', text: 'text-teal-800', border: 'border-teal-200/80 shadow-xs' };
    case 2:
      return { bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/90', text: 'text-indigo-800', border: 'border-indigo-200/80 shadow-xs' };
    case 3:
      return { bg: 'bg-gradient-to-br from-violet-50 to-violet-100/90', text: 'text-violet-800', border: 'border-violet-200/80 shadow-xs' };
    case 4:
      return { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/90', text: 'text-emerald-800', border: 'border-emerald-200/80 shadow-xs' };
    case 5:
    default:
      return { bg: 'bg-gradient-to-br from-slate-50 to-slate-100/90', text: 'text-slate-700', border: 'border-slate-200/80 shadow-xs' };
  }
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name,
  size = 'md',
  className = '',
}) => {
  const initials = getInitials(name);
  const colors = getAvatarColor(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs font-semibold',
    md: 'w-10 h-10 text-sm font-bold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-xl font-extrabold',
    '2xl': 'w-20 h-20 text-2xl font-extrabold',
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`rounded-2xl border flex items-center justify-center font-mono tracking-tight select-none ${sizeClasses[size]} ${colors.bg} ${colors.text} ${colors.border}`}
        title={name}
      >
        {initials}
      </div>
    </div>
  );
};
