import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/core/context/ThemeContext';
import {
  Sparkles,
  ArrowRight,
  Plus,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AILandingPageProps {
  chamberName?: string;
  chamberLogoUrl?: string;
  role?: string;
  user?: {
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  } | null;
  onEnterPrompt?: (query: string) => void;
  onViewTraditionalLayout: () => void;
  onLogout?: () => void;
}

const AI_SUGGESTIONS: Record<string, string[]> = {
  member: [
    'Show my directory listing',
    'Find upcoming events',
    'Open billing & invoices',
    'Update my business profile',
  ],
  admin: [
    'Show pending member applications',
    'Open billing overview',
    'Create a new event',
    'Show chapter performance',
  ],
  chapter_admin: [
    'Show chapter member list',
    'View chapter upcoming events',
    'Review chapter applications',
    'Chapter attendance report',
  ],
  super_admin: [
    'Show all chambers',
    'Open platform billing',
    'Review flagged applications',
    'Show platform settings',
  ],
};

const AI_PLACEHOLDER_CYCLE: Record<string, string[]> = {
  member: [
    'Ask AI to find an upcoming event…',
    'Ask AI to update your business profile…',
    'Ask AI to open your latest invoice…',
    'Ask AI to find another member in the directory…',
  ],
  admin: [
    'Ask AI to show pending applications…',
    'Ask AI to open the billing overview…',
    'Ask AI to create a new event…',
    'Ask AI to show chapter performance…',
  ],
  chapter_admin: [
    'Ask AI to view chapter members…',
    'Ask AI to check chapter event registrations…',
    'Ask AI to show chapter metrics…',
  ],
  super_admin: [
    'Ask AI to list all chambers…',
    'Ask AI to open platform billing…',
    'Ask AI to review flagged applications…',
    'Ask AI to update platform settings…',
  ],
};

export const AILandingPage: React.FC<AILandingPageProps> = ({
  chamberName,
  chamberLogoUrl,
  role = 'member',
  user,
  onEnterPrompt,
  onViewTraditionalLayout,
  onLogout,
}) => {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const [q, setQ] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync dark state directly with global theme
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Normalize role key for suggestions/placeholders
  const roleKey =
    role === 'full_admin' || role === 'billing_admin' || role === 'group_admin'
      ? 'admin'
      : role === 'super_admin'
        ? 'super_admin'
        : role === 'chapter_admin'
          ? 'chapter_admin'
          : 'member';

  const cycle = AI_PLACEHOLDER_CYCLE[roleKey] || AI_PLACEHOLDER_CYCLE.member;
  const suggestions = AI_SUGGESTIONS[roleKey] || AI_SUGGESTIONS.member;

  // Placeholder rotation interval (stops once user types)
  useEffect(() => {
    if (q) return;
    const id = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % cycle.length);
    }, 3200);
    return () => clearInterval(id);
  }, [q, cycle.length]);

  // Dynamic Chamber / Tenant Title & Subtitle: Zero hardcoding
  const headerTitle =
    role === 'super_admin'
      ? '121 Meet.AI'
      : chamberName && chamberName.trim().length > 0
        ? chamberName
        : '121 Meet.AI';

  const headerSubtitle =
    role === 'super_admin' ? 'Platform Administration' : 'Powered by 121 Meet.AI';

  const chamberInitials =
    headerTitle
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '12';

  const label =
    role === 'super_admin'
      ? 'Super Admin'
      : role === 'chapter_admin'
        ? 'Chapter Admin'
        : role === 'full_admin'
          ? 'Chamber Admin'
          : role === 'billing_admin'
            ? 'Billing Admin'
            : role === 'group_admin'
              ? 'Group Admin'
              : 'Member';

  // Exact Canonical Design Tokens from app.html
  const T = {
    navy: '#0B2447',
    navyDark: '#051937',
    teal: '#1E3A5F',
    heading: '#0A0F1C',
    slate: '#4B5563',
    border: '#E5E7EB',
  };

  const bgStyle = isDark
    ? { background: `radial-gradient(circle at 50% 0%, ${T.teal} 0%, ${T.navy} 45%, ${T.navyDark} 100%)` }
    : { background: `radial-gradient(1200px 600px at 50% -10%, #E8EEF9 0%, #F3F5F8 45%, #FFFFFF 100%)` };

  const heading = isDark ? '#fff' : T.heading;
  const subtext = isDark ? '#ffffffb3' : T.slate;
  const chipText = isDark ? '#ffffffcc' : '#1E3A5F';
  const chipBg = isDark ? '#ffffff0f' : '#0B24470D';
  const chipBorder = isDark ? '1px solid #ffffff26' : `1px solid ${T.border}`;
  const panelBg = isDark ? '#ffffff14' : '#FFFFFF';
  const panelBorder = isDark ? '1px solid #ffffff26' : `1px solid ${T.border}`;
  const inputText = isDark ? '#fff' : T.heading;
  const inputPlaceholder = isDark ? '#ffffff80' : '#94A3B8';

  const handleEnter = (text?: string) => {
    const val = text !== undefined ? text : q;
    if (val && val.trim().length > 0) {
      if (onEnterPrompt) onEnterPrompt(val.trim());
      else onViewTraditionalLayout();
    } else {
      onViewTraditionalLayout();
    }
  };

  return (
    <div
      className="ai-landing fixed inset-0 z-40 flex flex-col overflow-y-auto overflow-x-hidden max-w-full"
      style={{ ...bgStyle, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Top Header Bar */}
      <div className="ai-landing-header w-full max-w-full flex items-center justify-between px-6 sm:px-10 py-5 shrink-0">
        <span
          className="ai-landing-brand font-bold flex items-center gap-2.5 min-w-0"
          style={{ color: heading }}
        >
          {chamberLogoUrl ? (
            <img
              src={chamberLogoUrl}
              alt={headerTitle}
              className="w-8 h-8 rounded-lg object-contain shadow-sm shrink-0"
              style={{ background: '#fff' }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm shrink-0"
              style={{ background: T.navy, color: '#fff' }}
            >
              {chamberInitials}
            </div>
          )}
          <span className="flex flex-col leading-tight min-w-0">
            <span className="text-[15px] truncate max-w-[220px] sm:max-w-xs">{headerTitle}</span>
            <span className="text-[10px] font-medium" style={{ color: subtext }}>
              {headerSubtitle}
            </span>
          </span>
        </span>

        {/* Controls: Theme Toggle, Language Switcher, Role Badge */}
        <div className="ai-landing-controls flex items-center gap-3 shrink-0">
          {role !== 'super_admin' && (
            <div
              className="flex items-center gap-0.5 h-8 rounded-full p-1 border"
              style={{ background: chipBg, border: chipBorder }}
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                title="Light Theme"
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  theme === 'light' ? 'shadow-xs' : ''
                )}
                style={
                  theme === 'light'
                    ? { background: isDark ? '#ffffff' : T.navy, color: isDark ? '#0B2447' : '#fff' }
                    : { color: isDark ? '#ffffff99' : '#64748B' }
                }
              >
                <Sun size={13} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                title="Dark Theme"
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  theme === 'dark' ? 'shadow-xs' : ''
                )}
                style={
                  theme === 'dark'
                    ? { background: isDark ? '#ffffff' : T.navy, color: isDark ? '#0B2447' : '#fff' }
                    : { color: isDark ? '#ffffff99' : '#64748B' }
                }
              >
                <Moon size={13} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                title="System Theme"
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  theme === 'system' ? 'shadow-xs' : ''
                )}
                style={
                  theme === 'system'
                    ? { background: isDark ? '#ffffff' : T.navy, color: isDark ? '#0B2447' : '#fff' }
                    : { color: isDark ? '#ffffff99' : '#64748B' }
                }
              >
                <Monitor size={13} strokeWidth={2.25} />
              </button>
            </div>
          )}

          {role !== 'super_admin' && (
            <div
              className="flex items-center gap-0.5 h-8 rounded-full p-1 border"
              style={{ background: chipBg, border: chipBorder }}
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className="px-2.5 py-0.5 rounded-full text-xs font-bold transition-all"
                style={
                  language === 'en'
                    ? { background: T.navy, color: '#fff' }
                    : { color: isDark ? '#ffffff99' : '#64748B' }
                }
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('es')}
                className="px-2.5 py-0.5 rounded-full text-xs font-bold transition-all"
                style={
                  language === 'es'
                    ? { background: T.navy, color: '#fff' }
                    : { color: isDark ? '#ffffff99' : '#64748B' }
                }
              >
                ES
              </button>
            </div>
          )}

          <span
            className="hidden sm:inline text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: chipBg, color: chipText, border: chipBorder }}
          >
            Signed in as {label}
          </span>
        </div>
      </div>

      {/* Main Center Content */}
      <div className="ai-landing-content flex-1 w-full flex flex-col items-center justify-center px-6 py-5 sm:py-6">
        {/* Sparkle Icon Badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
          style={{ background: isDark ? '#ffffff14' : '#0B24470F' }}
        >
          <Sparkles size={19} color={isDark ? '#fff' : T.navy} />
        </div>

        {/* Hero Heading: Exact line break */}
        <h1
          className="text-3xl sm:text-5xl font-bold text-center"
          style={{ color: heading }}
        >
          Interact with your chamber<br />through AI
        </h1>

        {/* Hero Subtitle */}
        <p
          className="text-sm sm:text-base mt-4 text-center max-w-lg"
          style={{ color: subtext }}
        >
          Ask for anything — members, billing, events, applications — and let AI take you straight there.
        </p>

        {/* Large Interactive AI Prompt Box */}
        <div
          className="w-full max-w-2xl mt-9 rounded-2xl p-2.5 shadow-xl"
          style={{ background: panelBg, border: panelBorder, backdropFilter: 'blur(10px)' }}
        >
          <textarea
            rows={2}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEnter(q);
              }
            }}
            placeholder={cycle[placeholderIdx]}
            className="ai-landing-ta w-full bg-transparent resize-none outline-none text-sm sm:text-base px-3.5 py-2.5"
            style={{ color: inputText, caretColor: inputText }}
          />
          <style>{`.ai-landing-ta::placeholder{color:${inputPlaceholder};opacity:1;transition:color .2s ease}`}</style>

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-1.5">
              {attachedFiles.map((f, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
                  style={{ background: chipBg, color: chipText, border: chipBorder }}
                >
                  {f.name}
                  <button
                    onClick={() => setAttachedFiles((arr) => arr.filter((_, idx) => idx !== i))}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                    aria-label="Remove attachment"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length) setAttachedFiles((arr) => [...arr, ...files]);
              e.target.value = '';
            }}
          />

          <div className="flex items-center justify-between px-2 pb-1">
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: chipText }}
            >
              <Plus size={14} /> Attach
            </button>
            <button
              onClick={() => handleEnter(q)}
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              style={{ background: T.navy }}
              title="Submit"
              aria-label="Submit prompt"
            >
              <ArrowRight size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* Suggestion Chips: Exact 2-row layout from reference */}
        <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-2xl">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleEnter(s)}
              className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors cursor-pointer active:scale-95"
              style={{ background: chipBg, color: chipText, border: chipBorder }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Center: View Traditional Layout Action */}
      <div className="w-full flex justify-center pb-8 shrink-0">
        <button
          onClick={() => handleEnter('')}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer active:scale-95"
          style={{ background: chipBg, color: chipText, border: chipBorder }}
        >
          View traditional layout <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};

export default AILandingPage;
