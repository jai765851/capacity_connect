import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { formatFileSize, formatShortDate, triggerSignedDownload } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { storageService, validateStorageUploadFile } from '../../../services/storageService';
import {
  CourseRecord,
  LearningMaterialType,
  LearningResourceRecord,
  TrainerAssignmentRecord,
} from '../../../types/competency';

function getAcceptAttribute(materialType: LearningMaterialType): string {
  if (materialType === 'Video Lecture') return '.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime';
  if (materialType === 'Slide Deck') return '.pdf,.ppt,.pptx,.odp,.key';
  return '.pdf,.doc,.docx,.csv,.txt,.xlsx,.md';
}

function getFormatHelperText(materialType: LearningMaterialType): string {
  if (materialType === 'Video Lecture') return 'Accepted video formats: .mp4, .webm, .mov (up to 100 MB).';
  if (materialType === 'Slide Deck') return 'Accepted slide formats: .pdf, .ppt, .pptx, .odp, .key (up to 25 MB).';
  return 'Accepted document formats: .pdf, .doc, .docx, .csv, .txt, .xlsx, .md (up to 25 MB).';
}

export function TrainerUploadMaterialsPage() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainerAssignmentRecord[]>([]);
  const [resources, setResources] = useState<LearningResourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [materialType, setMaterialType] = useState<LearningMaterialType>('Reference Manual');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LearningResourceRecord | null>(null);

  const [previewTarget, setPreviewTarget] = useState<LearningResourceRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectableCourses = useMemo(() => {
    const assignedCourseIds = new Set(assignments.map((a) => a.course_id));
    return courses.filter(
      (c) => c.created_by === currentUser?.id || assignedCourseIds.has(c.id)
    );
  }, [courses, assignments, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listAllCourses(),
      databaseService.listTrainerAssignments(currentUser.id),
      databaseService.listLearningResources(),
    ])
      .then(([courseRows, assignmentRows, resourceRows]) => {
        setCourses(courseRows);
        setAssignments(assignmentRows);
        setResources(resourceRows);
        const assignedIds = new Set(assignmentRows.map((a) => a.course_id));
        const scoped = courseRows.filter(
          (c) => c.created_by === currentUser.id || assignedIds.has(c.id)
        );
        if (scoped.length > 0 && !courseId) {
          setCourseId(scoped[0].id);
        }
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch courses and materials.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!courseId || title.trim().length < 3 || !selectedFile) {
      setError('Select an authorised course, enter a descriptive resource title (>= 3 chars), and attach a file.');
      return;
    }

    const validation = validateStorageUploadFile(selectedFile, materialType);
    if (!validation.valid) {
      setError(validation.error ?? 'Selected file does not match allowed format or size limits.');
      return;
    }

    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const inserted = await databaseService.uploadLearningResource({
        course_id: courseId,
        title: title.trim(),
        material_type: materialType,
        uploaded_by: currentUser.id,
        file: selectedFile,
      });
      setResources((prev) => [inserted, ...prev]);
      setTitle('');
      setSelectedFile(null);
      setNotice(
        `Uploaded "${inserted.file_name}" to private Supabase Storage bucket \`learning-resources\`.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Upload failed. Ensure migrations 003 and 006 are executed in Supabase.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = async (res: LearningResourceRecord) => {
    setPreviewTarget(res);
    setPreviewUrl(null);
    setLoadingPreview(true);
    try {
      const signed = await storageService.getSignedDownloadUrl(
        'learning-resources',
        res.storage_path,
        300
      );
      setPreviewUrl(signed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate inline preview URL.');
      setPreviewTarget(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (res: LearningResourceRecord) => {
    try {
      const url = await storageService.getSignedDownloadUrl('learning-resources', res.storage_path, 120, {
        downloadFileName: res.file_name,
      });
      triggerSignedDownload(url, res.file_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate signed download URL.');
    }
  };

  const handleDelete = async (res: LearningResourceRecord) => {
    try {
      await databaseService.deleteLearningResource(res);
      setResources((prev) => prev.filter((item) => item.id !== res.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete learning resource.');
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
        <span className="font-mono text-xs text-[#0F766E]">{row.course?.code ?? '—'}</span>
      ),
    },
    {
      key: 'title',
      header: 'Resource Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="font-mono text-xs text-slate-500">{row.file_name}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Format',
      render: (row) => <span className="text-xs text-slate-600">{row.material_type}</span>,
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
      key: 'uploaded',
      header: 'Date',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenPreview(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          {row.uploaded_by === currentUser?.id && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Upload Materials</h1>
        <p className="text-sm text-slate-600 mt-1">
          Upload PDFs, slide decks, policy briefs, and video lectures to courses you authored or
          deliver.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Storage Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Upload Complete" description={notice} />}

      {!isLoading && selectableCourses.length === 0 && (
        <StatusBanner
          tone="warning"
          title="No Authored or Cohort-Assigned Courses"
          description="Resource uploads are restricted to courses you created or cohorts assigned to you by an Administrator. Create a course under Create Course or request a cohort assignment."
        />
      )}

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleUpload} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="mat-course"
              label="Authorised Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {selectableCourses.length === 0 ? (
                <option value="">No authored or assigned courses</option>
              ) : (
                selectableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))
              )}
            </SelectField>
            <SelectField
              htmlFor="mat-type"
              label="Material Format"
              value={materialType}
              onChange={(e) => {
                setMaterialType(e.target.value as LearningMaterialType);
                setSelectedFile(null);
              }}
            >
              <option value="Reference Manual">Reference Manual</option>
              <option value="Slide Deck">Slide Deck</option>
              <option value="Video Lecture">Video Lecture</option>
              <option value="Case Exercise">Case Exercise</option>
              <option value="Policy Document">Policy Document</option>
            </SelectField>
          </div>

          <TextField
            htmlFor="mat-title"
            label="Material Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GFR Expenditure Checklist & Session Recording"
          />

          <div className="space-y-1.5">
            <label htmlFor="mat-file" className="block text-sm font-medium text-slate-800">
              Select File <span className="text-red-600">*</span>
            </label>
            <input
              id="mat-file"
              type="file"
              accept={getAcceptAttribute(materialType)}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-[#0B1F3A] hover:file:bg-slate-100 cursor-pointer"
            />
            <p className="text-xs text-slate-500">{getFormatHelperText(materialType)}</p>
            {selectedFile && (
              <p className="text-xs text-slate-600 font-mono">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={uploading || selectableCourses.length === 0}
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading to Storage...' : 'Upload Material'}</span>
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={resources}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No learning materials uploaded yet"
        emptyDescription="Attach PDFs, slides, or video lectures above to store them securely in Supabase Storage."
      />

      <ModalDrawer
        isOpen={Boolean(previewTarget)}
        onClose={() => {
          setPreviewTarget(null);
          setPreviewUrl(null);
        }}
        title={previewTarget?.title ?? 'Material Preview'}
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
                  Inline browser preview is unavailable for <span className="font-mono">{previewTarget.file_name}</span>. Use the download button below to open it locally.
                </p>
                <Button variant="primary" size="sm" onClick={() => handleDownload(previewTarget)}>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
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

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        title="Remove uploaded material?"
        description={`Delete "${deleteTarget?.title}" and its stored file from Supabase Storage?`}
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
