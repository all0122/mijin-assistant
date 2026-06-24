import { useEffect, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";
import type { Area, Todo, Event, NewsItem } from "../lib/types";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import MiJin from "../components/MiJin";
dayjs.locale("ko");

interface Props {
  onNavigate: (p: string) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [doneTodos, setDoneTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [newsPreview, setNewsPreview] = useState<NewsItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [allPendingTodos, setAllPendingTodos] = useState<Todo[]>([]);
  const [suggestion, setSuggestion] = useState<string>("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSuggestion = async (
    eventData: Event[],
    allTodos: Todo[],
    areasData: Area[],
    today: string,
    force = false,
  ) => {
    const cacheKey = `dashboard_suggestion_${today}`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setSuggestion(cached);
        return;
      }
    }
    const apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) return;

    setSuggestionLoading(true);
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      const overdue = allTodos.filter(
        (t) => t.due_date && dayjs(t.due_date).isBefore(dayjs(), "day"),
      );
      const todayDue = allTodos.filter(
        (t) => t.due_date && t.due_date === today,
      );

      const byArea = areasData
        .map((area) => {
          const areaTodos = allTodos.filter(
            (t) =>
              t.area_id === area.id || (t.project === area.name && !t.area_id),
          );
          if (areaTodos.length === 0) return null;
          return `[${area.icon} ${area.name}]\n${areaTodos
            .map(
              (t) =>
                `- [${t.priority}] ${t.title}${t.due_date ? ` (마감: ${dayjs(t.due_date).format("M/D")})` : ""}`,
            )
            .join("\n")}`;
        })
        .filter(Boolean) as string[];

      const personalTodos = allTodos.filter(
        (t) => !t.area_id && !areasData.some((a) => a.name === t.project),
      );
      if (personalTodos.length > 0) {
        byArea.push(
          `[🗓️ 개인]\n${personalTodos
            .map(
              (t) =>
                `- [${t.priority}] ${t.title}${t.due_date ? ` (마감: ${dayjs(t.due_date).format("M/D")})` : ""}`,
            )
            .join("\n")}`,
        );
      }

      const todoSummary = byArea.join("\n\n") || "없음";
      const eventSummary =
        eventData
          .map((e) => `- ${dayjs(e.start_time).format("HH:mm")} ${e.title}`)
          .join("\n") || "없음";

      const prompt = `지금은 ${dayjs().format("YYYY년 M월 D일 dddd A h시 mm분")}입니다.

【전체 미완료 할일】
${todoSummary}

【오늘 일정】
${eventSummary}

기한 초과: ${overdue.map((t) => t.title).join(", ") || "없음"}
오늘 마감: ${todayDue.map((t) => t.title).join(", ") || "없음"}

미진님의 전체 상황을 보고 다음을 알려줘:
1. **오늘 최우선 TOP 3** — 각각 이유 한 줄
2. **짬시간(5~10분)에 할 수 있는 것 1가지**

간결하게 번호 리스트로, 친근하게 작성해줘.`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      localStorage.setItem(cacheKey, text);
      setSuggestion(text);
    } catch {
      /* 실패 시 무시 */
    } finally {
      setSuggestionLoading(false);
    }
  };

  const refreshSuggestion = () => {
    const today = dayjs().format("YYYY-MM-DD");
    localStorage.removeItem(`dashboard_suggestion_${today}`);
    loadSuggestion(events, allPendingTodos, areas, today, true);
  };

  useEffect(() => {
    async function load() {
      const today = dayjs().format("YYYY-MM-DD");
      const [{ data: t }, { data: done }, { data: e }, { data: news }] =
        await Promise.all([
          supabase
            .from("todos")
            .select("*")
            .eq("completed", false)
            .order("due_date", { ascending: true })
            .limit(10),
          supabase
            .from("todos")
            .select("*")
            .eq("completed", true)
            .gte("updated_at", today + "T00:00:00")
            .order("updated_at", { ascending: false })
            .limit(10),
          supabase
            .from("events")
            .select("*")
            .gte("start_time", today + "T00:00:00")
            .order("start_time", { ascending: true })
            .limit(5),
          supabase
            .from("news_items")
            .select("*")
            .eq("fetched_date", today)
            .order("created_at", { ascending: true })
            .limit(4),
        ]);
      const todoData = (t || []) as Todo[];
      const eventData = (e || []) as Event[];
      setTodos(todoData);
      setDoneTodos(done || []);
      setEvents(eventData);
      setNewsPreview((news || []) as NewsItem[]);

      // 프로젝트별 섹션용: areas + 전체 미완료 todos
      const [{ data: aData }, { data: allT }] = await Promise.all([
        supabase
          .from("areas")
          .select("id, name, icon, sort_order")
          .order("sort_order"),
        supabase
          .from("todos")
          .select("id, title, area_id, project, priority, due_date")
          .eq("completed", false),
      ]);
      const areasData = (aData || []) as Area[];
      const allTodos = (allT || []) as Todo[];
      setAreas(areasData);
      setAllPendingTodos(allTodos);

      setLoading(false);
      loadSuggestion(eventData, allTodos, areasData, today);
    }
    load();
  }, []);

  const greeting = () => {
    const h = dayjs().hour();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "좋은 오후예요";
    return "좋은 저녁이에요";
  };

  const priorityColor: Record<string, string> = {
    high: "#ff3b30",
    medium: "#ff9500",
    low: "#7a7a7a",
  };

  if (loading)
    return (
      <div
        className="flex items-center justify-center h-64"
        style={{ color: "#7a7a7a" }}
      >
        불러오는 중...
      </div>
    );

  const today = dayjs().format("YYYY-MM-DD");
  const overdueTodos = todos.filter(
    (t) => t.due_date && dayjs(t.due_date).isBefore(dayjs(), "day"),
  );
  const todayDueTodos = todos.filter((t) => t.due_date && t.due_date === today);
  const urgentTodos = [
    ...overdueTodos,
    ...todayDueTodos.filter((t) => !overdueTodos.find((o) => o.id === t.id)),
  ];
  const regularTodos = todos.filter(
    (t) => !t.due_date || dayjs(t.due_date).isAfter(dayjs(), "day"),
  );
  const displayEvents = events.filter(
    (ev) => !ev.completed || dayjs(ev.start_time).isSame(dayjs(), "day"),
  );

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-10">
      {/* 인사 */}
      <div className="flex items-center gap-4">
        <MiJin variant="wave" size={72} />
        <div>
          <h2
            className="font-semibold"
            style={{
              fontSize: 34,
              color: "#1d1d1f",
              letterSpacing: "-0.374px",
              lineHeight: 1.1,
            }}
          >
            미진님, {greeting()}
          </h2>
          <p
            className="mt-1"
            style={{
              fontSize: 17,
              color: "#7a7a7a",
              letterSpacing: "-0.374px",
            }}
          >
            {dayjs().format("YYYY년 M월 D일 dddd")}
          </p>
        </div>
      </div>

      {/* AI 오늘의 제안 */}
      {(suggestion || suggestionLoading) && (
        <div
          style={{
            background: "#f0f7ff",
            border: "1px solid #bfd7f7",
            borderRadius: 14,
            padding: "14px 18px",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 4 }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#0066cc",
                letterSpacing: "-0.224px",
              }}
            >
              💡 오늘의 제안 (TOP 3 + 짬시간)
            </div>
            <button
              onClick={refreshSuggestion}
              disabled={suggestionLoading}
              style={{
                fontSize: 12,
                color: "#0066cc",
                background: "none",
                border: "none",
                cursor: suggestionLoading ? "default" : "pointer",
                opacity: suggestionLoading ? 0.4 : 1,
                padding: 0,
              }}
            >
              다시 생성
            </button>
          </div>
          {suggestionLoading ? (
            <div style={{ fontSize: 14, color: "#7a7a7a" }}>생성 중...</div>
          ) : (
            <div
              style={{
                fontSize: 15,
                color: "#1d1d1f",
                lineHeight: 1.5,
                letterSpacing: "-0.224px",
              }}
            >
              {suggestion}
            </div>
          )}
        </div>
      )}

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onNavigate("todos")}
          className="text-left p-4 transition-all active:scale-95"
          style={{
            background: overdueTodos.length > 0 ? "#fff5f5" : "#ffffff",
            border:
              overdueTodos.length > 0
                ? "1.5px solid #ff3b30"
                : "1px solid #e0e0e0",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: overdueTodos.length > 0 ? "#ff3b30" : "#7a7a7a",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {overdueTodos.length}
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: 12,
              color: overdueTodos.length > 0 ? "#ff3b30" : "#7a7a7a",
              letterSpacing: "-0.224px",
            }}
          >
            기한 초과
          </div>
        </button>
        <button
          onClick={() => onNavigate("todos")}
          className="text-left p-4 transition-all active:scale-95"
          style={{
            background: todayDueTodos.length > 0 ? "#fff8ed" : "#ffffff",
            border:
              todayDueTodos.length > 0
                ? "1.5px solid #ff9500"
                : "1px solid #e0e0e0",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: todayDueTodos.length > 0 ? "#ff9500" : "#7a7a7a",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {todayDueTodos.length}
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: 12,
              color: todayDueTodos.length > 0 ? "#ff9500" : "#7a7a7a",
              letterSpacing: "-0.224px",
            }}
          >
            오늘 마감
          </div>
        </button>
        <button
          onClick={() => onNavigate("calendar")}
          className="text-left p-4 transition-all active:scale-95"
          style={{
            background: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: "#0066cc",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {displayEvents.length}
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: 12,
              color: "#7a7a7a",
              letterSpacing: "-0.224px",
            }}
          >
            예정 일정
          </div>
        </button>
      </div>

      {/* 할일 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3
            style={{
              fontSize: 21,
              fontWeight: 600,
              color: "#1d1d1f",
              letterSpacing: "-0.02em",
            }}
          >
            할일
          </h3>
          <button
            onClick={() => onNavigate("todos")}
            style={{
              fontSize: 14,
              color: "#0066cc",
              letterSpacing: "-0.224px",
            }}
          >
            전체 보기
          </button>
        </div>

        {todos.length === 0 ? (
          <p
            style={{
              fontSize: 17,
              color: "#7a7a7a",
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            <MiJin variant="bounce" size={40} className="mx-auto mb-2" />
            할일이 없어요!
          </p>
        ) : (
          <div className="space-y-3">
            {/* 긴급 섹션 */}
            {urgentTodos.length > 0 && (
              <div
                style={{
                  background: "#fff5f5",
                  border: "1.5px solid #ff3b30",
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "8px 20px 4px",
                    fontSize: 11,
                    color: "#ff3b30",
                    letterSpacing: "-0.224px",
                  }}
                >
                  🔴 지금 처리해야 할 항목
                </div>
                {urgentTodos.map((todo, i) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderTop: i > 0 ? "1px solid #ffe0e0" : "none" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: priorityColor[todo.priority] }}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontSize: 16,
                        color: "#1d1d1f",
                        letterSpacing: "-0.374px",
                      }}
                    >
                      {todo.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
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
                      {todo.due_date && (
                        <span
                          style={{
                            fontSize: 13,
                            color: dayjs(todo.due_date).isBefore(dayjs(), "day")
                              ? "#ff3b30"
                              : "#ff9500",
                          }}
                        >
                          {dayjs(todo.due_date).format("M/D")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 일반 할일 */}
            {regularTodos.length > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e0e0e0",
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                {regularTodos.map((todo, i) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 px-5 py-4"
                    style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: priorityColor[todo.priority] }}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontSize: 17,
                        color: "#1d1d1f",
                        letterSpacing: "-0.374px",
                      }}
                    >
                      {todo.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
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
                      {todo.due_date && (
                        <span
                          style={{
                            fontSize: 14,
                            color: "#7a7a7a",
                            letterSpacing: "-0.224px",
                          }}
                        >
                          {dayjs(todo.due_date).format("M/D")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 프로젝트별 남은 할일 */}
      {areas.some((area) =>
        allPendingTodos.some(
          (t) =>
            t.area_id === area.id || (t.project === area.name && !t.area_id),
        ),
      ) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3
              style={{
                fontSize: 21,
                fontWeight: 600,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
              }}
            >
              프로젝트별
            </h3>
            <button
              onClick={() => onNavigate("projects")}
              style={{
                fontSize: 14,
                color: "#0066cc",
                letterSpacing: "-0.224px",
              }}
            >
              전체 보기
            </button>
          </div>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {areas
              .map((area) => ({
                area,
                count: allPendingTodos.filter(
                  (t) =>
                    t.area_id === area.id ||
                    (t.project === area.name && !t.area_id),
                ).length,
              }))
              .filter(({ count }) => count > 0)
              .map(({ area, count }, i) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      color: "#1d1d1f",
                      letterSpacing: "-0.374px",
                    }}
                  >
                    {area.icon} {area.name}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#ff9500",
                      fontWeight: 500,
                    }}
                  >
                    {count}개
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 예정 일정 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3
            style={{
              fontSize: 21,
              fontWeight: 600,
              color: "#1d1d1f",
              letterSpacing: "-0.02em",
            }}
          >
            일정
          </h3>
          <button
            onClick={() => onNavigate("calendar")}
            style={{
              fontSize: 14,
              color: "#0066cc",
              letterSpacing: "-0.224px",
            }}
          >
            전체 보기
          </button>
        </div>
        {displayEvents.length === 0 ? (
          <p
            style={{
              fontSize: 17,
              color: "#7a7a7a",
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            예정된 일정이 없어요
          </p>
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {displayEvents.map((ev, i) => (
              <div
                key={ev.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}
              >
                <div
                  className="w-1 rounded-full shrink-0"
                  style={{
                    height: 40,
                    background: ev.completed ? "#cccccc" : "#0066cc",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontSize: 17,
                      letterSpacing: "-0.374px",
                      color: ev.completed ? "#7a7a7a" : "#1d1d1f",
                      textDecoration: ev.completed ? "line-through" : "none",
                    }}
                    className="truncate"
                  >
                    {ev.completed && "✓ "}
                    {ev.title}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#7a7a7a",
                      letterSpacing: "-0.224px",
                      marginTop: 2,
                    }}
                  >
                    {dayjs(ev.start_time).format("M월 D일 HH:mm")}
                    {ev.location && ` · ${ev.location}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 오늘 완료한 항목 */}
      {doneTodos.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3
              style={{
                fontSize: 21,
                fontWeight: 600,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
              }}
            >
              오늘 완료{" "}
              <span style={{ color: "#34c759" }}>{doneTodos.length}개</span>
            </h3>
          </div>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {doneTodos.map((todo, i) => (
              <div
                key={todo.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}
              >
                <span style={{ color: "#34c759", fontSize: 16 }}>✓</span>
                <span
                  style={{
                    fontSize: 17,
                    color: "#7a7a7a",
                    letterSpacing: "-0.374px",
                    textDecoration: "line-through",
                  }}
                >
                  {todo.title}
                </span>
              </div>
            ))}
          </div>
          <p
            style={{
              fontSize: 14,
              color: "#7a7a7a",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            <MiJin variant="nod" size={36} className="inline-block mr-2" />
            오늘 이만큼 해냈어요!
          </p>
        </section>
      )}

      {/* 오늘의 뉴스 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3
            style={{
              fontSize: 21,
              fontWeight: 600,
              color: "#1d1d1f",
              letterSpacing: "-0.02em",
            }}
          >
            오늘의 뉴스
          </h3>
          <button
            onClick={() => onNavigate("news")}
            style={{
              fontSize: 14,
              color: "#0066cc",
              letterSpacing: "-0.224px",
            }}
          >
            전체 보기
          </button>
        </div>
        {newsPreview.length === 0 ? (
          <button
            onClick={() => onNavigate("news")}
            className="w-full text-left transition-all active:scale-95"
            style={{
              padding: "16px 20px",
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              fontSize: 15,
              color: "#7a7a7a",
              letterSpacing: "-0.374px",
              cursor: "pointer",
            }}
          >
            📰 오늘의 뉴스 가져오기 →
          </button>
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {newsPreview.map((item, i) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-5 py-4"
                style={{
                  borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
                  textDecoration: "none",
                  display: "flex",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#fff",
                    background:
                      item.category === "realestate" ? "#0066cc" : "#34c759",
                    borderRadius: 4,
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                    marginTop: 3,
                    flexShrink: 0,
                  }}
                >
                  {item.category === "realestate"
                    ? "부동산"
                    : item.category === "stocks"
                      ? "주식"
                      : "갱년기"}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    color: "#1d1d1f",
                    letterSpacing: "-0.374px",
                    lineHeight: 1.4,
                  }}
                >
                  {item.title}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* AI 비서 */}
      <button
        onClick={() => onNavigate("ai")}
        className="w-full flex items-center gap-5 px-6 py-5 transition-all active:scale-95"
        style={{
          background: "#0066cc",
          borderRadius: 18,
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 32 }}>🤖</span>
        <div className="text-left">
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "#ffffff",
              letterSpacing: "-0.374px",
            }}
          >
            AI 비서에게 물어보기
          </div>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              marginTop: 2,
              letterSpacing: "-0.224px",
            }}
          >
            일정, 할일, 콘텐츠 아이디어 — 뭐든지
          </div>
        </div>
      </button>
    </div>
  );
}
