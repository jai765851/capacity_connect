import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalDrawer } from '../../components/ui/ModalDrawer';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { databaseService } from '../../services/databaseService';
import { CourseRecord, DeliveryMode, PROGRAMME_DOMAINS, ProgrammeDomain } from '../../types/competency';

const DOMAIN_OPTIONS: ('All' | ProgrammeDomain)[] = ['All', ...PROGRAMME_DOMAINS];
const DELIVERY_MODES: ('All' | DeliveryMode)[] = [
  'All',
  'Blended',
  'Instructor-Led',
  'Applied Workshop',
];

export function ProgrammesPage() {
  const { isSupabaseConfigured } = useAuth();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<'All' | ProgrammeDomain>('All');
  const [selectedMode, setSelectedMode] = useState<'All' | DeliveryMode>('All');
  const [activeProgramme, setActiveProgramme] = useState<CourseRecord | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    let active = true;
    databaseService
      .listPublishedCourses()
      .then((rows) => {
        if (active) {
          setCourses(rows);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to fetch training catalogue.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured]);

  const filteredProgrammes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return courses.filter((prog) => {
      const matchesDomain = selectedDomain === 'All' || prog.domain === selectedDomain;
      const matchesMode = selectedMode === 'All' || prog.delivery_mode === selectedMode;
      const compNames = (prog.course_competencies ?? [])
        .map((link) => link.competency?.title ?? '')
        .join(' ')
        .toLowerCase();

      const matchesQuery =
        !query ||
        prog.title.toLowerCase().includes(query) ||
        prog.code.toLowerCase().includes(query) ||
        prog.summary.toLowerCase().includes(query) ||
        compNames.includes(query);

      return matchesDomain && matchesMode && matchesQuery;
    });
  }, [courses, searchQuery, selectedDomain, selectedMode]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedDomain('All');
    setSelectedMode('All');
  };

  return (
    <div className="bg-slate-50 min-h-full">
      <section className="bg-white border-b border-slate-200 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="font-mono text-xs font-medium text-[#0F766E]">
            Training Programmes Catalogue
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0B1F3A] tracking-tight">
            Competency-Aligned Training Programmes
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            Each published training programme addresses verifiable institutional competencies and
            concludes with structured reassessment. Filter by competency domain or delivery mode to
            inspect syllabus specifications.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {!isSupabaseConfigured && (
            <StatusBanner
              tone="warning"
              title="Supabase Database Not Yet Connected"
              description="Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and run migrations 001–004 in Supabase to load live training courses from PostgreSQL."
            />
          )}

          {loadError && (
            <StatusBanner tone="error" title="Catalogue Query Error" description={loadError} />
          )}

          {/* Search & Filter Controls */}
          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-7 relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by programme code, title, or addressed competency..."
                  aria-label="Search training programmes"
                  className="w-full min-h-[42px] pl-10 pr-4 py-2 text-sm rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                />
              </div>

              <div className="lg:col-span-5 flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-md">
                {DELIVERY_MODES.map((mode) => {
                  const isActive = selectedMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedMode(mode)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-white text-[#0B1F3A] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 mr-1">Domain:</span>
              {DOMAIN_OPTIONS.map((domain) => {
                const isSelected = selectedDomain === domain;
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setSelectedDomain(domain)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {domain}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <p className="tabular-nums">
              Showing {filteredProgrammes.length} of {courses.length} published courses
            </p>
            {(searchQuery || selectedDomain !== 'All' || selectedMode !== 'All') && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-semibold text-[#0F766E] hover:text-[#0B1F3A] cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="p-6 h-64 animate-pulse bg-white" />
              ))}
            </div>
          ) : filteredProgrammes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProgrammes.map((programme) => {
                const addressed = (programme.course_competencies ?? [])
                  .map((link) => link.competency?.title)
                  .filter(Boolean) as string[];

                return (
                  <Card key={programme.id} className="p-6 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-[#0F766E]">{programme.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{programme.domain}</span>
                      </div>

                      <h2 className="font-display text-lg font-semibold text-[#0B1F3A] leading-snug">
                        {programme.title}
                      </h2>

                      <p className="text-sm text-slate-600 leading-relaxed">{programme.summary}</p>

                      {addressed.length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          <p className="text-xs font-semibold text-slate-900">
                            Competencies Addressed
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {addressed.join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {programme.delivery_mode} · {programme.target_level}
                        </span>
                        <span className="font-mono tabular-nums">{programme.duration_hours} Hours</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        onClick={() => setActiveProgramme(programme)}
                      >
                        <span>View Syllabus &amp; Rubric</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center space-y-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {courses.length === 0
                  ? 'No published training courses available'
                  : 'No training programmes match your active filters'}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {courses.length === 0
                  ? 'Seed the initial catalogue using SQL migration 004_seed_initial_catalog.sql or publish new courses from an Admin or Approved Trainer dashboard.'
                  : 'Adjust the domain, delivery mode, or search terms to explore available institutional curricula.'}
              </p>
              {courses.length > 0 && (
                <div className="pt-2">
                  <Button variant="primary" size="sm" onClick={resetFilters}>
                    Clear All Filters
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </section>

      <ModalDrawer
        isOpen={Boolean(activeProgramme)}
        onClose={() => setActiveProgramme(null)}
        title={activeProgramme?.title ?? ''}
        subtitle={
          activeProgramme
            ? `${activeProgramme.code} · ${activeProgramme.domain} · ${activeProgramme.duration_hours} Hours`
            : undefined
        }
      >
        {activeProgramme && (
          <div className="space-y-5 text-sm">
            <p className="text-slate-600 leading-relaxed">{activeProgramme.summary}</p>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              {(activeProgramme.learning_objectives?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">Learning Objectives</h3>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-600">
                    {activeProgramme.learning_objectives?.map((objective, idx) => (
                      <li key={`${activeProgramme.id}-obj-${idx}`}>{objective}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Lead Department</h3>
                <p className="text-slate-600 mt-0.5">
                  {activeProgramme.lead_department || 'Institutional Directorate'}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Prerequisites</h3>
                <p className="text-slate-600 mt-0.5">
                  {activeProgramme.prerequisites || 'None specified'}
                </p>
              </div>
              {(activeProgramme.course_competencies?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Target Competencies Covered
                  </h3>
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {activeProgramme.course_competencies?.map((link) => (
                      <li key={link.id}>
                        • {link.competency?.code} — {link.competency?.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Reassessment &amp; Verification Method
                </h3>
                <p className="text-slate-600 mt-0.5">
                  {activeProgramme.assessment_method || 'Structured post-training evaluation'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <Button variant="primary" size="sm" onClick={() => setActiveProgramme(null)}>
                Close Specification
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
