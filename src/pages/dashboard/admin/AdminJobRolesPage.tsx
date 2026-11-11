import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { clampScore, normalizeRequiredScore, scoreToProficiencyLevel } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import { CompetencyRecord, JobRoleRecord, RoleRequirementRecord } from '../../../types/competency';

export function AdminJobRolesPage() {
  const { currentUser } = useAuth();
  const [roles, setRoles] = useState<JobRoleRecord[]>([]);
  const [requirements, setRequirements] = useState<RoleRequirementRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<JobRoleRecord | null>(null);

  // New Job Role form
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Officer Grade I');
  const [description, setDescription] = useState('');
  const [submittingRole, setSubmittingRole] = useState(false);

  // Map Role Requirements drawer
  const [activeRoleForMapping, setActiveRoleForMapping] = useState<JobRoleRecord | null>(null);
  const [reqCompId, setReqCompId] = useState('');
  const [reqScore, setReqScore] = useState<number>(75);
  const [reqPriority, setReqPriority] = useState<'core' | 'supporting'>('core');
  const [savingReq, setSavingReq] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [roleRows, reqRows, compRows] = await Promise.all([
        databaseService.listJobRoles(),
        databaseService.listRoleRequirements(),
        databaseService.listCompetencies(),
      ]);
      setRoles(roleRows);
      setRequirements(reqRows);
      setCompetencies(compRows);
      if (compRows.length > 0 && !reqCompId) {
        setReqCompId(compRows[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load job roles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(
      (r) =>
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
    );
  }, [roles, search]);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!code.trim() || !title.trim() || !department.trim()) {
      setError('Role code, title, and department are required.');
      return;
    }

    setSubmittingRole(true);
    setError(null);
    try {
      const inserted = await databaseService.createJobRole({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        department: department.trim(),
        grade_level: gradeLevel.trim(),
        description: description.trim(),
        created_by: currentUser.id,
      });
      setRoles((prev) => [...prev, inserted]);
      setCode('');
      setTitle('');
      setDepartment('');
      setDescription('');
      setCreateRoleOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job role.');
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (row: JobRoleRecord) => {
    try {
      await databaseService.deleteJobRole(row.id);
      setRoles((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete job role.');
    }
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoleForMapping || !reqCompId) return;
    setSavingReq(true);
    setError(null);
    const cleanScore = clampScore(reqScore);
    try {
      const saved = await databaseService.upsertRoleRequirement({
        job_role_id: activeRoleForMapping.id,
        competency_id: reqCompId,
        required_score: cleanScore,
        required_level: scoreToProficiencyLevel(cleanScore),
        priority: reqPriority,
      });
      setRequirements((prev) => {
        const filteredPrev = prev.filter((item) => item.id !== saved.id);
        return [...filteredPrev, saved];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to map competency requirement.');
    } finally {
      setSavingReq(false);
    }
  };

  const handleRemoveRequirement = async (reqId: string) => {
    try {
      await databaseService.deleteRoleRequirement(reqId);
      setRequirements((prev) => prev.filter((r) => r.id !== reqId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove mapping.');
    }
  };

  const activeRoleReqs = useMemo(
    () => requirements.filter((r) => r.job_role_id === activeRoleForMapping?.id),
    [requirements, activeRoleForMapping]
  );

  const columns: DataColumn<JobRoleRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Job Role Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500">{row.grade_level}</p>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Department',
      render: (row) => <span className="text-slate-600">{row.department}</span>,
    },
    {
      key: 'mapped',
      header: 'Required Competencies (0–100)',
      render: (row) => {
        const mapped = requirements.filter((r) => r.job_role_id === row.id);
        return mapped.length > 0 ? (
          <div className="space-y-0.5 text-xs text-slate-700">
            {mapped.map((m) => (
              <div key={m.id} className="font-mono tabular-nums">
                <span className="text-[#0F766E]">{m.competency?.code ?? 'COMP'}</span>
                <span className="text-slate-600 ml-1">
                  · Req {normalizeRequiredScore(m)}/100 (L{m.required_level})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-amber-700">No baseline mapped</span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveRoleForMapping(row)}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Requirements</span>
          </Button>
          <button
            type="button"
            onClick={() => setDeleteRoleTarget(row)}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Job Roles</h1>
          <p className="text-sm text-slate-600 mt-1">
            Stage 01 organisational designations mapped to `role_requirements` target levels.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setCreateRoleOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Define Job Role</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search job roles by code, title, or department..."
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No organisational job roles defined"
        emptyDescription="Define designations and map Required Competencies to drive Stage 03 Skill Gap Reports."
      />

      {/* Create Job Role Drawer */}
      <ModalDrawer
        isOpen={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        title="Define Organisational Job Role"
        subtitle="Persists to PostgreSQL `job_roles`"
      >
        <form onSubmit={handleAddRole} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="jr-code"
              label="Role Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ROLE-AUD-02"
            />
            <TextField
              htmlFor="jr-grade"
              label="Cadre / Grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            />
          </div>
          <TextField
            htmlFor="jr-title"
            label="Role Designation Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Junior Accounts Examiner"
          />
          <TextField
            htmlFor="jr-dept"
            label="Department"
            required
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Finance & Audit Directorate"
          />
          <TextareaField
            htmlFor="jr-desc"
            label="Role Mandate"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateRoleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submittingRole}>
              {submittingRole ? 'Saving...' : 'Save Job Role'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      {/* Configure Role Requirements Drawer */}
      <ModalDrawer
        isOpen={Boolean(activeRoleForMapping)}
        onClose={() => setActiveRoleForMapping(null)}
        title={`Role Baseline: ${activeRoleForMapping?.title ?? ''}`}
        subtitle={activeRoleForMapping ? `${activeRoleForMapping.code} · role_requirements` : undefined}
      >
        {activeRoleForMapping && (
          <div className="space-y-5">
            <form onSubmit={handleAddRequirement} className="space-y-3 border-b border-slate-200 pb-4">
              <SelectField
                htmlFor="req-comp"
                label="Add / Update Required Competency"
                value={reqCompId}
                onChange={(e) => setReqCompId(e.target.value)}
              >
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </SelectField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  htmlFor="req-score"
                  label="Required Competency Score (0–100)"
                  type="number"
                  min={0}
                  max={100}
                  value={String(reqScore)}
                  onChange={(e) => setReqScore(clampScore(Number(e.target.value)))}
                  helperText={`Derived tier: Level ${scoreToProficiencyLevel(reqScore)} · Formula threshold`}
                />
                <SelectField
                  htmlFor="req-priority"
                  label="Priority"
                  value={reqPriority}
                  onChange={(e) => setReqPriority(e.target.value as 'core' | 'supporting')}
                >
                  <option value="core">Core</option>
                  <option value="supporting">Supporting</option>
                </SelectField>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>Quick benchmarks:</span>
                  {[65, 70, 75, 80, 90].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReqScore(preset)}
                      className={`px-2 py-0.5 rounded border font-mono tabular-nums cursor-pointer ${
                        reqScore === preset
                          ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <Button type="submit" variant="teal" size="sm" disabled={savingReq || !reqCompId}>
                  {savingReq ? 'Saving...' : 'Save Requirement'}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-900">
                Mapped Competencies ({activeRoleReqs.length})
              </h3>
              {activeRoleReqs.length === 0 ? (
                <p className="text-xs text-slate-500">No competencies mapped to this role yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                  {activeRoleReqs.map((r) => (
                    <div
                      key={r.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono text-[#0F766E]">{r.competency?.code}</span>
                        <span className="font-medium text-slate-900 ml-2">
                          {r.competency?.title}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 ml-2 capitalize">
                          · Req {normalizeRequiredScore(r)}/100 (L{r.required_level} · {r.priority})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReqCompId(r.competency_id);
                            setReqScore(normalizeRequiredScore(r));
                            setReqPriority(r.priority);
                          }}
                          className="text-[#0B1F3A] hover:underline font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(r.id)}
                          className="text-red-700 hover:text-red-900 font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteRoleTarget)}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={() => {
          if (deleteRoleTarget) handleDeleteRole(deleteRoleTarget);
        }}
        title="Delete job role?"
        description={`Delete "${deleteRoleTarget?.title}"? Linked role competency requirements will be removed.`}
        confirmLabel="Delete Role"
        tone="danger"
      />
    </div>
  );
}
