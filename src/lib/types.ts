export type Role = 'super_admin' | 'admin' | 'teacher';

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
};

export type Student = {
  id: string;
  full_name: string;
  roll_no: string;
  class_name: string;
  photo_url?: string | null;
};

export type Subject = {
  id: string;
  name: string;
  class_name: string;
  sort_order: number;
};

export type AssessmentPart = 'unit' | 'term';

export type Assessment = {
  id: string;
  subject_id: string;
  school_year: number;
  semester: number;
  name: string;
  max_mark: number;
  weight: number;
  part: AssessmentPart;
  sort_order: number;
};

export type MarkRow = {
  student_id: string;
  assessment_id: string;
  mark: number;
};

export type GradeSemesterData = {
  students: Student[];
  subjects: Subject[];
  assessments: Assessment[];
  marks: MarkRow[];
};
