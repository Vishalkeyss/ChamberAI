import React from 'react';
import { User, Mail, Phone, Briefcase, Globe } from 'lucide-react';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

interface WizardStepContactProps {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export const WizardStepContact: React.FC<WizardStepContactProps> = ({
  fullName,
  jobTitle,
  email,
  phone,
  preferredLanguage,
  errors,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Primary Contact Information
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Provide the details of the authorized representative and primary account administrator.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Full Name *
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => onChange('fullName', e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
          {errors.fullName && (
            <p className="text-[11px] text-red-500 mt-1">{errors.fullName}</p>
          )}
        </div>

        {/* Job Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Job Title / Position
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => onChange('jobTitle', e.target.value)}
              placeholder="e.g. Managing Director, Founder"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
        </div>

        {/* Work Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Business / Work Email *
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder={EMAIL_PLACEHOLDER}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
          {errors.email && (
            <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        {/* Mobile Phone */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder={PHONE_PLACEHOLDER}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
          {errors.phone && (
            <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Preferred Language */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Preferred Language
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <select
              value={preferredLanguage}
              onChange={(e) => onChange('preferredLanguage', e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
