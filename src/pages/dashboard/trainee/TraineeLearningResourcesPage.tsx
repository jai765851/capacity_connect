import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { formatFileSize, formatShortDate, triggerSignedDownload } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { storageService } from '../../../services/storageService';
import { LearningResourceRecord } from '../../../types/competency';

export function TraineeLearningResourcesPage() {
  const [resources, setResources] = useState<LearningResourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const [previewTarget, setPreviewTarget] = useState<LearningResourceRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    databaseService
      .listLearningResources()
      .then((rows) => {
        setResources(rows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch learning resources.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((res) => {
      const matchesType = typeFilter === 'All' || res.material_type === typeFilter;
      const matchesSearch =
        !q ||
        res.title.toLowerCase().includes(q) ||
        res.file_name.toLowerCase().includes(q) ||
        (res.course?.code ?? '').toLowerCase().includes(q) ||
        (res.course?.title ?? '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [resources, search, typeFilter]);

  const handleOpenPreview = async (resource: LearningResourceRecord) => {
    setPreviewTarget(resource);
    setPreviewUrl(null);
    setLoadingPreview(true);
    try {
      const signed = await storageService.getSignedDownloadUrl(
        'learning-resources',
        resource.storage_path,
        300
      );
      setPreviewUrl(signed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open inline preview. Ensure storage policies in migrations 003 and 006 are active.'
      );
      setPreviewTarget(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (resource: LearningResourceRecord) => {
    setDownloadingId(resource.id);
    try {
      const signedUrl = await storageService.getSignedDownloadUrl(
        'learning-resources',
        resource.storage_path,
        120,
        { downloadFileName: resource.file_name }
      );
      triggerSignedDownload(signedUrl, resource.file_name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate signed download link. Ensure storage migration 003_storage_buckets.sql has been applied.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const isVideoResource = (res: LearningResourceRecord) =>
    res.material_type === 'Video Lecture' || res.mime_type.startsWith('video/');

  const isPdfOrTextPreviewable = (res: LearningResourceRecord) => {
    const lower = res.file_name.toLowerCase();
    return (
      res.mime_type === 'application/pdf' ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.md')
    );
  };

  const columns: DataColumn<LearningResourceRecord>[] = [
    {
      key: 'course',
      header: 'Course',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.course?.code ?? '—'}</span>
          <p className="text-xs text-slate-600">{row.course?.title ?? 'Course'}</p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Resource Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="font-mono text-xs text-slate-500 mt-0.5">{row.file_name}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Format',
      render: (row) => <span className="text-xs text-slate-700">{row.material_type}</span>,
    },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {formatFileSize(row.file_size_bytes)}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Uploaded',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.created_at)}</span>
      ),
    },
    {
      key: 'download',
      header: 'Access',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenPreview(row)}>
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={downloadingId === row.id}
            onClick={() => handleDownload(row)}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingId === row.id ? 'Preparing...' : 'Download'}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Learning Resources</h1>
        <p className="text-sm text-slate-600 mt-1">
          Reference manuals, slide decks, video lectures, and case exercises served via private
          Supabase Storage signed URLs.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Storage / Database Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search resource title, course code, or filename..."
        rightSlot={
          <select
            aria-label="Filter by resource format"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Resource Types</option>
            <option value="Reference Manual">Reference Manual</option>
            <option value="Slide Deck">Slide Deck</option>
            <option value="Video Lecture">Video Lecture</option>
            <option value="Case Exercise">Case Exercise</option>
            <option value="Policy Document">Policy Document</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No learning resources available"
        emptyDescription="Authorised study guides, presentations, and video lectures for your enrolled courses appear here."
      />

      <ModalDrawer
        isOpen={Boolean(previewTarget)}
        onClose={() => {
          setPreviewTarget(null);
          setPreviewUrl(null);
        }}
        title={previewTarget?.title ?? 'Learning Material Preview'}
        subtitle={
          previewTarget
            ? `${previewTarget.course?.code ?? 'Course'} · ${previewTarget.material_type} · ${formatFileSize(previewTarget.file_size_bytes)}`
            : undefined
        }
      >
        {previewTarget && (
          <div className="space-y-4">
            {loadingPreview ? (
              <p className="text-sm text-slate-500">Generating temporary signed URL...</p>
            ) : !previewUrl ? (
              <p className="text-sm text-red-700">Preview URL could not be generated.</p>
            ) : isVideoResource(previewTarget) ? (
              <video
                controls
                className="w-full max-h-[60vh] rounded-md bg-slate-950 border border-slate-200"
                src={previewUrl}
              />
            ) : isPdfOrTextPreviewable(previewTarget) ? (
              <iframe
                title={previewTarget.title}
                src={previewUrl}
                className="w-full h-[65vh] rounded-md border border-slate-200 bg-white"
              />
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-3">
                <p>
                  Inline browser preview is unavailable for{' '}
                  <span className="font-mono">{previewTarget.file_name}</span>. Download a signed
                  copy to inspect it locally.
                </p>
                <Button variant="primary" size="sm" onClick={() => handleDownload(previewTarget)}>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Copy</span>
                </Button>
              </div>
            )}
            {previewUrl && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleDownload(previewTarget)}>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Copy</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
