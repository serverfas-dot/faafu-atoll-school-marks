import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { StudentsManager } from '@/components/admin/StudentsManager';
import { SubjectsManager } from '@/components/admin/SubjectsManager';
import { TeachersManager } from '@/components/admin/TeachersManager';
import { ClassesManager } from '@/components/admin/ClassesManager';
import MarksEntryPage from '@/pages/MarksEntryPage';
import { MarkEntryWindowManager } from '@/components/admin/MarkEntryWindowManager';

const TABS = [
  { id: 'students', label: 'Students', render: () => <StudentsManager /> },
  { id: 'subjects', label: 'Subjects & assessments', render: () => <SubjectsManager /> },
  { id: 'teachers', label: 'Teachers', render: () => <TeachersManager /> },
  { id: 'classes', label: 'Classes', render: () => <ClassesManager /> },
  { id: 'marks', label: 'Marks entry', render: () => <MarksEntryPage /> },
  { id: 'entry-window', label: 'Mark entry window', render: () => <MarkEntryWindowManager /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>('students');
  const active = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <>
      <PageHeader
        title="School admin"
        description="Manage classes, students, subjects, assessments, and which teachers can enter marks for each subject."
      />
      <div role="tablist" aria-label="Admin sections" className="mb-8 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active.render()}
    </>
  );
}
