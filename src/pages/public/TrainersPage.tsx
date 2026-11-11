import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { databaseService } from '../../services/databaseService';
import { PROGRAMME_DOMAINS, ProgrammeDomain, PublicTrainerDirectoryItem } from '../../types/competency';

const DOMAIN_FILTERS: ('All' | ProgrammeDomain)[] = ['All', ...PROGRAMME_DOMAINS];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function TrainersPage() {
  const { isSupabaseConfigured } = useAuth();
  const [trainers, setTrainers] = useState<PublicTrainerDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<'All' | ProgrammeDomain>('All');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    let active = true;
    databaseService
      .listPublicTrainers()
      .then((rows) => {
        if (active) {
          setTrainers(rows);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load trainers directory.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured]);

  const filteredTrainers = useMemo(() => {
    if (selectedDomain === 'All') return trainers;
    return trainers.filter((trainer) =>
      trainer.expertise.some((exp) => exp.domain === selectedDomain)
    );
  }, [trainers, selectedDomain]);

  return (
    <div className="bg-slate-50 min-h-full">
      <section className="bg-white border-b border-slate-200 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="font-mono text-xs font-medium text-[#0F766E]">
            Faculty &amp; Subject-Matter Trainers
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0B1F3A] tracking-tight">
            Approved Domain Trainers &amp; Assessors
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            Verified subject-matter trainers responsible for authoring diagnostic evaluation
            rubrics, delivering targeted training modules, and certifying competency closure during
            reassessment.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {!isSupabaseConfigured && (
            <StatusBanner
              tone="warning"
              title="Supabase Directory Not Yet Connected"
              description="Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and run migration 002_rls_policies.sql to display approved faculty from public_trainer_directory."
            />
          )}

          {loadError && (
            <StatusBanner tone="error" title="Directory Query Error" description={loadError} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {DOMAIN_FILTERS.map((domain) => {
              const isSelected = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setSelectedDomain(domain)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {domain}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="p-6 h-52 animate-pulse bg-white" />
              ))}
            </div>
          ) : filteredTrainers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrainers.map((trainer) => (
                <Card key={trainer.id} className="p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-14 h-14 rounded-md bg-[#0B1F3A] text-white font-display text-base font-semibold flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        {getInitials(trainer.full_name)}
                      </div>

                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold text-[#0B1F3A] leading-snug">
                          {trainer.full_name}
                        </h2>
                        <p className="text-xs font-medium text-[#0F766E] mt-0.5">
                          {trainer.designation || 'Accredited Domain Trainer'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {trainer.department || 'Institutional Faculty'}
                        </p>
                      </div>
                    </div>

                    {trainer.expertise.length > 0 ? (
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        {trainer.expertise.map((exp, idx) => (
                          <div key={`${trainer.id}-exp-${idx}`} className="text-xs text-slate-600">
                            <p className="font-semibold text-slate-800">{exp.specialization}</p>
                            <p className="text-slate-500">
                              {exp.domain} · {exp.credential} ({exp.years_experience} yrs)
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                        Approved faculty profile verified by portal administration.
                      </p>
                    )}
                  </div>

                  {trainer.office_location && (
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">Location:</span>{' '}
                      {trainer.office_location}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center space-y-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                No Approved Trainers Found
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                Trainers appear in this public directory after registering a Trainer account,
                submitting domain credentials, and receiving Administrator approval.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
