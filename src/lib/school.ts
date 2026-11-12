export const SCHOOL_NAME = 'Faafu Atoll School';
export const MARKS_SHEET_YEAR = 2026;

export type SheetKind = 'primary' | 'secondary';

export type ClassOption = {
  value: string;
  label: string;
  sheetKind: SheetKind;
  sortOrder: number;
};

export const CLASSES: ClassOption[] = [
  { value: '1', label: 'Grade 1', sheetKind: 'primary', sortOrder: 1 },
  { value: '2', label: 'Grade 2', sheetKind: 'primary', sortOrder: 2 },
  { value: '3', label: 'Grade 3', sheetKind: 'primary', sortOrder: 3 },
  { value: '4', label: 'Grade 4', sheetKind: 'primary', sortOrder: 4 },
  { value: '5', label: 'Grade 5', sheetKind: 'primary', sortOrder: 5 },
  { value: '6', label: 'Grade 6', sheetKind: 'primary', sortOrder: 6 },
  { value: '7', label: 'Grade 7', sheetKind: 'secondary', sortOrder: 7 },
  { value: '8', label: 'Grade 8', sheetKind: 'secondary', sortOrder: 8 },
  { value: '9BS', label: 'Grade 9 BS', sheetKind: 'secondary', sortOrder: 9 },
  { value: '9SC', label: 'Grade 9 SC', sheetKind: 'secondary', sortOrder: 10 },
  { value: '10BS', label: 'Grade 10 BS', sheetKind: 'secondary', sortOrder: 11 },
  { value: '10SC', label: 'Grade 10 SC', sheetKind: 'secondary', sortOrder: 12 },
];

export type ClassCode = string;

export const SEMESTERS = [
  { value: 1, label: 'Semester 1', dates: '25 Jan - 16 Jul' },
  { value: 2, label: 'Semester 2', dates: '02 Aug - 17 Dec' },
] as const;

export function classLabel(code: string, classes: ClassOption[] = CLASSES): string {
  return classes.find((item) => item.value === code)?.label ?? `Class ${code}`;
}

export function semesterLabel(semester: number): string {
  return SEMESTERS.find((item) => item.value === semester)?.label ?? `Semester ${semester}`;
}
