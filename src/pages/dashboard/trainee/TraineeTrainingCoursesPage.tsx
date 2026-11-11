import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkCheck } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { computeCompetencyGapReport, matchVerifiedTrainersForCompetency } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import {
  CourseRecord,
  MatchedTrainerProfile,
  PROGRAMME_DOMAINS,
  SkillGapComputedRow,
  TrainerAssignmentRecord,
  PublicTrainerDirectoryItem,
} from '../../../types/competency';

export function TraineeTrainingCoursesPage() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [gapRows, setGapRows] = useState<SkillGapComputedRow[]>([]);
  const [verifiedTrainers, setVerifiedTrainers] = useState<PublicTrainerDirectoryItem[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<TrainerAssignmentRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolNotice, setEnrolNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listPublishedCourses(),
      databaseService.listEnrollments({ traineeId: currentUser.id }),
      databaseService.listVerifiedTrainersForMatching(),
      databaseService.listActiveTrainerAssignments(),
      currentUser.jobRoleId
        ? databaseService.listRoleRequirements(currentUser.jobRoleId)
        : Promise.resolve([]),
      currentUser.jobRoleId
        ? databaseService.listProgressHistory(currentUser.id)
        : Promise.resolve([]),
    ])
      .then(
        ([
          courseRows,
          enrollmentRows,
          trainerRows,
          assignmentRows,
          roleReqRows,
          progressRows,
        ]) => {
          setCourses(courseRows);
          setEnrolledCourseIds(
            new Set(enrollmentRows.filter((e) => e.status !== 'withdrawn').map((e) => e.course_id))
          );
          setVerifiedTrainers(trainerRows);
          setActiveAssignments(assignmentRows);

          if (roleReqRows.length > 0) {
            const report = computeCompetencyGapReport({
              requirements: roleReqRows,
              progressHistory: progressRows,
              courses: courseRows,
              trainers: trainerRows,
              activeAssignments: assignmentRows,
            });
            setGapRows(report.rows);
          } else {
            setGapRows([]);
          }
          setError(null);
        }
      )
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch training courses.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id, currentUser?.jobRoleId]);

  const getCourseGapAndFaculty = (course: CourseRecord): {
    addressedGap: SkillGapComputedRow | null;
    matchedTrainers: MatchedTrainerProfile[];
    activeAssign: TrainerAssignmentRecord | null;
  } => {
    const courseCompIds = new Set((course.course_competencies ?? []).map((cc) => cc.competency_id));
    const directGap =
      gapRows.find((g) => g.gapDelta > 0 && courseCompIds.has(g.competencyId)) ??
      gapRows.find(
        (g) => g.gapDelta > 0 && g.domain.toLowerCase() === course.domain.toLowerCase()
      ) ??
      null;

    const firstCompId =
      directGap?.competencyId ?? course.course_competencies?.[0]?.competency_id ?? '';
    const matchedTrainers = matchVerifiedTrainersForCompetency({
      competencyId: firstCompId,
      domain: course.domain,
      trainers: verifiedTrainers,
      activeAssignments,
      courseId: course.id,
    });

    const activeAssign =
      activeAssignments.find(
        (a) => a.course_id === course.id && matchedTrainers.some((t) => t.trainerId === a.trainer_id)
      ) ??
      activeAssignments.find((a) => a.course_id === course.id) ??
      null;

    return { addressedGap: directGap, matchedTrainers, activeAssign };
  };

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter((course) => {
        const matchesDomain = domainFilter === 'All' || course.domain === domainFilter;
        const matchesSearch =
          !q ||
          course.code.toLowerCase().includes(q) ||
          course.title.toLowerCase().includes(q) ||
          course.summary.toLowerCase().includes(q);
        return matchesDomain && matchesSearch;
      })
      .sort((a, b) => {
        const aGap = getCourseGapAndFaculty(a).addressedGap?.gapDelta ?? 0;
        const bGap = getCourseGapAndFaculty(b).addressedGap?.gapDelta ?? 0;
        return bGap - aGap;
      });
  }, [courses, search, domainFilter, gapRows, verifiedTrainers, activeAssignments]);

  const handleEnroll = async (course: CourseRecord) => {
    if (!currentUser) return;
    setEnrollingId(course.id);
    setError(null);
    const { addressedGap, activeAssign } = getCourseGapAndFaculty(course);
    try {
      const mappedCompId =
        addressedGap?.competencyId ?? course.course_competencies?.[0]?.competency_id ?? null;
      await databaseService.enrollInCourse({
        trainee_id: currentUser.id,
        course_id: course.id,
        trainer_assignment_id: activeAssign?.id ?? null,
        mapped_competency_id: mappedCompId,
        assignment_reason: addressedGap
          ? `Skill Gap Remediation (${addressedGap.competencyCode}: ${addressedGap.gapDelta} pts gap)`
          : 'Competency development enrolment',
        status: 'in_progress',
      });
      setEnrolledCourseIds((prev) => new Set([...prev, course.id]));
      setEnrolNotice(
        `Enrolled in ${course.code} — ${course.title}${
          activeAssign ? ` (Cohort ${activeAssign.cohort_code})` : ''
        }. View progress in Enrolments.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrolment failed.');
    } finally {
      setEnrollingId(null);
    }
  };

  const selectedCourseMeta = selectedCourse ? getCourseGapAndFaculty(selectedCourse) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Training Courses</h1>
        <p className="text-sm text-slate-600 mt-1">
          Published institutional training courses aligned to your role skill gaps and Admin-verified
          faculty credentials.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Catalogue Error" description={error} />}
      {enrolNotice && (
        <div className="space-y-2">
          <StatusBanner tone="success" title="Enrolment Recorded" description={enrolNotice} />
          <div className="flex flex-wrap items-center gap-4 px-1 text-xs font-semibold text-[#0F766E]">
            <Link to="/dashboard/trainee/enrolments" className="hover:text-[#0B1F3A]">
              Open My Enrolments →
            </Link>
            <Link to="/dashboard/trainee/learning-resources" className="hover:text-[#0B1F3A]">
              Access Learning Resources →
            </Link>
            <Link to="/dashboard/trainee/assessments" className="hover:text-[#0B1F3A]">
              View Course Assessments →
            </Link>
          </div>
        </div>
      )}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search training courses by code or title..."
        rightSlot={
          <select
            aria-label="Filter courses by domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Domains</option>
            {PROGRAMME_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 h-56 animate-pulse bg-white" />
          ))}
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const { addressedGap, matchedTrainers, activeAssign } = getCourseGapAndFaculty(course);

            return (
              <Card key={course.id} className="p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-medium text-[#0F766E]">{course.code}</span>
                    <span>{course.target_level}</span>
                  </div>
                  <h2 className="font-display text-base font-semibold text-[#0B1F3A] leading-snug">
                    {course.title}
                  </h2>
                  <p className="text-xs text-slate-500">{course.domain}</p>

                  {addressedGap && (
                    <p className="text-xs font-medium text-[#0F766E] border-t border-slate-100 pt-2">
                      Recommended for gap: {addressedGap.competencyCode} ({addressedGap.gapDelta} pts)
                    </p>
                  )}

                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {course.summary}
                  </p>

                  {matchedTrainers.length > 0 && (
                    <p className="text-xs text-slate-600 pt-1">
                      <span className="font-medium text-slate-800">Verified Faculty:</span>{' '}
                      {matchedTrainers[0].fullName} ({matchedTrainers[0].credential})
                      {activeAssign ? ` · Cohort ${activeAssign.cohort_code}` : ''}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{course.delivery_mode}</span>
                    <span className="font-mono tabular-nums">{course.duration_hours} Hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedCourse(course)}
                    >
                      Syllabus
                    </Button>
                    <Button
                      variant={isEnrolled ? 'outline' : 'teal'}
                      size="sm"
                      className="flex-1"
                      disabled={isEnrolled || enrollingId === course.id}
                      onClick={() => handleEnroll(course)}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>
                        {isEnrolled
                          ? 'Enrolled'
                          : enrollingId === course.id
                          ? 'Saving...'
                          : 'Enrol'}
                      </span>
                    </Button>
                  </div>
                  {isEnrolled && (
                    <div className="flex items-center justify-between pt-1 text-xs font-medium text-[#0F766E]">
                      <Link to="/dashboard/trainee/learning-resources" className="hover:text-[#0B1F3A]">
                        Study Materials →
                      </Link>
                      <Link to="/dashboard/trainee/assessments" className="hover:text-[#0B1F3A]">
                        Assessments →
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-10 text-center space-y-2">
          <p className="font-display text-base font-semibold text-slate-900">
            No published courses match your criteria
          </p>
          <p className="text-sm text-slate-600">
            Adjust search filters or ensure published courses exist in `public.courses`.
          </p>
        </Card>
      )}

      <ModalDrawer
        isOpen={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
        title={selectedCourse?.title ?? ''}
        subtitle={
          selectedCourse
            ? `${selectedCourse.code} · ${selectedCourse.domain} · ${selectedCourse.duration_hours} Hours`
            : undefined
        }
      >
        {selectedCourse && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600 leading-relaxed">{selectedCourse.summary}</p>
            <div className="border-t border-slate-200 pt-3 space-y-2.5">
              {(selectedCourse.learning_objectives?.length ?? 0) > 0 && (
                <div>
                  <p className="font-semibold text-slate-900">Learning Objectives:</p>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-600">
                    {selectedCourse.learning_objectives?.map((obj, idx) => (
                      <li key={`${selectedCourse.id}-obj-${idx}`}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <span className="font-semibold text-slate-900">Prerequisites:</span>{' '}
                {selectedCourse.prerequisites || 'None'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Verification Method:</span>{' '}
                {selectedCourse.assessment_method || 'Course assessment'}
              </p>
              {(selectedCourse.course_competencies?.length ?? 0) > 0 && (
                <div>
                  <p className="font-semibold text-slate-900">Mapped Competencies:</p>
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {selectedCourse.course_competencies?.map((link) => (
                      <li key={link.id}>
                        • {link.competency?.code} — {link.competency?.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(selectedCourseMeta?.matchedTrainers.length ?? 0) > 0 && (
                <div>
                  <p className="font-semibold text-slate-900">Matched Verified Trainers:</p>
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {selectedCourseMeta?.matchedTrainers.map((t) => (
                      <li key={t.trainerId}>
                        • {t.fullName} — {t.specialization} ({t.credential}, {t.yearsExperience}y ·{' '}
                        {t.matchType})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
