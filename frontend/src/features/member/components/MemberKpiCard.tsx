import React from 'react';

export interface MemberKpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  subtext?: string;
  badge?: string;
  onClick?: () => void;
  accentColor?: string;
}

export const MemberKpiCard: React.FC<MemberKpiCardProps> = ({
  icon,
  value,
  label,
  subtext,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-card text-card-foreground rounded-2xl border border-border p-5 shadow-xs transition-all duration-200 hover:shadow-sm ${
        onClick ? 'cursor-pointer hover:border-primary/30' : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        {badge && (
          <span className="bg-gray-100 dark:bg-[#1E3352] text-gray-700 dark:text-[#94A6C2] text-xs font-semibold px-2.5 py-1 rounded-full border border-transparent dark:border-[#26406A]">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xl md:text-2xl font-bold text-card-foreground tracking-tight">
        {value}
      </p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
      {subtext && (
        <p className="text-[11px] text-primary dark:text-primary font-medium mt-1">
          {subtext}
        </p>
      )}
    </div>
  );
};
