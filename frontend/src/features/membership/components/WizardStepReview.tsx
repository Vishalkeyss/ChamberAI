import React from 'react';
import type { ChapterOption, MembershipPlan } from '../types';
import { CheckCircle2, ShieldCheck, Building2, User, MapPin, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStepReviewProps {
  plan?: MembershipPlan;
  chapter?: ChapterOption;
  calculatedPrice: number;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
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
  agreedToTerms: boolean;
  onToggleTerms: (agreed: boolean) => void;
}

export const WizardStepReview: React.FC<WizardStepReviewProps> = ({
  plan,
  chapter,
  calculatedPrice,
  fullName,
  jobTitle,
  email,
  phone,
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
  agreedToTerms,
  onToggleTerms,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Review & Submit Your Application
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Please confirm your details below before submitting your membership application to the committee.
        </p>
      </div>

      {/* Summary Container */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60">
        {/* Tier & Chapter Block */}
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-xs shrink-0"
              style={{ backgroundColor: plan?.accentColor || '#0B2447' }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {plan?.name || 'Selected Tier'}
                </span>
                {chapter && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {chapter.name}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {plan?.billingFrequency || 'annual'} billing cycle
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Estimated Dues
            </span>
            <span className="text-lg font-black text-[#0B2447] dark:text-blue-400">
              {calculatedPrice === 0 ? 'Free' : `$${calculatedPrice.toLocaleString('en-US')}/yr`}
            </span>
          </div>
        </div>

        {/* Business Summary */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Building2 className="w-4 h-4 text-[#0B2447] dark:text-blue-400" />
            <span>Business Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Business Name:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {businessName} {dbaName ? `(DBA: ${dbaName})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Industry:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{industry}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Address:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {street}, {city}, {state} {zip}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Team & Scale:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {employeeCount} employees · ${annualRevenue.toLocaleString('en-US')} revenue
              </span>
            </div>
            {website && (
              <div className="sm:col-span-2">
                <span className="text-slate-400 block text-[11px]">Website:</span>
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 dark:text-blue-400 underline"
                >
                  {website}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Primary Contact Summary */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <User className="w-4 h-4 text-[#0B2447] dark:text-blue-400" />
            <span>Primary Contact Representative</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Contact Name:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {fullName} {jobTitle ? `(${jobTitle})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Email Address:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Phone Number:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Code of Conduct & Terms Agreement */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => onToggleTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-[#0B2447] border-slate-300 focus:ring-[#0B2447] cursor-pointer"
          />
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Chamber Code of Conduct & Membership Agreement
            </span>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              I certify that all information submitted is accurate and represents our business in good standing.
              I agree to abide by the Chamber’s bylaws, ethical networking standards, and payment terms upon acceptance.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
};
