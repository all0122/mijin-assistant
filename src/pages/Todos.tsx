import { useEffect, useState } from "react";
import MiJin from "../components/MiJin";
import { supabase } from "../lib/supabase";
import type { Area, Todo } from "../lib/types";
import dayjs from "dayjs";

const PRIORITIES = ["high", "medium", "low"] as const;
const priorityLabel: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};
const priorityDot: Record<string, string> = {
  high: "#ff3b30",
  medium: "#ff9500",
  low: "#7a7a7a",
};

const empty = (): Omit<Todo, "id" | "created_at"> => ({
  title: "",
  description: "",
  due_date: "",
  completed: false,
  priority: "medium",
  project: "",
  area_id: "",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e0e0e0",
  borderRadius: 11,
  padding: "10px 14px",
  fontSize: 17,
  letterSpacing: "-0.374px",
  color: "#1d1d1f",
  background: "#fff",
  outline: "none",
};

export default function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "done">("active");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: todosData }, { data: areasData }] = await Promise.all([
      supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("areas").select("*").order("sort_order"),
    ]);
    setTodos(todosData || []);
    setAreas(areasData || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const toggle = async (todo: Todo) => {
    await supabase
      .from("todos")
      .update({
        completed: !todo.completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id);
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t,
      ),
    );
  };

  const remove = async (id: string) => {
    await supabase.from("todos").delete().eq("id", id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const postpone = async (todo: Todo) => {
    const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
    const newCount = (todo.postponed_count || 0) + 1;
    await supabase
      .from("todos")
      .update({
        due_date: tomorrow,
        postponed_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id);
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? { ...t, due_date: tomorrow, postponed_count: newCount }
          : t,
      ),
    );
  };

  const cancelPostpone = async (todo: Todo) => {
    const prevDate = dayjs(todo.due_date)
      .subtract(1, "day")
      .format("YYYY-MM-DD");
    const newCount = Math.max(0, (todo.postponed_count || 1) - 1);
    await supabase
      .from("todos")
      .update({
        due_date: prevDate,
        postponed_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todo.id);
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? { ...t, due_date: prevDate, postponed_count: newCount }
          : t,
      ),
    );
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("todos")
      .insert({
        ...form,
        due_date: form.due_date || null,
        project: form.project || null,
        area_id: form.area_id || null,
      })
      .select()
      .single();
    if (data) setTodos((prev) => [data, ...prev]);
    setForm(empty());
    setShowForm(false);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <h2
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: "#1d1d1f",
            letterSpacing: "-0.374px",
          }}
        >
          할일
        </h2>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#0066cc",
            color: "#fff",
            borderRadius: 9999,
            padding: "8px 20px",
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.224px",
          }}
        >
          + 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        {(["active", "all", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 14,
              padding: "6px 16px",
              borderRadius: 9999,
              border: filter === f ? "none" : "1px solid #e0e0e0",
              background: filter === f ? "#1d1d1f" : "#fff",
              color: filter === f ? "#fff" : "#7a7a7a",
              cursor: "pointer",
              letterSpacing: "-0.224px",
            }}
          >
            {f === "active" ? "미완료" : f === "done" ? "완료" : "전체"}
          </button>
        ))}
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div
          className="mb-6 space-y-3"
          style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 18,
            padding: 20,
          }}
        >
          <input
            autoFocus
            placeholder="할일 제목 *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="설명 (선택)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={inputStyle}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({
                  ...form,
                  priority: e.target.value as Todo["priority"],
                })
              }
              style={{ ...inputStyle, flex: 1 }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p]}
                </option>
              ))}
            </select>
          </div>
          <select
            value={form.area_id}
            onChange={(e) => {
              const area = areas.find((a) => a.id === e.target.value);
              setForm({
                ...form,
                area_id: e.target.value,
                project: area?.name || "",
              });
            }}
            style={inputStyle}
          >
            <option value="">프로젝트 없음</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setForm(empty());
              }}
              style={{
                fontSize: 15,
                padding: "8px 18px",
                borderRadius: 9999,
                border: "1px solid #e0e0e0",
                background: "#fff",
                color: "#1d1d1f",
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                fontSize: 15,
                padding: "8px 18px",
                borderRadius: 9999,
                border: "none",
                background: "#0066cc",
                color: "#fff",
                cursor: "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#7a7a7a",
            padding: "64px 0",
            fontSize: 17,
          }}
        >
          <MiJin
            variant={filter === "done" ? "nod" : "bounce"}
            size={56}
            className="mx-auto mb-3"
          />
          {filter === "done" ? "완료된 할일이 없어요" : "할일이 없어요!"}
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {filtered.map((todo, i) => (
            <div
              key={todo.id}
              className="flex items-start gap-4 group"
              style={{
                padding: "14px 20px",
                borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
                opacity: todo.completed ? 0.55 : 1,
              }}
            >
              {/* 체크 버튼 */}
              <button
                onClick={() => toggle(todo)}
                className="shrink-0 flex items-center justify-center transition-all active:scale-95"
                style={{
                  marginTop: 2,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: todo.completed ? "none" : `2px solid #e0e0e0`,
                  background: todo.completed ? "#34c759" : "transparent",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 12,
                }}
              >
                {todo.completed && "✓"}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 17,
                    letterSpacing: "-0.374px",
                    textDecoration: todo.completed ? "line-through" : "none",
                    color: todo.completed ? "#7a7a7a" : "#1d1d1f",
                  }}
                >
                  {todo.title}
                </div>
                {todo.description && (
                  <div
                    style={{
                      fontSize: 14,
                      color: "#7a7a7a",
                      marginTop: 2,
                      letterSpacing: "-0.224px",
                    }}
                  >
                    {todo.description}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    style={{ fontSize: 12, color: priorityDot[todo.priority] }}
                  >
                    ● {priorityLabel[todo.priority]}
                  </span>
                  {todo.project && (
                    <span style={{ fontSize: 12, color: "#0066cc" }}>
                      {todo.project}
                    </span>
                  )}
                  {todo.due_date && (
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          !todo.completed &&
                          dayjs(todo.due_date).isBefore(dayjs(), "day")
                            ? "#ff3b30"
                            : "#7a7a7a",
                      }}
                    >
                      {dayjs(todo.due_date).format("M월 D일")}
                    </span>
                  )}
                  {(todo.postponed_count || 0) > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#ff9500",
                        background: "#fff8ed",
                        border: "1px solid #fcd34d",
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      {todo.postponed_count}번 미룸
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!todo.completed && (todo.postponed_count || 0) > 0 && (
                  <button
                    onClick={() => cancelPostpone(todo)}
                    title="미룸 취소"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    style={{
                      fontSize: 14,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ff9500",
                      padding: "2px 4px",
                    }}
                  >
                    ↩
                  </button>
                )}
                {!todo.completed && (
                  <button
                    onClick={() => postpone(todo)}
                    title="내일로 미루기"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    style={{
                      fontSize: 14,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ff9500",
                      padding: "2px 4px",
                    }}
                  >
                    →내일
                  </button>
                )}
                <button
                  onClick={() => remove(todo.id)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  style={{
                    color: "#cccccc",
                    fontSize: 20,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
