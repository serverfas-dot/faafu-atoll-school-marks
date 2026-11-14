import { SEMESTERS, type ClassOption } from '@/lib/school';
import type { SchoolYear } from '@/lib/schoolYears';
import { SelectField } from '@/components/ui';

export function ClassSemesterPicker({
  classes,
  classCode,
  semester,
  onClassChange,
  onSemesterChange,
  years,
  schoolYear,
  onSchoolYearChange,
}: {
  classes: ClassOption[];
  classCode: string;
  semester: number;
  onClassChange: (classCode: string) => void;
  onSemesterChange: (semester: number) => void;
  years?: SchoolYear[];
  schoolYear?: number;
  onSchoolYearChange?: (schoolYear: number) => void;
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${years && schoolYear !== undefined && onSchoolYearChange ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {years && schoolYear !== undefined && onSchoolYearChange && (
        <SelectField label="School year" value={String(schoolYear)} onChange={(value) => onSchoolYearChange(Number(value))}>
          {years.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField label="Class" value={classCode} onChange={onClassChange}>
        {classes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Semester" value={String(semester)} onChange={(value) => onSemesterChange(Number(value))}>
        {SEMESTERS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label} ({item.dates})
          </option>
        ))}
      </SelectField>
    </div>
  );
}
