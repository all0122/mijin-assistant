import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import dayjs from "dayjs";

interface Area {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  sort_order: number;
}

interface AreaTodo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  area_id?: string;
  project?: string;
  created_at: string;
}

interface AiAnalysis {
  id: string;
  content: string;
  created_at: string;
}

const colorMap: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-700",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

const priorityLabel: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};
const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500",
};

export default function Projects() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [todos, setTodos] = useState<AreaTodo[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState({
    title: "",
    due_date: "",
    priority: "medium" as "high" | "medium" | "low",
  });
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [tab, setTab] = useState<"board" | "analysis">("board");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [{ data: aData }, { data: tData }, { data: aiData }] =
      await Promise.all([
        supabase.from("areas").select("*").order("sort_order"),
        supabase
          .from("todos")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_analysis")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
    setAreas(aData || []);
    setTodos(tData || []);
    setAnalysis(aiData?.[0] || null);
  };

  const todosForArea = (areaId: string) =>
    todos.filter((t) => t.area_id === areaId);

  const activeTodos = (areaId: string) =>
    todosForArea(areaId).filter((t) => !t.completed);

  const addTodo = async (areaId: string) => {
    if (!newTodo.title.trim()) return;
    const area = areas.find((a) => a.id === areaId);
    const { data } = await supabase
      .from("todos")
      .insert({
        title: newTodo.title,
        due_date: newTodo.due_date || null,
        priority: newTodo.priority,
        area_id: areaId,
        project: area?.name,
        completed: false,
      })
      .select()
      .single();
    if (data) setTodos((prev) => [data, ...prev]);
    setNewTodo({ title: "", due_date: "", priority: "medium" });
    setAddingTo(null);
  };

  const toggleTodo = async (todo: AreaTodo) => {
    await supabase
      .from("todos")
      .update({ completed: !todo.completed })
      .eq("id", todo.id);
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t,
      ),
    );
  };

  const deleteTodo = async (id: string) => {
    await supabase.from("todos").delete().eq("id", id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const runAnalysis = async () => {
    const apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      alert("설정에서 Claude API 키를 먼저 입력해 주세요.");
      return;
    }
    setAnalyzing(true);
    setTab("analysis");

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      // 전체 할일 요약
      const todosSummary = areas
        .map((area) => {
          const areaTodos = todosForArea(area.id);
          const active = areaTodos.filter((t) => !t.completed);
          const done = areaTodos.filter((t) => t.completed).length;
          return `## ${area.icon} ${area.name}\n설명: ${area.description}\n미완료: ${active.length}개, 완료: ${done}개\n할일 목록:\n${
            active
              .map(
                (t) =>
                  `- [${t.priority}] ${t.title}${t.due_date ? ` (마감: ${t.due_date})` : ""}`,
              )
              .join("\n") || "없음"
          }`;
        })
        .join("\n\n");

      const today = dayjs().format("YYYY년 M월 D일");

      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `오늘은 ${today}입니다.

저는 다음 4개 영역에서 일하고 있는 30대 후반~40대 전도사이자 인플루언서 준비생입니다.

${todosSummary}

위 상황을 바탕으로 다음을 해주세요:

1. **전체 현황 분석** (각 영역의 균형과 리스크)
2. **이번 주 최우선 순위 TOP 5** (이유 포함)
3. **영역별 다음 행동 1가지** (당장 오늘 할 수 있는 것)
4. **데드라인 권장** (마감 없는 중요 할일에 권장 날짜 제안)
5. **한 줄 격려 메시지**

한국어로, 실용적이고 따뜻하게 작성해주세요.`,
          },
        ],
      });

      const content =
        resp.content[0].type === "text" ? resp.content[0].text : "";

      // DB에 저장
      const { data } = await supabase
        .from("ai_analysis")
        .insert({ content })
        .select()
        .single();

      if (data) setAnalysis(data);
    } catch (err: unknown) {
      alert(
        "분석 중 오류가 발생했어요: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const totalActive = todos.filter((t) => !t.completed).length;
  const totalDone = todos.filter((t) => t.completed).length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗂️ 내 업무 영역</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            진행 중 {totalActive}개 · 완료 {totalDone}개
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 transition-all font-medium shadow-sm"
        >
          {analyzing ? (
            <>
              <span className="animate-spin">⟳</span> 분석 중...
            </>
          ) : (
            <>🤖 AI 우선순위 분석</>
          )}
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("board")}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === "board" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          📋 업무 보드
        </button>
        <button
          onClick={() => setTab("analysis")}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === "analysis" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          🤖 AI 분석 결과
          {analysis && (
            <span className="ml-1.5 text-xs opacity-70">
              {dayjs(analysis.created_at).format("M/D")}
            </span>
          )}
        </button>
      </div>

      {/* 업무 보드 */}
      {tab === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {areas.map((area) => {
            const active = activeTodos(area.id);
            const done = todosForArea(area.id).filter(
              (t) => t.completed,
            ).length;
            const colors = colorMap[area.color] || colorMap.indigo;
            const isExpanded = expandedArea === area.id;

            return (
              <div
                key={area.id}
                className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}
              >
                {/* 영역 헤더 */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedArea(isExpanded ? null : area.id)}
                    className="flex items-center gap-2 flex-1"
                  >
                    <span className="text-xl">{area.icon}</span>
                    <div className="text-left">
                      <div className={`font-semibold text-sm ${colors.text}`}>
                        {area.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {area.description}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}
                    >
                      {active.length}개
                    </span>
                    {done > 0 && (
                      <span className="text-xs text-slate-400">{done}완료</span>
                    )}
                  </div>
                </div>

                {/* 할일 목록 */}
                <div className="px-4 pb-3 space-y-1.5">
                  {/* 미완료 할일 (상위 3개, 펼치면 전체) */}
                  {(isExpanded ? active : active.slice(0, 3)).map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2 group"
                    >
                      <button
                        onClick={() => toggleTodo(todo)}
                        className="mt-0.5 w-4 h-4 rounded-full border-2 border-slate-300 hover:border-indigo-400 shrink-0 flex items-center justify-center"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 leading-snug">
                          {todo.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityColor[todo.priority]}`}
                          >
                            {priorityLabel[todo.priority]}
                          </span>
                          {todo.due_date && (
                            <span
                              className={`text-[10px] ${dayjs(todo.due_date).isBefore(dayjs(), "day") ? "text-red-500" : "text-slate-400"}`}
                            >
                              📅 {dayjs(todo.due_date).format("M/D")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 text-lg leading-none shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* 더보기 */}
                  {!isExpanded && active.length > 3 && (
                    <button
                      onClick={() => setExpandedArea(area.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 w-full text-left px-3 py-1"
                    >
                      + {active.length - 3}개 더 보기
                    </button>
                  )}

                  {/* 완료된 항목 (펼쳤을 때) */}
                  {isExpanded &&
                    todosForArea(area.id)
                      .filter((t) => t.completed)
                      .map((todo) => (
                        <div
                          key={todo.id}
                          className="flex items-center gap-2 bg-white/40 rounded-xl px-3 py-1.5 opacity-50"
                        >
                          <span className="text-emerald-500 text-sm">✓</span>
                          <span className="text-sm text-slate-500 line-through">
                            {todo.title}
                          </span>
                        </div>
                      ))}

                  {/* 할일 추가 */}
                  {addingTo === area.id ? (
                    <div className="bg-white rounded-xl p-2.5 space-y-2 mt-1">
                      <input
                        autoFocus
                        placeholder="할일 제목"
                        value={newTodo.title}
                        onChange={(e) =>
                          setNewTodo({ ...newTodo, title: e.target.value })
                        }
                        onKeyDown={(e) => e.key === "Enter" && addTodo(area.id)}
                        className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="date"
                          value={newTodo.due_date}
                          onChange={(e) =>
                            setNewTodo({ ...newTodo, due_date: e.target.value })
                          }
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                        />
                        <select
                          value={newTodo.priority}
                          onChange={(e) =>
                            setNewTodo({
                              ...newTodo,
                              priority: e.target.value as
                                | "high"
                                | "medium"
                                | "low",
                            })
                          }
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                        >
                          <option value="high">높음</option>
                          <option value="medium">보통</option>
                          <option value="low">낮음</option>
                        </select>
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => {
                            setAddingTo(null);
                            setNewTodo({
                              title: "",
                              due_date: "",
                              priority: "medium",
                            });
                          }}
                          className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-500"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => addTodo(area.id)}
                          className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingTo(area.id);
                        setExpandedArea(area.id);
                      }}
                      className="w-full text-left text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      + 할일 추가
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI 분석 결과 탭 */}
      {tab === "analysis" && (
        <div>
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <div className="text-4xl animate-bounce">🤖</div>
              <div className="text-sm">전체 업무를 분석하고 있어요...</div>
              <div className="text-xs text-slate-300">잠시만 기다려 주세요</div>
            </div>
          )}

          {!analyzing && !analysis && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
              <div className="text-5xl">🤖</div>
              <div className="text-center">
                <div className="font-medium text-slate-600 mb-1">
                  아직 분석 결과가 없어요
                </div>
                <div className="text-sm">
                  업무 보드에 할일을 입력한 후 'AI 우선순위 분석'을 눌러보세요
                </div>
              </div>
              <button
                onClick={runAnalysis}
                className="mt-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm px-6 py-2.5 rounded-xl hover:opacity-90 font-medium"
              >
                지금 분석하기
              </button>
            </div>
          )}

          {!analyzing && analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  마지막 분석:{" "}
                  {dayjs(analysis.created_at).format("YYYY년 M월 D일 HH:mm")}
                </span>
                <button
                  onClick={runAnalysis}
                  className="text-xs text-indigo-500 hover:underline"
                >
                  다시 분석
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {analysis.content}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
