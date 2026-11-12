import type { SheetKind, StudentResult } from '@/lib/grading';
import type { Student } from '@/lib/types';

export type OutcomeSummary = {
  pass: number;
  fail: number;
  total: number;
  passRate: number;
  failRate: number;
};

export type AssessmentOutcome = OutcomeSummary & {
  id: string;
  name: string;
  subjectName: string;
};

export type GradeDistribution = {
  grade: string;
  count: number;
  percentage: number;
};

export type AggregateRow = {
  student: Student;
  semesterOne: number | null;
  semesterTwo: number | null;
  aggregate: number | null;
  finalGrade: string;
  rank: number | null;
};

export function isPassingGrade(grade: string, sheet: SheetKind): boolean {
  return sheet === 'secondary' ? ['A*', 'A', 'B', 'C'].includes(grade) : ['FA', 'MA'].includes(grade);
}

export function summariseOutcomes(grades: string[], sheet: SheetKind): OutcomeSummary {
  const pass = grades.filter((grade) => isPassingGrade(grade, sheet)).length;
  const total = grades.length;
  const fail = total - pass;
  return {
    pass,
    fail,
    total,
    passRate: total === 0 ? 0 : (pass / total) * 100,
    failRate: total === 0 ? 0 : (fail / total) * 100,
  };
}

export function summariseClass(results: StudentResult[], sheet: SheetKind): OutcomeSummary {
  return summariseOutcomes(results.map((result) => result.finalGrade), sheet);
}

export function buildAssessmentOutcomes(results: StudentResult[], sheet: SheetKind): AssessmentOutcome[] {
  const byAssessment = new Map<string, { name: string; subjectName: string; grades: string[] }>();
  results.forEach((result) => {
    result.subjects.forEach((subject) => {
      subject.assessments.forEach((assessment) => {
        const current = byAssessment.get(assessment.assessmentId) ?? {
          name: assessment.name,
          subjectName: subject.name,
          grades: [],
        };
        current.grades.push(assessment.grade);
        byAssessment.set(assessment.assessmentId, current);
      });
    });
  });

  return [...byAssessment.entries()].map(([id, item]) => ({
    id,
    name: item.name,
    subjectName: item.subjectName,
    ...summariseOutcomes(item.grades, sheet),
  }));
}

export function buildGradeDistribution(results: StudentResult[], sheet: SheetKind): GradeDistribution[] {
  const order = sheet === 'secondary' ? ['A*', 'A', 'B', 'C', 'D', 'E', 'U'] : ['FA', 'MA', 'A', '-'];
  const counts = new Map<string, number>();
  results.forEach((result) => counts.set(result.finalGrade, (counts.get(result.finalGrade) ?? 0) + 1));
  return order
    .filter((grade) => counts.has(grade))
    .map((grade) => ({
      grade,
      count: counts.get(grade) ?? 0,
      percentage: results.length === 0 ? 0 : ((counts.get(grade) ?? 0) / results.length) * 100,
    }));
}

export function buildAggregateRows(
  students: Student[],
  semesterOne: StudentResult[],
  semesterTwo: StudentResult[],
  sheet: SheetKind,
): AggregateRow[] {
  const firstById = new Map(semesterOne.map((result) => [result.studentId, result]));
  const secondById = new Map(semesterTwo.map((result) => [result.studentId, result]));
  const rows: AggregateRow[] = students.map((student) => {
    const first = firstById.get(student.id)?.average ?? null;
    const second = secondById.get(student.id)?.average ?? null;
    const aggregate = first !== null && second !== null ? round2((first + second) / 2) : null;
    return {
      student,
      semesterOne: first,
      semesterTwo: second,
      aggregate,
      finalGrade: aggregate === null ? '-' : gradeForAggregate(aggregate, sheet),
      rank: null,
    };
  });
  const ranked = [...rows]
    .filter((row) => row.aggregate !== null)
    .sort((a, b) => (b.aggregate ?? -1) - (a.aggregate ?? -1));
  ranked.forEach((row, index) => {
    row.rank = index === 0 || row.aggregate !== ranked[index - 1].aggregate ? index + 1 : ranked[index - 1].rank;
  });
  return rows;
}

function gradeForAggregate(average: number, sheet: SheetKind): string {
  if (sheet === 'secondary') {
    if (average > 89.4) return 'A*';
    if (average > 74.5) return 'A';
    if (average > 64.4) return 'B';
    if (average > 49.4) return 'C';
    if (average > 39.4) return 'D';
    if (average > 24.4) return 'E';
    return 'U';
  }
  if (average > 89.4) return 'FA';
  if (average > 59.4) return 'MA';
  if (average > 1) return 'A';
  return '-';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
