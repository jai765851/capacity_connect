import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTime } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { NotificationAudience, NotificationRecord } from '../../../types/competency';

export function AdminAnnouncementsPage() {
  const { currentUser } = useAuth();
  const [notices, setNotices] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<Exclude<NotificationAudience, 'User'>>('All Roles');
  const [priority, setPriority] = useState<'Standard' | 'Important'>('Standard');
  const [body, setBody] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState(false);

  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'All' | NotificationAudience>('All');
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [inspectNotice, setInspectNotice] = useState<NotificationRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRecord | null>(null);

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const rows = await databaseService.listNotifications();
      setNotices(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch announcements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notices.filter((n) => {
      const matchAudience = audienceFilter === 'All' || n.audience === audienceFilter;
      const matchQuery =
        !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
      return matchAudience && matchQuery;
    });
  }, [notices, search, audienceFilter]);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Announcement title is required.';
    if (body.trim().length < 15) {
      next.body = 'Provide at least 15 characters for the announcement message.';
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setConfirmPublishOpen(true);
  };

  const handlePublish = async () => {
    if (!currentUser) return;
    setPublishing(true);
    setError(null);
    try {
      const created = await databaseService.createNotification({
        audience,
        priority,
        title: title.trim(),
        body: body.trim(),
        created_by: currentUser.id,
      });
      setNotices((prev) => [created, ...prev]);
      setTitle('');
      setBody('');
      setNoticeBanner(`Published "${created.title}" to ${created.audience}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish announcement.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (row: NotificationRecord) => {
    try {
      await databaseService.deleteNotification(row.id);
      setNotices((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete notice.');
    }
  };

  const columns: DataColumn<NotificationRecord>[] = [
    {
      key: 'title',
      header: 'Notice Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{row.body}</p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => <span className="text-xs text-slate-700">{row.audience}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span
          className={`text-xs font-semibold ${
            row.priority === 'Important' ? 'text-amber-700' : 'text-slate-600'
          }`}
        >
          {row.priority}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Published',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInspectNotice(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Read</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
          Announcements &amp; Inquiries
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Publish role-scoped notices to PostgreSQL `notifications` and review incoming contact
          inquiries.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Notification Error" description={error} />}
      {noticeBanner && (
        <StatusBanner tone="success" title="Announcement Published" description={noticeBanner} />
      )}

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleValidate} noValidate className="space-y-4">
          <TextField
            htmlFor="ann-title"
            label="Announcement Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={fieldErrors.title}
            placeholder="e.g. Q3 Competency Baseline Diagnostic Schedule"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="ann-audience"
              label="Target Audience"
              value={audience}
              onChange={(e) =>
                setAudience(e.target.value as Exclude<NotificationAudience, 'User'>)
              }
            >
              <option value="All Roles">All Roles</option>
              <option value="Trainees Only">Trainees Only</option>
              <option value="Trainers Only">Trainers Only</option>
              <option value="Admins Only">Admins Only</option>
            </SelectField>
            <SelectField
              htmlFor="ann-priority"
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'Standard' | 'Important')}
            >
              <option value="Standard">Standard</option>
              <option value="Important">Important</option>
            </SelectField>
          </div>

          <TextareaField
            htmlFor="ann-body"
            label="Notice Content"
            required
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={fieldErrors.body}
            placeholder="Write the official notice for portal users..."
          />

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={publishing}>
              {publishing ? 'Publishing...' : 'Publish Announcement'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        <WorkspaceFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search announcements and contact inquiries..."
          rightSlot={
            <select
              aria-label="Filter announcements by audience"
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value as 'All' | NotificationAudience)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Audiences</option>
              <option value="All Roles">All Roles</option>
              <option value="Trainees Only">Trainees Only</option>
              <option value="Trainers Only">Trainers Only</option>
              <option value="Admins Only">Admins Only (Incl. Inquiries)</option>
            </select>
          }
        />

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No announcements or inquiries found"
          emptyDescription="Publish a portal announcement above or wait for institutional contact submissions."
        />
      </div>

      <ModalDrawer
        isOpen={Boolean(inspectNotice)}
        onClose={() => setInspectNotice(null)}
        title={inspectNotice?.title ?? 'Notice Details'}
        subtitle={
          inspectNotice
            ? `${inspectNotice.audience} · ${inspectNotice.priority} · ${formatDateTime(inspectNotice.created_at)}`
            : ''
        }
      >
        {inspectNotice && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {inspectNotice.body}
            </p>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setInspectNotice(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={confirmPublishOpen}
        onClose={() => setConfirmPublishOpen(false)}
        onConfirm={handlePublish}
        title="Publish announcement?"
        description={`Confirm publishing "${title.trim()}" to ${audience} in PostgreSQL?`}
        confirmLabel="Publish Notice"
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        tone="danger"
        title="Delete announcement?"
        description={`Remove "${deleteTarget?.title ?? ''}" from PostgreSQL notifications?`}
        confirmLabel="Delete"
      />
    </div>
  );
}
