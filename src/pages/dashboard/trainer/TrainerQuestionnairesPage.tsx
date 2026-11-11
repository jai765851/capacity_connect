import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { databaseService } from '../../../services/databaseService';
import {
  AssessmentQuestionRecord,
  AssessmentRecord,
  QuestionType,
} from '../../../types/competency';

export function TrainerQuestionnairesPage() {
  const [searchParams] = useSearchParams();
  const assessmentIdParam = searchParams.get('assessmentId') ?? '';

  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [questions, setQuestions] = useState<AssessmentQuestionRecord[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(assessmentIdParam);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('Multiple Choice');
  const [optionsList, setOptionsList] = useState<string[]>(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState('');
  const [maxMarks, setMaxMarks] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentQuestionRecord | null>(null);

  const [editTarget, setEditTarget] = useState<AssessmentQuestionRecord | null>(null);
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState<QuestionType>('Multiple Choice');
  const [editOptionsList, setEditOptionsList] = useState<string[]>(['', '']);
  const [editCorrectOption, setEditCorrectOption] = useState('');
  const [editMaxMarks, setEditMaxMarks] = useState(10);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    databaseService
      .listAssessments()
      .then((asmtRows) => {
        setAssessments(asmtRows);
        if (assessmentIdParam && asmtRows.some((a) => a.id === assessmentIdParam)) {
          setSelectedAssessmentId(assessmentIdParam);
        } else if (asmtRows.length > 0 && !selectedAssessmentId) {
          setSelectedAssessmentId(asmtRows[0].id);
        }
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load assessments.');
      })
      .finally(() => setIsLoading(false));
  }, [assessmentIdParam]);

  useEffect(() => {
    if (!selectedAssessmentId) {
      setQuestions([]);
      return;
    }
    setIsLoading(true);
    databaseService
      .listAssessmentQuestions(selectedAssessmentId, true)
      .then((rows) => {
        setQuestions(rows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch questions.');
      })
      .finally(() => setIsLoading(false));
  }, [selectedAssessmentId]);

  const nonEmptyOptions = optionsList.map((o) => o.trim()).filter(Boolean);
  const uniqueNonEmptyOptions = Array.from(new Set(nonEmptyOptions));

  const editNonEmptyOptions = editOptionsList.map((o) => o.trim()).filter(Boolean);
  const uniqueEditOptions = Array.from(new Set(editNonEmptyOptions));

  const handleOptionChange = (idx: number, val: string) => {
    const prevVal = optionsList[idx]?.trim() ?? '';
    setOptionsList((prev) => prev.map((item, i) => (i === idx ? val : item)));
    if (correctOption && correctOption === prevVal) {
      setCorrectOption(val.trim());
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentId || questionText.trim().length < 5) {
      setError('Select a target assessment and enter a question prompt (>= 5 characters).');
      return;
    }

    if (questionType === 'Multiple Choice') {
      if (uniqueNonEmptyOptions.length < 2) {
        setError('Multiple Choice questions require at least 2 distinct answer options.');
        return;
      }
      if (!correctOption || !uniqueNonEmptyOptions.includes(correctOption)) {
        setError('Select the correct answer option from the dropdown for auto-scored MCQ items.');
        return;
      }
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const inserted = await databaseService.createAssessmentQuestion({
        assessment_id: selectedAssessmentId,
        question_text: questionText.trim(),
        question_type: questionType,
        options: questionType === 'Multiple Choice' ? uniqueNonEmptyOptions : [],
        correct_option: questionType === 'Multiple Choice' ? correctOption : null,
        max_marks: Math.max(1, Number(maxMarks)),
        order_index: questions.length + 1,
      });
      setQuestions((prev) => [...prev, inserted]);
      setQuestionText('');
      setOptionsList(['', '', '', '']);
      setCorrectOption('');
      setNotice('Added question item to questionnaire.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDrawer = (row: AssessmentQuestionRecord) => {
    setEditTarget(row);
    setEditText(row.question_text);
    setEditType(row.question_type);
    setEditOptionsList(row.options.length >= 2 ? row.options : ['', '']);
    setEditCorrectOption(row.correct_option ?? '');
    setEditMaxMarks(row.max_marks);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || editText.trim().length < 5) {
      setError('Enter a valid question prompt.');
      return;
    }

    if (editType === 'Multiple Choice') {
      if (uniqueEditOptions.length < 2) {
        setError('Multiple Choice items require at least 2 distinct options.');
        return;
      }
      if (!editCorrectOption || !uniqueEditOptions.includes(editCorrectOption)) {
        setError('Select the correct option for Multiple Choice grading.');
        return;
      }
    }

    setSavingEdit(true);
    setError(null);
    try {
      const updated = await databaseService.updateAssessmentQuestion(editTarget.id, {
        question_text: editText.trim(),
        question_type: editType,
        options: editType === 'Multiple Choice' ? uniqueEditOptions : [],
        correct_option: editType === 'Multiple Choice' ? editCorrectOption : null,
        max_marks: Math.max(1, Number(editMaxMarks)),
      });
      setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setEditTarget(null);
      setNotice('Updated question item.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update question.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (row: AssessmentQuestionRecord) => {
    try {
      await databaseService.deleteAssessmentQuestion(row.id);
      setQuestions((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete question.');
    }
  };

  const columns: DataColumn<AssessmentQuestionRecord>[] = [
    {
      key: 'order',
      header: '#',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 tabular-nums">{row.order_index}</span>
      ),
    },
    {
      key: 'prompt',
      header: 'Question / Rubric Prompt',
      render: (row) => (
        <div>
          <p className="text-slate-900 font-medium">{row.question_text}</p>
          {row.options.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Options: {row.options.join(' | ')}
              {row.correct_option ? ` · Answer Key: ${row.correct_option}` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Format',
      render: (row) => <span className="text-xs text-slate-600">{row.question_type}</span>,
    },
    {
      key: 'marks',
      header: 'Marks',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">{row.max_marks}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditDrawer(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Questionnaires</h1>
        <p className="text-sm text-slate-600 mt-1">
          Author structured Multiple Choice questions and open rubric items in
          `assessment_questions`.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Questionnaire Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Saved" description={notice} />}

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleAdd} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectField
              htmlFor="q-asmt"
              label="Target Assessment"
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
            >
              {assessments.length === 0 ? (
                <option value="">Create an assessment first</option>
              ) : (
                assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.title}
                  </option>
                ))
              )}
            </SelectField>
            <SelectField
              htmlFor="q-type"
              label="Item Format"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            >
              <option value="Multiple Choice">Multiple Choice (Auto-Scored)</option>
              <option value="Scenario Response">Scenario Response (Trainer Rubric)</option>
              <option value="Practical Checklist">Practical Checklist (Trainer Rubric)</option>
            </SelectField>
            <TextField
              htmlFor="q-marks"
              label="Max Marks"
              type="number"
              min={1}
              max={100}
              value={String(maxMarks)}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
            />
          </div>

          <TextareaField
            htmlFor="q-prompt"
            label="Question / Rubric Prompt"
            required
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Enter the competency scenario or technical question..."
          />

          {questionType === 'Multiple Choice' && (
            <div className="space-y-4 border border-slate-200 rounded-md p-4 bg-slate-50/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">
                  Answer Options (Minimum 2 distinct options)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptionsList((prev) => [...prev, ''])}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option</span>
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {optionsList.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 w-5 text-right shrink-0">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <input
                      aria-label={`Option ${idx + 1}`}
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Answer choice ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 min-h-[38px] rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                    />
                    {optionsList.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOptionsList((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove option ${idx + 1}`}
                        className="p-1.5 text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <SelectField
                htmlFor="q-correct"
                label="Correct Answer Option (Server Grading Key)"
                value={correctOption}
                onChange={(e) => setCorrectOption(e.target.value)}
                helperText="Only used during server-side MCQ grading; hidden from trainees until submission."
              >
                <option value="">-- Select correct option --</option>
                {uniqueNonEmptyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || !selectedAssessmentId}
            >
              {submitting ? 'Saving...' : 'Add Question Item'}
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={questions}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No questions authored for selected assessment"
        emptyDescription="Add questions above to populate the selected assessment in `assessment_questions`."
      />

      <ModalDrawer
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit Question #${editTarget?.order_index ?? ''}`}
        subtitle={editTarget?.question_type}
      >
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                htmlFor="edit-q-type"
                label="Item Format"
                value={editType}
                onChange={(e) => setEditType(e.target.value as QuestionType)}
              >
                <option value="Multiple Choice">Multiple Choice</option>
                <option value="Scenario Response">Scenario Response</option>
                <option value="Practical Checklist">Practical Checklist</option>
              </SelectField>
              <TextField
                htmlFor="edit-q-marks"
                label="Max Marks"
                type="number"
                min={1}
                max={100}
                value={String(editMaxMarks)}
                onChange={(e) => setEditMaxMarks(Number(e.target.value))}
              />
            </div>

            <TextareaField
              htmlFor="edit-q-prompt"
              label="Question Prompt"
              required
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            {editType === 'Multiple Choice' && (
              <div className="space-y-3 border border-slate-200 rounded-md p-3 bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Answer Options</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOptionsList((prev) => [...prev, ''])}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </Button>
                </div>
                {editOptionsList.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      aria-label={`Edit option ${idx + 1}`}
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        setEditOptionsList((prev) =>
                          prev.map((item, i) => (i === idx ? e.target.value : item))
                        )
                      }
                      className="flex-1 min-h-[36px] rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900"
                    />
                    {editOptionsList.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditOptionsList((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <SelectField
                  htmlFor="edit-q-correct"
                  label="Correct Option"
                  value={editCorrectOption}
                  onChange={(e) => setEditCorrectOption(e.target.value)}
                >
                  <option value="">-- Select correct option --</option>
                  {uniqueEditOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        title="Delete question item?"
        description="Remove this item from `assessment_questions`?"
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
