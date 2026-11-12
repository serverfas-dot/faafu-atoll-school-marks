import type { Assessment, AssessmentPart, GradeSemesterData, Subject } from '@/lib/types';
import type { SheetKind } from '@/lib/school';

export type { SheetKind } from '@/lib/school';

export type AssessmentResult = {
  assessmentId: string;
  name: string;
  max: number;
  weight: number;
  part: AssessmentPart;
  mark: number | null;
  percent: number | null;
  grade: string;
};

export type PartSummary = {
  obtained: number;
  max: number;
  points: number;
};

export type SubjectResult = {
  subjectId: string;
  name: string;
  obtained: number;
  maxTotal: number;
  percent: number | null;
  grade: string;
  assessments: AssessmentResult[];
  unit: PartSummary;
  term: PartSummary;
};

export type StudentResult = {
  studentId: string;
  subjects: SubjectResult[];
  total: number;
  average: number | null;
  finalGrade: string;
};

const SECONDARY_CLASSES = new Set(['7', '8', '9BS', '9SC', '10BS', '10SC']);

export const SECONDARY_PART_POINTS: Record<AssessmentPart, number> = { unit: 30, term: 70 };

export const ASSESSMENT_PART_OPTIONS: { value: AssessmentPart; label: string }[] = [
  { value: 'unit', label: 'Unit test (30%)' },
  { value: 'term', label: 'Term test (70%)' },
];

const SECONDARY_BANDS: [number, string][] = [
  [89.4, 'A*'],
  [74.5, 'A'],
  [64.4, 'B'],
  [49.4, 'C'],
  [39.4, 'D'],
  [24.4, 'E'],
  [-1, 'U'],
];

export const markKey = (studentId: string, assessmentId: string) => `${studentId}|${assessmentId}`;

export function buildMarkIndex(rows: { student_id: string; assessment_id: string; mark: number }[]) {
  return new Map(rows.map((row) => [markKey(row.student_id, row.assessment_id), row.mark]));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function sheetKindFor(classCode: string, configuredKind?: SheetKind): SheetKind {
  return configuredKind ?? (SECONDARY_CLASSES.has(classCode) ? 'secondary' : 'primary');
}

export function gradeOf(percent: number | null, sheet: SheetKind): string {
  if (percent === null) return '-';
  if (sheet === 'secondary') {
    const band = SECONDARY_BANDS.find(([min]) => percent > min);
    return band ? band[1] : '-';
  }
  if (percent > 89.4) return 'FA';
  if (percent > 59.4) return 'MA';
  if (percent > 1) return 'A';
  return '-';
}

export function percentOf(mark: number | null, max: number): number | null {
  if (mark === null || max <= 0) return null;
  return round2((mark / max) * 100);
}

function partPoints(rows: AssessmentResult[], sheet: SheetKind, part: AssessmentPart): number {
  if (rows.length === 0) return 0;
  if (sheet === 'secondary') {
    const obtained = rows.reduce((sum, r) => sum + (r.mark ?? 0), 0);
    const max = rows.reduce((sum, r) => sum + r.max, 0);
    return (obtained / max) * SECONDARY_PART_POINTS[part];
  }
  return rows.reduce((sum, r) => sum + ((r.mark ?? 0) / r.max) * r.weight, 0);
}

function summarisePart(rows: AssessmentResult[], sheet: SheetKind, part: AssessmentPart): PartSummary {
  return {
    obtained: rows.reduce((sum, r) => sum + (r.mark ?? 0), 0),
    max: rows.reduce((sum, r) => sum + r.max, 0),
    points: partPoints(rows, sheet, part),
  };
}

export function computeStudentResult(
  studentId: string,
  subjects: Subject[],
  assessments: Assessment[],
  marks: Map<string, number>,
  sheet: SheetKind,
): StudentResult {
  const subjectResults: SubjectResult[] = subjects.map((subject) => {
    const items = assessments
      .filter((item) => item.subject_id === subject.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const results: AssessmentResult[] = items.map((item) => {
      const mark = marks.get(markKey(studentId, item.id)) ?? null;
      const percent = percentOf(mark, item.max_mark);
      return {
        assessmentId: item.id,
        name: item.name,
        max: item.max_mark,
        weight: item.weight,
        part: item.part,
        mark,
        percent,
        grade: gradeOf(percent, sheet),
      };
    });

    const hasItems = results.length > 0;
    const unit = summarisePart(
      results.filter((r) => r.part === 'unit'),
      sheet,
      'unit',
    );
    const term = summarisePart(
      results.filter((r) => r.part === 'term'),
      sheet,
      'term',
    );
    const percent = hasItems ? unit.points + term.points : null;

    return {
      subjectId: subject.id,
      name: subject.name,
      obtained: results.reduce((sum, r) => sum + (r.mark ?? 0), 0),
      maxTotal: results.reduce((sum, r) => sum + r.max, 0),
      percent,
      grade: gradeOf(percent, sheet),
      assessments: results,
      unit,
      term,
    };
  });

  const total = round2(subjectResults.reduce((sum, r) => sum + (r.percent ?? 0), 0));
  const average = subjects.length > 0 ? round2(total / subjects.length) : null;

  return {
    studentId,
    subjects: subjectResults,
    total,
    average,
    finalGrade: gradeOf(average, sheet),
  };
}

export function rankByAverage(results: StudentResult[]): Map<string, number> {
  const ranks = new Map<string, number>();
  results.forEach((result) => {
    const better = results.filter((other) => (other.average ?? -1) > (result.average ?? -1)).length;
    ranks.set(result.studentId, better + 1);
  });
  return ranks;
}

export function computeGradeResults(data: GradeSemesterData, classCode: string, configuredKind?: SheetKind) {
  const marks = buildMarkIndex(data.marks);
  const sheet = sheetKindFor(classCode, configuredKind);
  const results = data.students.map((student) =>
    computeStudentResult(student.id, data.subjects, data.assessments, marks, sheet),
  );
  return { results, ranks: rankByAverage(results) };
}

export function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${Number(value.toFixed(2))}%`;
}
