import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Download, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate, triggerSignedDownload } from '../../../lib/formatters';
import { computeCourseCertificateEligibility } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import { storageService } from '../../../services/storageService';
import {
  AssessmentAttemptRecord,
  AssessmentRecord,
  CertificateRecord,
  CourseCertificateEligibility,
  EnrollmentRecord,
} from '../../../types/competency';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadCertificateSvgRecord(cert: CertificateRecord, recipientName: string, subtitle: string) {
  const safeRecipient = escapeXml(recipientName || 'Trainee');
  const safeSub = escapeXml(subtitle || 'CAPACITY CONNECT Portal Member');
  const safeCourse = escapeXml(`${cert.course?.code ?? ''} — ${cert.course?.title ?? 'Completed Programme'}`);
  const safeDomain = escapeXml(`${cert.course?.domain ?? 'Institutional Competency'} · ${cert.course?.duration_hours ?? 0} Hours`);
  const safeCode = escapeXml(cert.certificate_code);
  const safeIssued = escapeXml(formatShortDate(cert.issued_at));
  const safeVerifier = escapeXml(cert.verifier?.full_name ?? 'CAPACITY CONNECT Authority');

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="760" viewBox="0 0 1120 760">
  <rect width="1120" height="760" fill="#F8FAFC"/>
  <rect x="32" y="32" width="1056" height="696" fill="#FFFFFF" stroke="#0B1F3A" stroke-width="4"/>
  <rect x="46" y="46" width="1028" height="668" fill="none" stroke="#CBD5E1" stroke-width="1.5"/>
  <rect x="46" y="46" width="1028" height="12" fill="#0B1F3A"/>
  <text x="90" y="112" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#0F766E" letter-spacing="2">CAPACITY CONNECT · SIH26075 COMPETENCY REGISTRY</text>
  <text x="90" y="168" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="700" fill="#0B1F3A">Certificate of Competency Completion</text>
  <line x1="90" y1="196" x2="1030" y2="196" stroke="#E2E8F0" stroke-width="2"/>
  <text x="90" y="254" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#475569">This verification record certifies that</text>
  <text x="90" y="308" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="#0B1F3A">${safeRecipient}</text>
  <text x="90" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#475569">${safeSub}</text>
  <text x="90" y="408" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#475569">has successfully completed all coursework and Stage 05 assessment requirements for</text>
  <text x="90" y="454" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" fill="#0F766E">${safeCourse}</text>
  <text x="90" y="488" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#475569">${safeDomain}</text>
  <line x1="90" y1="560" x2="1030" y2="560" stroke="#E2E8F0" stroke-width="2"/>
  <text x="90" y="608" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748B">VERIFICATION CODE</text>
  <text x="90" y="636" font-family="ui-monospace, monospace" font-size="18" font-weight="700" fill="#0B1F3A">${safeCode}</text>
  <text x="450" y="608" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748B">ISSUED DATE</text>
  <text x="450" y="636" font-family="ui-monospace, monospace" font-size="18" font-weight="700" fill="#0B1F3A">${safeIssued}</text>
  <text x="760" y="608" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748B">VERIFIED BY</text>
  <text x="760" y="636" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#0B1F3A">${safeVerifier}</text>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${cert.certificate_code}.svg`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export function TraineeCertificatesPage() {
  const { currentUser } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inspectCert, setInspectCert] = useState<CertificateRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [claimingCourseId, setClaimingCourseId] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [certRows, enrollmentRows, assessmentRows, attemptRows] = await Promise.all([
        databaseService.listCertificates(currentUser.id),
        databaseService.listEnrollments({ traineeId: currentUser.id }),
        databaseService.listAssessments({ publishedOnly: true }),
        databaseService.listAssessmentAttempts({ traineeId: currentUser.id }),
      ]);
      setCertificates(certRows);
      setEnrollments(enrollmentRows);
      setAssessments(assessmentRows);
      setAttempts(attemptRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch certificates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const eligibilityList = useMemo(
    () =>
      computeCourseCertificateEligibility({
        enrollments,
        assessments,
        attempts,
        certificates,
      }),
    [enrollments, assessments, attempts, certificates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter(
      (cert) =>
        !q ||
        cert.certificate_code.toLowerCase().includes(q) ||
        (cert.course?.title ?? '').toLowerCase().includes(q) ||
        (cert.course?.code ?? '').toLowerCase().includes(q)
    );
  }, [certificates, search]);

  const handleClaimCertificate = async (courseId: string) => {
    setClaimingCourseId(courseId);
    setError(null);
    setClaimNotice(null);
    try {
      const { certificate, alreadyIssued } = await databaseService.claimEligibleCertificate(courseId);
      setClaimNotice(
        alreadyIssued
          ? `Certificate ${certificate.certificate_code} is already issued for ${certificate.course?.title ?? 'this course'}.`
          : `Issued verified completion certificate ${certificate.certificate_code} for ${certificate.course?.title ?? 'completed course'}.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim completion certificate.');
    } finally {
      setClaimingCourseId(null);
    }
  };

  const handleDownloadAttachment = async (cert: CertificateRecord) => {
    if (!cert.storage_path) return;
    setDownloadingId(cert.id);
    try {
      const url = await storageService.getSignedDownloadUrl('certificates', cert.storage_path, 120, {
        downloadFileName: `${cert.certificate_code}.pdf`,
      });
      triggerSignedDownload(url, `${cert.certificate_code}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch signed certificate file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const eligibilityColumns: DataColumn<CourseCertificateEligibility>[] = [
    {
      key: 'course',
      header: 'Enrolled Course',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.courseCode}</span>
          <p className="font-medium text-slate-900">{row.courseTitle}</p>
          <p className="text-xs text-slate-500">{row.courseDomain}</p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Completion',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-800">
          {row.progressPercent}%
        </span>
      ),
    },
    {
      key: 'assessments',
      header: 'Course Assessments',
      render: (row) => (
        <span className="text-xs text-slate-700 font-mono tabular-nums">
          {row.requiredAssessmentsCount === 0
            ? 'None linked'
            : `${row.passedAssessmentsCount}/${row.requiredAssessmentsCount} passed`}
        </span>
      ),
    },
    {
      key: 'eligibility',
      header: 'Status / Action',
      align: 'right',
      render: (row) => {
        if (row.alreadyIssuedCertificate) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectCert(row.alreadyIssuedCertificate)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Issued ({row.alreadyIssuedCertificate.certificate_code})</span>
            </Button>
          );
        }
        if (row.eligibleForClaim) {
          return (
            <Button
              variant="teal"
              size="sm"
              disabled={claimingCourseId === row.courseId}
              onClick={() => handleClaimCertificate(row.courseId)}
            >
              <Award className="w-3.5 h-3.5" />
              <span>
                {claimingCourseId === row.courseId
                  ? 'Issuing...'
                  : 'Claim Completion Certificate'}
              </span>
            </Button>
          );
        }
        return <span className="text-xs text-slate-500">{row.blockingReason ?? 'In progress'}</span>;
      },
    },
  ];

  const columns: DataColumn<CertificateRecord>[] = [
    {
      key: 'code',
      header: 'Certificate ID',
      render: (row) => (
        <span className="font-mono text-xs text-[#0F766E]">{row.certificate_code}</span>
      ),
    },
    {
      key: 'course',
      header: 'Verified Course',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.course?.title ?? 'Course'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.course?.domain ?? ''}</p>
        </div>
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
      key: 'verifier',
      header: 'Verified By',
      render: (row) => (
        <span className="text-xs text-slate-700">{row.verifier?.full_name ?? 'Portal Authority'}</span>
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
        <div className="inline-flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInspectCert(row)}>
            <Eye className="w-3.5 h-3.5" />
            <span>View Record</span>
          </Button>
          {row.storage_path && (
            <Button
              variant="primary"
              size="sm"
              disabled={downloadingId === row.id}
              onClick={() => handleDownloadAttachment(row)}
            >
              <Download className="w-3.5 h-3.5" />
              <span>File</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Certificates</h1>
        <p className="text-sm text-slate-600 mt-1">
          Competency completion certificates verified upon 100% progress and Stage 05 reassessment
          closure.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Certificate Error" description={error} />}
      {claimNotice && (
        <StatusBanner tone="success" title="Certificate Issued" description={claimNotice} />
      )}

      {eligibilityList.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#0B1F3A]">
            Eligible Completion Certificates
          </h2>
          <DataTable
            columns={eligibilityColumns}
            rows={eligibilityList}
            rowKey={(row) => row.enrollmentId}
            isLoading={isLoading}
            emptyTitle="No active course enrolments"
            emptyDescription="Enrol in published courses to track completion certificate eligibility."
          />
        </div>
      )}

      <div className="space-y-4">
        <WorkspaceFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search issued certificates by verification code or course..."
        />

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No verified certificates issued yet"
          emptyDescription="Claim eligible completion certificates above or receive certificates signed off by Administrators and Trainers."
        />
      </div>

      <ModalDrawer
        isOpen={Boolean(inspectCert)}
        onClose={() => setInspectCert(null)}
        title="Institutional Verification Record"
        subtitle={inspectCert?.certificate_code}
      >
        {inspectCert && (
          <div className="space-y-5">
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
                  {currentUser?.fullName}
                </p>
                <p className="text-xs text-slate-600">
                  {currentUser?.designation} · {currentUser?.department}
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
              <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Verification Code</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {inspectCert.certificate_code}
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

            <div className="flex flex-wrap items-center justify-end gap-2">
              {inspectCert.storage_path && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === inspectCert.id}
                  onClick={() => handleDownloadAttachment(inspectCert)}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Signed Attachment</span>
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  downloadCertificateSvgRecord(
                    inspectCert,
                    currentUser?.fullName ?? 'Trainee',
                    `${currentUser?.designation || 'Participant'} · ${currentUser?.department || 'Organisation'}`
                  )
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Verification Record (SVG)</span>
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
