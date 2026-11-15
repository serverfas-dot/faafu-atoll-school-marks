import type { Assessment, AssessmentPart, GradeSemesterData, Subject, SubjectResultVisibility } from '@/lib/types';
import type { SheetKind } from '@/lib/school';

export type { SheetKind } from '@/lib/school';

export type AssessmentAbsence = 'MC' | 'OL';

export type MarkValue = { mark: number | null; absence: AssessmentAbsence | null };

export type MarkIndex = Map<string, MarkValue>;

export type AssessmentResult = {
  assessmentId: string;
  name: string;
  max: number;
  weight: number;
  part: AssessmentPart;
  mark: number | null;
  absence: AssessmentAbsence | null;
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
  showUnitPoints: boolean;
  showTermMarks: boolean;
  showTermPoints: boolean;
  exempted: { assessmentId: string; name: string; absence: AssessmentAbsence }[];
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

export function buildMarkIndex(rows: { student_id: string; assessment_id: string; mark: number; absence_type?: string | null }[]): MarkIndex {
  return new Map(
    rows.map((row) => [
      markKey(row.student_id, row.assessment_id),
      { mark: row.mark, absence: row.absence_type === 'MC' || row.absence_type === 'OL' ? row.absence_type : null } as MarkValue,
    ]),
  );
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

function partPoints(rows: AssessmentResult[], sheet: SheetKind, part: AssessmentPart, scale = SECONDARY_PART_POINTS[part]): number {
  if (rows.length === 0) return 0;
  const configuredPoints = rows.reduce((sum, row) => sum + row.weight, 0);
  if (configuredPoints <= 0) return 0;
  const earnedPoints = rows.reduce((sum, row) => sum + ((row.mark ?? 0) / row.max) * row.weight, 0);
  return round2((earnedPoints / configuredPoints) * scale);
}

function summarisePart(rows: AssessmentResult[], sheet: SheetKind, part: AssessmentPart, calculationRows = rows): PartSummary {
  return {
    obtained: rows.reduce((sum, r) => sum + (r.mark ?? 0), 0),
    max: rows.reduce((sum, r) => sum + r.max, 0),
    points: partPoints(calculationRows, sheet, part),
  };
}

export function computeStudentResult(
  studentId: string,
  subjects: Subject[],
  assessments: Assessment[],
  marks: MarkIndex,
  sheet: SheetKind,
  visibility?: SubjectResultVisibility[],
): StudentResult {
  const subjectResults: SubjectResult[] = subjects.map((subject) => {
    const items = assessments
      .filter((item) => item.subject_id === subject.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const results: AssessmentResult[] = items.map((item) => {
      const value = marks.get(markKey(studentId, item.id));
      const absence = value?.absence ?? null;
      const mark = absence ? null : value?.mark ?? null;
      const percent = percentOf(mark, item.max_mark);
      return {
        assessmentId: item.id,
        name: item.name,
        max: item.max_mark,
        weight: item.weight,
        part: item.part,
        mark,
        absence,
        percent,
        grade: gradeOf(percent, sheet),
      };
    });

    const subjectVisibility = visibility?.find((row) => row.subject_id === subject.id);
    const showUnitPoints = subjectVisibility?.show_unit_points ?? true;
    const showTermMarks = subjectVisibility?.show_term_marks ?? true;
    const showTermPoints = subjectVisibility?.show_term_points ?? true;
    const displayedResults = showTermMarks ? results : results.filter((row) => row.part !== 'term');
    const unitRows = results.filter((row) => row.part === 'unit');
    const termRows = results.filter((row) => row.part === 'term');
    const countedUnitRows = unitRows.filter((row) => row.absence === null);
    const countedTermRows = termRows.filter((row) => row.absence === null);
    const unitPartActive = showUnitPoints && unitRows.length > 0;
    const termPartActive = showTermPoints && termRows.length > 0;
    const unitEntered = countedUnitRows.some((row) => row.mark !== null);
    const termEntered = countedTermRows.some((row) => row.mark !== null);
    const unit = summarisePart(countedUnitRows, sheet, 'unit', unitPartActive ? countedUnitRows : []);
    const term = summarisePart(countedTermRows, sheet, 'term', termPartActive ? countedTermRows : []);

    let percent: number | null = null;
    if (results.length > 0 && (unitEntered || termEntered)) {
      if (sheet === 'secondary') {
        if (unitPartActive && termPartActive) {
          // Keep the 30 + 70 structure: papers not yet entered count as 0 and the
          // total adjusts automatically as more marks are filled in.
          percent = round2((unitPartActive ? unit.points : 0) + (termPartActive ? term.points : 0));
        } else if (unitPartActive) {
          percent = partPoints(countedUnitRows, sheet, 'unit', 100);
        } else {
          percent = partPoints(countedTermRows, sheet, 'term', 100);
        }
      } else {
        const totalWeight = results.reduce((sum, row) => sum + row.weight, 0);
        const earned = results.reduce((sum, row) => sum + ((row.mark ?? 0) / row.max) * row.weight, 0);
        percent = totalWeight > 0 ? round2((earned / totalWeight) * 100) : 0;
      }
    }

    return {
      subjectId: subject.id,
      name: subject.name,
      obtained: displayedResults.reduce((sum, row) => sum + (row.mark ?? 0), 0),
      maxTotal: displayedResults.reduce((sum, row) => sum + row.max, 0),
      percent,
      grade: gradeOf(percent, sheet),
      assessments: displayedResults,
      unit,
      term,
      showUnitPoints,
      showTermMarks,
      showTermPoints,
      exempted: results.filter((row) => row.absence !== null).map((row) => ({ assessmentId: row.assessmentId, name: row.name, absence: row.absence as AssessmentAbsence })),
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
    computeStudentResult(
      student.id,
      data.subjects,
      data.assessments,
      marks,
      sheet,
      data.visibility,
    ),
  );
  return { results, ranks: rankByAverage(results) };
}

export function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${Number(value.toFixed(2))}%`;
}
