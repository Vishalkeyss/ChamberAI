import React from 'react';
import { Building2, Globe, MapPin, Users, DollarSign, FileText } from 'lucide-react';

interface WizardStepBusinessProps {
  businessName: string;
  dbaName: string;
  website: string;
  industry: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  employeeCount: number;
  annualRevenue: number;
  description: string;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

const INDUSTRIES = [
  'Agriculture & Mining',
  'Construction & Real Estate',
  'Education & Training',
  'Finance & Insurance',
  'Food & Hospitality',
  'Healthcare & Life Sciences',
  'Legal & Professional Services',
  'Manufacturing & Industrial',
  'Media, Arts & Entertainment',
  'Nonprofit & Civic Organizations',
  'Retail & eCommerce',
  'Technology & Software',
  'Transportation & Logistics',
  'Other / General Business',
];

export const WizardStepBusiness: React.FC<WizardStepBusinessProps> = ({
  businessName,
  dbaName,
  website,
  industry,
  street,
  city,
  state,
  zip,
  employeeCount,
  annualRevenue,
  description,
  errors,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Business Profile & Operations
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Tell us about your company, industry, operating location, and team size.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Legal Business Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Legal Business Name *
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={businessName}
              onChange={(e) => onChange('businessName', e.target.value)}
              placeholder="e.g. Apex Technologies Inc"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
          {errors.businessName && (
            <p className="text-[11px] text-red-500 mt-1">{errors.businessName}</p>
          )}
        </div>

        {/* DBA / Trade Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            DBA / Operating Name (If different)
          </label>
          <input
            type="text"
            value={dbaName}
            onChange={(e) => onChange('dbaName', e.target.value)}
            placeholder="e.g. Apex Cloud Solutions"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          />
        </div>

        {/* Website URL */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Website URL
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="url"
              value={website}
              onChange={(e) => onChange('website', e.target.value)}
              placeholder="https://company.com"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
        </div>

        {/* Industry Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Industry Category *
          </label>
          <select
            value={industry}
            onChange={(e) => onChange('industry', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
          {errors.industry && (
            <p className="text-[11px] text-red-500 mt-1">{errors.industry}</p>
          )}
        </div>
      </div>

      {/* Address Details */}
      <div className="pt-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Headquarters / Street Address *
        </label>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={street}
            onChange={(e) => onChange('street', e.target.value)}
            placeholder="123 Commerce Blvd, Suite 400"
            className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          />
        </div>
        {errors.street && (
          <p className="text-[11px] text-red-500 mt-1">{errors.street}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            City *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="e.g. Austin"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          />
          {errors.city && (
            <p className="text-[11px] text-red-500 mt-1">{errors.city}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            State / Region *
          </label>
          <input
            type="text"
            value={state}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder="e.g. TX"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          />
          {errors.state && (
            <p className="text-[11px] text-red-500 mt-1">{errors.state}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            ZIP / Postal Code *
          </label>
          <input
            type="text"
            value={zip}
            onChange={(e) => onChange('zip', e.target.value)}
            placeholder="e.g. 78701"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
          />
          {errors.zip && (
            <p className="text-[11px] text-red-500 mt-1">{errors.zip}</p>
          )}
        </div>
      </div>

      {/* Operational Metrics: Employees & Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Total Employees
          </label>
          <div className="relative">
            <Users className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="number"
              min="1"
              value={employeeCount || ''}
              onChange={(e) => onChange('employeeCount', Math.max(1, parseInt(e.target.value, 10) || 1))}
              placeholder="e.g. 15"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Annual Gross Revenue ($ USD)
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="number"
              min="0"
              step="5000"
              value={annualRevenue || ''}
              onChange={(e) => onChange('annualRevenue', Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="e.g. 1200000"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Company Bio & Mission (Optional)
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Brief summary of products, services, and local community engagement..."
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0B2447]"
        />
      </div>
    </div>
  );
};
