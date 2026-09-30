import React, { useState, useEffect } from 'react';
import {
  List as ListIcon,
  Layers,
  Search,
  Eye,
  CheckCircle2,
  MessageSquare,
  XCircle,
  FileText,
  Mail,
  Phone,
  Globe,
  Building2,
  User,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  X,
  ExternalLink,
  Flag,
  Paperclip,
  Send,
} from 'lucide-react';
import {
  fetchAdminApplications,
  approveApplication,
  requestChangesApplication,
  rejectApplication,
  type AdminApplicationItem,
} from '../services/admin-applications.api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface AdminApplicationsPageProps {
  chamberSlug?: string;
}

const STATUS_TABS = ['All', 'Pending', 'Changes Requested', 'Rejected'];

const STAGES = [
  { key: 'pending', label: 'New Applications', dot: 'var(--color-primary)' },
  { key: 'changes_requested', label: 'Changes Requested', dot: 'var(--color-chart-3)' },
  { key: 'rejected', label: 'Rejected', dot: 'var(--color-destructive)' },
];

export const AdminApplicationsPage: React.FC<AdminApplicationsPageProps> = ({ chamberSlug }) => {
  const [applications, setApplications] = useState<AdminApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [boardView, setBoardView] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals state
  const [viewingApp, setViewingApp] = useState<AdminApplicationItem | null>(null);
  const [changesApp, setChangesApp] = useState<AdminApplicationItem | null>(null);
  const [changesNotes, setChangesNotes] = useState<string>('');
  const [rejectApp, setRejectApp] = useState<AdminApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Request Changes attachments state (matching Screenshot 1)
  interface AttachedFile {
    id: string;
    name: string;
    size: number;
    type: string;
  }
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const MAX_FILES = 5;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (fileList: FileList | null) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setAttachedFiles((prev) => {
      const room = Math.max(0, MAX_FILES - prev.length);
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_FILES} files`);
        return prev;
      }
      const next = incoming.slice(0, room).map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      if (incoming.length > room) {
        toast.error(`You can attach up to ${MAX_FILES} files`);
      }
      return [...prev, ...next];
    });
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminApplications(chamberSlug);
      setApplications(data);
    } catch (err: any) {
      console.error('Failed to load applications:', err);
      toast.error('Unable to load applications from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [chamberSlug]);

  // Filter out any approved applications so they never linger in the applications review queue
  const liveApplications = applications.filter((app) => app.status !== 'approved');

  // Filtered applications
  const filtered = liveApplications.filter((app) => {
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Pending' && app.status === 'pending') ||
      (statusFilter === 'Changes Requested' && app.status === 'changes_requested') ||
      (statusFilter === 'Rejected' && app.status === 'rejected');

    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      app.applicantName.toLowerCase().includes(q) ||
      app.businessName.toLowerCase().includes(q) ||
      app.planName.toLowerCase().includes(q) ||
      app.businessEmail.toLowerCase().includes(q) ||
      app.trackingCode.toLowerCase().includes(q)
    );
  });

  // Action handlers
  const handleApprove = async (app: AdminApplicationItem) => {
    setIsActionLoading(true);
    try {
      await approveApplication(app.id, chamberSlug);
      toast.success(`Application approved for ${app.applicantName}`);
      // Once approved, immediately remove from applications review queue
      setApplications((prev) => prev.filter((item) => item.id !== app.id));
      if (viewingApp?.id === app.id) {
        setViewingApp(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve application');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenChanges = (app: AdminApplicationItem) => {
    setChangesApp(app);
    setChangesNotes(app.adminNotes || '');
    setAttachedFiles([]);
    setIsDragOver(false);
  };

  const handleSubmitChanges = async () => {
    if (!changesApp) return;
    if (!changesNotes.trim()) {
      toast.error('Please enter the reviewer notes explaining the requested changes');
      return;
    }

    setIsActionLoading(true);
    try {
      const noteToSend =
        attachedFiles.length > 0
          ? `${changesNotes.trim()}\n\n[Attached reference files: ${attachedFiles.map((f) => f.name).join(', ')}]`
          : changesNotes.trim();

      await requestChangesApplication(changesApp.id, noteToSend, chamberSlug);
      toast.success(`Changes requested for ${changesApp.applicantName}`);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === changesApp.id
            ? { ...item, status: 'changes_requested', adminNotes: noteToSend }
            : item
        )
      );
      setChangesApp(null);
      setChangesNotes('');
      setAttachedFiles([]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to request changes');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenReject = (app: AdminApplicationItem) => {
    setRejectApp(app);
    setRejectReason('');
  };

  const handleSubmitReject = async () => {
    if (!rejectApp) return;
    setIsActionLoading(true);
    try {
      await rejectApplication(rejectApp.id, rejectReason.trim() || undefined, chamberSlug);
      toast.success(`Application rejected for ${rejectApp.applicantName}`);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === rejectApp.id
            ? { ...item, status: 'rejected', adminNotes: rejectReason.trim() || 'Rejected' }
            : item
        )
      );
      setRejectApp(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject application');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Drag and drop between stages
  const moveToStage = (app: AdminApplicationItem, stageKey: string) => {
    if (app.status === stageKey) return;
    if (stageKey === 'approved') {
      handleApprove(app);
      return;
    }
    if (stageKey === 'rejected') {
      handleOpenReject(app);
      return;
    }
    if (stageKey === 'changes_requested') {
      handleOpenChanges(app);
      return;
    }
  };

  const formatSubmittedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        return 'Today';
      }
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const initials = (name: string) =>
    (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200">
            Pending
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200">
            Changes Requested
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section matching screenshot */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Membership Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and take action on new submissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-secondary text-secondary-foreground border border-border">
            {liveApplications.length} total
          </span>
          <div className="flex rounded-lg overflow-hidden border border-border bg-card">
            <button
              type="button"
              onClick={() => setBoardView(false)}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
                !boardView
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <ListIcon size={14} />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardView(true)}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
                boardView
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Layers size={14} />
              <span>Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search applicant, business, plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                  active
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/40 border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content: List or Board */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary mb-2" />
          <p className="text-sm">Loading applications from database...</p>
        </div>
      ) : liveApplications.length === 0 ? (
        <div className="p-16 text-center rounded-2xl border border-dashed border-border bg-card">
          <FileText size={36} className="mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No applications yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            New membership applications submitted from the public plans module will appear here in the review queue.
          </p>
        </div>
      ) : boardView ? (
        /* Board / Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((col) => {
            const colItems = liveApplications.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.dot }} />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                    {col.label}
                  </h3>
                  <span className="ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground border border-border">
                    {colItems.length}
                  </span>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(col.key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === col.key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const id = e.dataTransfer.getData('text/plain') || draggingId;
                    const a = liveApplications.find((x) => x.id === id);
                    if (a) moveToStage(a, col.key);
                    setDraggingId(null);
                  }}
                  className={cn(
                    'space-y-3 rounded-2xl p-3 flex-1 transition-colors min-h-[140px] border border-border',
                    dragOverKey === col.key ? 'bg-muted' : 'bg-muted/30'
                  )}
                >
                  {colItems.length === 0 ? (
                    <div className="text-xs text-center py-10 text-muted-foreground">
                      {dragOverKey === col.key ? 'Drop here' : 'No cards'}
                    </div>
                  ) : (
                    colItems.map((a) => {
                      const actionable = a.status === 'pending' || a.status === 'changes_requested';
                      return (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(a.id);
                            e.dataTransfer.setData('text/plain', a.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverKey(null);
                          }}
                          onClick={() => setViewingApp(a)}
                          className={cn(
                            'rounded-xl p-3.5 bg-card border border-border shadow-2xs hover:shadow-md transition cursor-grab active:cursor-grabbing',
                            draggingId === a.id && 'opacity-40'
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                              {initials(a.applicantName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {a.applicantName}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {a.businessName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  {a.planName}
                                </span>
                                {a.chapterName && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {a.chapterName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
                            <span className="text-[10px] text-muted-foreground">
                              {formatSubmittedDate(a.submittedAt)}
                            </span>
                            {actionable && (
                              <div
                                className="flex gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleApprove(a)}
                                  title="Approve"
                                  className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25 transition cursor-pointer"
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenChanges(a)}
                                  title="Request Changes"
                                  className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
                                >
                                  <Flag size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject(a)}
                                  title="Reject"
                                  className="w-6 h-6 rounded-full flex items-center justify-center bg-destructive/15 text-destructive hover:bg-destructive/25 transition cursor-pointer"
                                >
                                  <XCircle size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View matching user screenshot */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Applicant
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Business
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Plan
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Submitted
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-xs text-muted-foreground">
                      No applications match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => {
                    const actionable = a.status === 'pending' || a.status === 'changes_requested';
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-4 font-semibold text-foreground">
                          {a.applicantName}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {a.businessName}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {a.planName}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                          {formatSubmittedDate(a.submittedAt)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {getStatusBadge(a.status)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* View button */}
                            <button
                              type="button"
                              onClick={() => setViewingApp(a)}
                              title="View details"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                            >
                              <Eye size={16} />
                            </button>

                            {actionable ? (
                              <>
                                {/* Approve Button */}
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() => handleApprove(a)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-2xs cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Approve</span>
                                </button>

                                {/* Changes Button */}
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() => handleOpenChanges(a)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition cursor-pointer disabled:opacity-50"
                                >
                                  <Flag size={13} />
                                  <span>Changes</span>
                                </button>

                                {/* Reject Button */}
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={() => handleOpenReject(a)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive border border-destructive/20 hover:bg-destructive/10 transition cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle size={13} />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. View Application Details Modal */}
      {viewingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold">Application Details</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Ref Code: {viewingApp.trackingCode} · Submitted {formatSubmittedDate(viewingApp.submittedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingApp(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 text-xs">
              {/* Primary Contact */}
              <div>
                <h4 className="font-bold text-foreground mb-2 uppercase text-[11px] tracking-wider">
                  Applicant &amp; Representative
                </h4>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="text-muted-foreground block">Name:</span>
                    <span className="font-semibold text-foreground">{viewingApp.applicantName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Email:</span>
                    <span className="font-semibold text-foreground">{viewingApp.businessEmail}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone:</span>
                    <span className="font-semibold text-foreground">{viewingApp.businessPhone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Status:</span>
                    {getStatusBadge(viewingApp.status)}
                  </div>
                </div>
              </div>

              {/* Business Profile */}
              <div>
                <h4 className="font-bold text-foreground mb-2 uppercase text-[11px] tracking-wider">
                  Business Profile
                </h4>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="text-muted-foreground block">Business Name:</span>
                    <span className="font-semibold text-foreground">{viewingApp.businessName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Selected Plan:</span>
                    <span className="font-semibold text-foreground">{viewingApp.planName} (${viewingApp.planPrice}/yr)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Chapter:</span>
                    <span className="font-semibold text-foreground">{viewingApp.chapterName || 'General / Central'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Website:</span>
                    <span className="font-semibold text-foreground">{viewingApp.businessDetails?.website || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Employees:</span>
                    <span className="font-semibold text-foreground">{viewingApp.businessDetails?.employeeCount || '1'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Annual Revenue:</span>
                    <span className="font-semibold text-foreground">
                      {viewingApp.businessDetails?.annualRevenue ? `$${viewingApp.businessDetails.annualRevenue.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reviewer Notes if changes requested or rejected */}
              {viewingApp.adminNotes && (
                <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl">
                  <span className="font-bold text-amber-800 dark:text-amber-200 block mb-1">
                    Reviewer Notes / Feedback:
                  </span>
                  <p className="text-amber-800 dark:text-amber-200">{viewingApp.adminNotes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-2">
              {(viewingApp.status === 'pending' || viewingApp.status === 'changes_requested') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleApprove(viewingApp);
                      setViewingApp(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Approve Application
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const a = viewingApp;
                      setViewingApp(null);
                      handleOpenChanges(a);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const a = viewingApp;
                      setViewingApp(null);
                      handleOpenReject(a);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setViewingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Request Changes Modal (Matching Screenshot 1) */}
      {changesApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Request Changes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {changesApp.applicantName} · {changesApp.businessName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChangesApp(null);
                  setAttachedFiles([]);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tell the applicant exactly what to fix or add. They'll see this note when they track their application, along with an editable form to resubmit.
              </p>

              <div>
                <textarea
                  rows={4}
                  value={changesNotes}
                  onChange={(e) => setChangesNotes(e.target.value)}
                  placeholder="e.g. Please re-enter your business name to match your registration certificate, and provide a working phone number."
                  className="w-full px-3.5 py-3 rounded-xl text-xs md:text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 resize-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-foreground">
                  <Paperclip size={13} className="text-muted-foreground" />
                  <span>Attach reference files</span>
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className={cn(
                    "rounded-xl text-center cursor-pointer transition-colors p-5 border border-dashed",
                    isDragOver
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Paperclip size={18} />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    PDF, JPG or PNG · up to {MAX_FILES} files
                  </p>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/40 border border-border"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                          <FileText size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatSize(f.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(f.id);
                          }}
                          title="Remove file"
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isActionLoading || !changesNotes.trim()}
                onClick={handleSubmitChanges}
                className="w-full mt-2 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                <span>Send Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reject Confirm Modal */}
      {rejectApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden text-foreground p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-destructive">
                Reject Membership Application
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rejecting application for: <strong className="text-foreground">{rejectApp.applicantName}</strong> ({rejectApp.businessName})
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Rejection Reason (Optional)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Business is outside regional operating jurisdiction"
                className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-destructive"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleSubmitReject}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>Reject Application</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
