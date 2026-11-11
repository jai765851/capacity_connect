import React, { useEffect, useMemo, useState } from 'react';
import { Award, Ban, CheckCircle2, Download, Eye, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatFileSize, formatShortDate, triggerSignedDownload } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { storageService, validateStorageUploadFile } from '../../../services/storageService';
import { CertificateRecord, CourseRecord, ProfileRecord } from '../../../types/competency';

function generateCertificateCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CERT-${year}-${suffix}`;
}

export function AdminCertificatesPage() {
  const { currentUser } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [trainees, setTrainees] = useState<ProfileRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'revoked'>('all');

  // Issue certificate modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [certCode, setCertCode] = useState(generateCertificateCode);
  const [traineeId, setTraineeId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [issuing, setIssuing] = useState(false);

  // Inspect / Download / Revoke
  const [inspectCert, setInspectCert] = useState<CertificateRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<CertificateRecord | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [certRows, profileRows, courseRows] = await Promise.all([
        databaseService.listCertificates(),
        databaseService.listAllProfiles(),
        databaseService.listAllCourses(),
      ]);
      const traineeList = profileRows.filter((p) => p.role === 'trainee');
      setCertificates(certRows);
      setTrainees(traineeList);
      setCourses(courseRows);
      if (traineeList.length > 0 && !traineeId) setTraineeId(traineeList[0].id);
      if (courseRows.length > 0 && !courseId) setCourseId(courseRows[0].id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch certificate registry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter((c) => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchQuery =
        !q ||
        c.certificate_code.toLowerCase().includes(q) ||
        (c.trainee?.full_name ?? '').toLowerCase().includes(q) ||
        (c.course?.title ?? '').toLowerCase().includes(q) ||
        (c.course?.code ?? '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [certificates, search, statusFilter]);

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !traineeId || !courseId || !certCode.trim()) {
      setError('Certificate code, trainee, and course are required.');
      return;
    }
    if (certFile) {
      const check = validateStorageUploadFile(certFile, 'certificate');
      if (!check.valid) {
        setError(check.error ?? 'Selected certificate attachment exceeds limits or uses an unsupported format.');
        return;
      }
    }
    setIssuing(true);
    setError(null);
    try {
      const issued = await databaseService.issueCertificate({
        certificate_code: certCode.trim().toUpperCase(),
        trainee_id: traineeId,
        course_id: courseId,
        verified_by: currentUser.id,
        file: certFile,
      });
      setIssueOpen(false);
      setCertCode(generateCertificateCode());
      setCertFile(null);
      setNotice(
        `Issued verified certificate ${issued.certificate_code}${issued.storage_path ? ' with stored attachment' : ''}.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue certificate.');
    } finally {
      setIssuing(false);
    }
  };

  const handleDownloadFile = async (cert: CertificateRecord) => {
    if (!cert.storage_path) return;
    setDownloadingId(cert.id);
    try {
      const url = await storageService.getSignedDownloadUrl('certificates', cert.storage_path, 120, {
        downloadFileName: `${cert.certificate_code}.pdf`,
      });
      triggerSignedDownload(url, `${cert.certificate_code}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve signed certificate URL.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleStatus = async (cert: CertificateRecord) => {
    const nextStatus = cert.status === 'verified' ? 'revoked' : 'verified';
    try {
      await databaseService.updateCertificateStatus(cert.id, nextStatus);
      setNotice(`Certificate ${cert.certificate_code} marked as ${nextStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update certificate status.');
    }
  };

  const columns: DataColumn<CertificateRecord>[] = [
    {
      key: 'code',
      header: 'Certificate ID',
      render: (row) => (
        <span className="font-mono text-xs text-[#0F766E]">{row.certificate_code}</span>
      ),
    },
    {
      key: 'trainee',
      header: 'Trainee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.trainee?.full_name ?? 'Trainee'}</p>
          <p className="text-xs text-slate-500">{row.trainee?.department || '—'}</p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Verified Course',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">
            {row.course?.code} — {row.course?.title}
          </p>
          <p className="text-slate-500">{row.course?.domain ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'verifier',
      header: 'Verified By',
      render: (row) => (
        <span className="text-xs text-slate-700">{row.verifier?.full_name ?? 'Portal Authority'}</span>
      ),
    },
    {
      key: 'issued',
      header: 'Issued Date',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">{formatShortDate(row.issued_at)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs font-semibold capitalize ${
            row.status === 'verified' ? 'text-[#0F766E]' : 'text-red-700'
          }`}
        >
          {row.status}
        </span>
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
            onClick={() => setInspectCert(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Record</span>
          </button>
          {row.storage_path && (
            <button
              type="button"
              disabled={downloadingId === row.id}
              onClick={() => handleDownloadFile(row)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0F766E] hover:text-[#0B1F3A] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>File</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatusToggleTarget(row)}
            className={`inline-flex items-center gap-1 text-xs font-medium cursor-pointer ${
              row.status === 'verified'
                ? 'text-red-700 hover:text-red-900'
                : 'text-[#0F766E] hover:text-[#0B1F3A]'
            }`}
          >
            {row.status === 'verified' ? (
              <>
                <Ban className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reinstate</span>
              </>
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Certificates</h1>
          <p className="text-sm text-slate-600 mt-1">
            Registry of verified competency certificates issued following Stage 05 reassessment
            sign-off.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setCertCode(generateCertificateCode());
            setIssueOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Issue Certificate</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Certificate Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Registry Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search certificates by ID, trainee, or course..."
        rightSlot={
          <select
            aria-label="Filter certificates by verification status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'verified' | 'revoked')}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="revoked">Revoked</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No certificates issued yet"
        emptyDescription="Issue certificates above or when Trainers evaluate Stage 05 reassessment submissions."
      />

      {/* Issue Certificate Modal */}
      <ModalDrawer
        isOpen={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue Verified Competency Certificate"
        subtitle="Persists metadata to `certificates` and optional PDF to private Storage bucket `certificates`"
      >
        <form onSubmit={handleIssueCertificate} className="space-y-4">
          <TextField
            htmlFor="cert-code"
            label="Certificate Verification Code"
            required
            value={certCode}
            onChange={(e) => setCertCode(e.target.value)}
            placeholder="CERT-2026-XXXXXX"
          />

          <SelectField
            htmlFor="cert-trainee"
            label="Recipient Trainee"
            value={traineeId}
            onChange={(e) => setTraineeId(e.target.value)}
          >
            {trainees.length === 0 ? (
              <option value="">No trainee profiles found</option>
            ) : (
              trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.department || t.email})
                </option>
              ))
            )}
          </SelectField>

          <SelectField
            htmlFor="cert-course"
            label="Completed Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.length === 0 ? (
              <option value="">No courses found</option>
            ) : (
              courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))
            )}
          </SelectField>

          <div className="space-y-1.5">
            <label htmlFor="cert-file" className="block text-sm font-medium text-slate-800">
              Attach Signed Certificate Document (Optional PDF)
            </label>
            <input
              id="cert-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                if (picked) {
                  const check = validateStorageUploadFile(picked, 'certificate');
                  if (!check.valid) {
                    setError(check.error ?? 'Unsupported certificate attachment format or size.');
                    setCertFile(null);
                    return;
                  }
                }
                setError(null);
                setCertFile(picked);
              }}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-[#0B1F3A] hover:file:bg-slate-100 cursor-pointer"
            />
            <p className="text-xs text-slate-500">
              Accepted certificate attachments: .pdf, .png, .jpg, .jpeg (up to 10 MB).
            </p>
            {certFile && (
              <p className="text-xs font-mono text-slate-500">
                Selected: {certFile.name} ({formatFileSize(certFile.size)})
              </p>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={issuing || trainees.length === 0 || courses.length === 0}
            >
              {issuing ? 'Issuing...' : 'Issue Certificate'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      {/* Inspect Verification Record Modal */}
      <ModalDrawer
        isOpen={Boolean(inspectCert)}
        onClose={() => setInspectCert(null)}
        title="Institutional Verification Record"
        subtitle={inspectCert?.certificate_code}
      >
        {inspectCert && (
          <div className="rounded-lg border-2 border-[#0B1F3A] p-6 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs font-semibold text-[#0F766E]">
                CAPACITY CONNECT · SIH26075
              </p>
              <Award className="w-5 h-5 text-[#0B1F3A]" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Awarded To</p>
              <p className="font-display text-xl font-bold text-[#0B1F3A]">
                {inspectCert.trainee?.full_name ?? 'Trainee'}
              </p>
              <p className="text-xs text-slate-600">
                {inspectCert.trainee?.designation || 'Officer'} ·{' '}
                {inspectCert.trainee?.department || 'Organisation'}
              </p>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500">Completed Programme</p>
              <p className="font-display text-base font-semibold text-slate-900">
                {inspectCert.course?.code} — {inspectCert.course?.title}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Domain: {inspectCert.course?.domain} · Duration: {inspectCert.course?.duration_hours} Hours
              </p>
            </div>
            <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Code</p>
                <p className="font-mono font-semibold text-slate-900">
                  {inspectCert.certificate_code}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p
                  className={`font-semibold capitalize ${
                    inspectCert.status === 'verified' ? 'text-[#0F766E]' : 'text-red-700'
                  }`}
                >
                  {inspectCert.status}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Issued Date</p>
                <p className="font-mono font-semibold text-slate-900">
                  {formatShortDate(inspectCert.issued_at)}
                </p>
              </div>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(statusToggleTarget)}
        onClose={() => setStatusToggleTarget(null)}
        onConfirm={() => {
          if (statusToggleTarget) handleToggleStatus(statusToggleTarget);
        }}
        tone={statusToggleTarget?.status === 'verified' ? 'danger' : 'primary'}
        title={
          statusToggleTarget?.status === 'verified'
            ? 'Revoke verified certificate?'
            : 'Reinstate certificate verification?'
        }
        description={
          statusToggleTarget?.status === 'verified'
            ? `Revoke verification status for certificate ${statusToggleTarget.certificate_code} (${statusToggleTarget.trainee?.full_name ?? 'Trainee'})?`
            : `Reinstate verified status for certificate ${statusToggleTarget?.certificate_code ?? ''}?`
        }
        confirmLabel={
          statusToggleTarget?.status === 'verified' ? 'Revoke Certificate' : 'Reinstate Certificate'
        }
      />
    </div>
  );
}
