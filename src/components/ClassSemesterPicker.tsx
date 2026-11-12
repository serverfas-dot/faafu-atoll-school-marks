import { SEMESTERS, type ClassOption } from '@/lib/school';
import { SelectField } from '@/components/ui';

export function ClassSemesterPicker({
  classes,
  classCode,
  semester,
  onClassChange,
  onSemesterChange,
}: {
  classes: ClassOption[];
  classCode: string;
  semester: number;
  onClassChange: (classCode: string) => void;
  onSemesterChange: (semester: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
