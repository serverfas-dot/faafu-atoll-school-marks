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
  school_year: number;
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
  is_active: boolean;
};

export type MarkRow = {
  student_id: string;
  assessment_id: string;
  mark: number;
  absence_type?: string | null;
};

export type SubjectResultVisibility = {
  subject_id: string;
  school_year: number;
  semester: number;
  show_unit_points: boolean;
  show_term_marks: boolean;
  show_term_points: boolean;
};

export type GradeSemesterData = {
  students: Student[];
  subjects: Subject[];
  assessments: Assessment[];
  marks: MarkRow[];
  visibility: SubjectResultVisibility[];
};
