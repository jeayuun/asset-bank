import type { Metadata } from "next";

import { LessonForm } from "@/components/curriculum/lesson-form";
import { LessonRowActions } from "@/components/curriculum/lesson-row-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Curriculum — Asset Bank",
};

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; term?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: grades }, { data: terms }] = await Promise.all([
    supabase.from("grades").select("id, number, label").order("number"),
    supabase.from("terms").select("id, number, label").order("number"),
  ]);

  const selectedGradeNumber = Number(params.grade ?? grades?.[0]?.number ?? 1);
  const selectedTermNumber = Number(params.term ?? terms?.[0]?.number ?? 1);

  const selectedGrade = grades?.find((g) => g.number === selectedGradeNumber);
  const selectedTerm = terms?.find((t) => t.number === selectedTermNumber);

  const { data: lessons } =
    selectedGrade && selectedTerm
      ? await supabase
          .from("lessons")
          .select("id, lesson_number, code, title, is_active")
          .eq("grade_id", selectedGrade.id)
          .eq("term_id", selectedTerm.id)
          .order("lesson_number")
      : { data: [] };

  const rows = lessons ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Curriculum</h1>
        <p className="text-muted-foreground text-sm">
          Manage lessons for a grade and term.
        </p>
      </div>

      <form method="get" className="flex gap-3">
        <select
          name="grade"
          defaultValue={selectedGradeNumber}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {(grades ?? []).map((grade) => (
            <option key={grade.id} value={grade.number}>
              {grade.label}
            </option>
          ))}
        </select>
        <select
          name="term"
          defaultValue={selectedTermNumber}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          {(terms ?? []).map((term) => (
            <option key={term.id} value={term.number}>
              {term.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border-input hover:bg-accent h-9 rounded-md border px-3 text-sm"
        >
          Filter
        </button>
      </form>

      {selectedGrade && selectedTerm && (
        <LessonForm gradeId={selectedGrade.id} termId={selectedTerm.id} />
      )}

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((lesson) => (
              <tr key={lesson.id} className="border-border border-t">
                <td className="px-4 py-2">{lesson.lesson_number}</td>
                <td className="px-4 py-2 font-mono text-xs">{lesson.code}</td>
                <td className="px-4 py-2">{lesson.title}</td>
                <td className="px-4 py-2">
                  {lesson.is_active ? "Active" : "Inactive"}
                </td>
                <td className="px-4 py-2 text-right">
                  <LessonRowActions
                    lessonId={lesson.id}
                    isActive={lesson.is_active}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No lessons yet for this grade and term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
