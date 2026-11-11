import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, Layers, ShieldCheck, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { CompetencyCycleDiagram } from '../../components/ui/CompetencyCycleDiagram';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_MEDIA } from '../../data/catalog';
import { databaseService } from '../../services/databaseService';
import { ROLE_DASHBOARD_PATHS } from '../../types/auth';
import { CourseRecord } from '../../types/competency';

export function HomePage() {
  const { currentUser, isSupabaseConfigured } = useAuth();
  const [featuredCourses, setFeaturedCourses] = useState<CourseRecord[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingCourses(false);
      return;
    }
    let active = true;
    databaseService
      .listPublishedCourses()
      .then((rows) => {
        if (active) {
          setFeaturedCourses(rows.slice(0, 3));
          setCatalogError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setFeaturedCourses([]);
          setCatalogError(err instanceof Error ? err.message : 'Unable to query curriculum catalogue.');
        }
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured]);

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-mono font-medium text-[#0F766E]">
                  SIH26075 · Digital Capacity Building &amp; Learning Management Portal
                </p>
                <h1
                  className="font-display font-bold tracking-tight text-[#0B1F3A] leading-[1.12]"
                  style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)', textWrap: 'balance' }}
                >
                  Organisational competency development from baseline to verified readiness.
                </h1>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  CAPACITY CONNECT aligns institutional training directly to verified skill
                  deficits—connecting role competency standards, diagnostic assessment, gap analysis,
                  targeted programme assignment, and post-training reassessment in one unified system.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/programmes"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 text-sm font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Explore Training Programmes</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Inspect Methodology</span>
                </Link>
              </div>

              <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="font-display text-sm font-semibold text-[#0B1F3A]">Role-Based Tracks</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Dedicated portals for Trainees, Trainers, and Administrators.
                  </p>
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-[#0B1F3A]">Diagnostic First</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Training is assigned from measured skill gaps rather than guesswork.
                  </p>
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-[#0B1F3A]">Closed-Loop Proof</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Post-training reassessment verifies competency closure.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[320px] lg:min-h-[460px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ResilientImage
                  src={PORTAL_MEDIA.heroAtrium}
                  alt="Specialists reviewing competency frameworks inside a modern institutional capacity building centre"
                  fallbackTitle="CAPACITY CONNECT Institutional Capacity Centre"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core 5-Stage Competency Lifecycle Section */}
      <section className="py-16 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-3">
            <p className="font-mono text-xs font-medium text-[#0F766E]">
              Core Competency Workflow
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Required Competencies → Skill Assessment → Skill Gap Analysis → Training Assignment → Reassessment
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Unlike generic course catalogues, every action on CAPACITY CONNECT advances an
              auditable five-stage competency lifecycle. Select any stage below to inspect inputs,
              responsibilities, and outputs.
            </p>
          </div>

          <CompetencyCycleDiagram />
        </div>
      </section>

      {/* Asymmetric Role Governance Architecture */}
      <section className="py-16 lg:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="font-mono text-xs font-medium text-[#0F766E]">
                Role-Based Portal Architecture
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] tracking-tight">
                Focused workspaces scoped strictly to organisational responsibility.
              </h2>
            </div>
            <Link
              to={currentUser ? ROLE_DASHBOARD_PATHS[currentUser.role] : '/login'}
              className="text-sm font-semibold text-[#0F766E] hover:text-[#0B1F3A] transition-colors whitespace-nowrap shrink-0"
            >
              {currentUser ? 'Open Active Workspace →' : 'Authenticate via Portal Sign In →'}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card tone="navy" className="lg:col-span-5 p-8 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <p className="font-mono text-xs text-teal-300">
                  Architectural Separation
                </p>
                <h3 className="font-display text-2xl font-semibold text-white leading-snug">
                  One shared competency data model, three uncluttered workspaces.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Each authenticated role receives only the workflows required for its mandate.
                  Trainees track gaps and complete assigned training; Trainers author rubrics and
                  verify reassessments; Administrators govern frameworks and policy thresholds.
                </p>
              </div>
              <div className="pt-6 border-t border-white/15 space-y-2 text-xs text-slate-300">
                <p>Enforced by Supabase Auth &amp; PostgreSQL Row-Level Security</p>
                <p>Dedicated relational tables across all 5 competency stages</p>
              </div>
            </Card>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Card className="p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 text-[#0B1F3A] flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-[#0B1F3A]">Trainee</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    View role-required competencies, attempt baseline diagnostics, inspect personal
                    skill gap reports, and complete assigned training modules.
                  </p>
                </div>
                <Link
                  to={currentUser?.role === 'trainee' ? '/dashboard/trainee' : '/login'}
                  className="inline-flex items-center justify-center w-full min-h-[40px] px-4 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  {currentUser?.role === 'trainee' ? 'Open Trainee Portal' : 'Sign In as Trainee'}
                </Link>
              </Card>

              <Card className="p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 text-[#0F766E] flex items-center justify-center">
                    <Users className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-[#0B1F3A]">Trainer</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Manage assigned cohorts, author assessment rubrics, review practical
                    evaluations, and conduct post-training reassessments.
                  </p>
                </div>
                <Link
                  to={currentUser?.role === 'trainer' ? '/dashboard/trainer' : '/login'}
                  className="inline-flex items-center justify-center w-full min-h-[40px] px-4 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  {currentUser?.role === 'trainer' ? 'Open Trainer Portal' : 'Sign In as Trainer'}
                </Link>
              </Card>

              <Card className="p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 text-[#0B1F3A] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-[#0B1F3A]">Admin</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Define role competency frameworks, approve trainer credentials, govern
                    programmes, and monitor institutional readiness.
                  </p>
                </div>
                <Link
                  to={currentUser?.role === 'admin' ? '/dashboard/admin' : '/login'}
                  className="inline-flex items-center justify-center w-full min-h-[40px] px-4 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  {currentUser?.role === 'admin' ? 'Open Admin Portal' : 'Sign In as Admin'}
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Published Programmes Section from PostgreSQL */}
      <section className="py-16 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <p className="font-mono text-xs font-medium text-[#0F766E]">
                Accredited Curriculum Catalogue
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] tracking-tight">
                Targeted training programmes mapped to institutional competencies.
              </h2>
            </div>
            <Link
              to="/programmes"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1F3A] hover:text-[#0F766E] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Inspect Full Programme Catalogue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {!isSupabaseConfigured ? (
            <StatusBanner
              tone="info"
              title="Curriculum Catalogue Awaits Supabase Connection"
              description="Once VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and migration 004_seed_initial_catalog.sql are applied, published training programmes populate live from PostgreSQL."
            />
          ) : loadingCourses ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((idx) => (
                <Card key={idx} className="p-6 h-56 animate-pulse bg-white" />
              ))}
            </div>
          ) : featuredCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredCourses.map((programme) => (
                <Card key={programme.id} className="p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-[#0F766E]">{programme.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{programme.domain}</span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#0B1F3A] leading-snug">
                      {programme.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{programme.summary}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{programme.delivery_mode}</span>
                      <span className="font-mono tabular-nums">{programme.duration_hours} Hours</span>
                    </div>
                    <Link
                      to="/programmes"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A] hover:text-[#0F766E] transition-colors"
                    >
                      <span>Inspect Programme Syllabus</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : catalogError ? (
            <StatusBanner
              tone="warning"
              title="Curriculum Catalogue Pending Database Migrations"
              description={catalogError}
            />
          ) : (
            <StatusBanner
              tone="info"
              title="No Published Programmes Yet"
              description="No published courses were returned from public.courses. Execute migration 004_seed_initial_catalog.sql or publish courses from an Administrator or approved Trainer dashboard."
            />
          )}
        </div>
      </section>

      {/* Institutional Onboarding Callout */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 md:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-[#0F766E]">
                <Layers className="w-4 h-4" />
                <span>Organisational Deployment &amp; Account Provisioning</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Ready to configure your department’s competency framework?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Register a departmental Trainee or Trainer profile, authenticate into your
                role workspace, or coordinate institutional onboarding with our programme cell.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-md bg-[#0F766E] text-white hover:bg-[#0D9488] transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Register Account</span>
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                Contact Coordination Desk
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
