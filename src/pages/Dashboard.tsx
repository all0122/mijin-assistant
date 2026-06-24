import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Todo, Event, NewsItem } from "../lib/types";
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
  const [loading, setLoading] = useState(true);

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
      setTodos(t || []);
      setDoneTodos(done || []);
      setEvents(e || []);
      setNewsPreview((news || []) as NewsItem[]);
      setLoading(false);
    }
    load();
  }, []);

  const greeting = () => {
    const h = dayjs().hour();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "좋은 오후예요";
    return "좋은 저녁이에요";
  };

  const priorityLabel: Record<string, string> = {
    high: "높음",
    medium: "보통",
    low: "낮음",
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate("todos")}
          className="text-left p-6 transition-all active:scale-95"
          style={{
            background: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: "#0066cc",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {todos.length}
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: 14,
              color: "#7a7a7a",
              letterSpacing: "-0.224px",
            }}
          >
            남은 할일
          </div>
        </button>
        <button
          onClick={() => onNavigate("calendar")}
          className="text-left p-6 transition-all active:scale-95"
          style={{
            background: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: "#0066cc",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {events.length}
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: 14,
              color: "#7a7a7a",
              letterSpacing: "-0.224px",
            }}
          >
            예정된 일정
          </div>
        </button>
      </div>

      {/* 미완료 할일 */}
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
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {todos.map((todo, i) => (
              <div
                key={todo.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: priorityColor[todo.priority] }}
                />
                <span
                  className="flex-1"
                  style={{
                    fontSize: 17,
                    color: "#1d1d1f",
                    letterSpacing: "-0.374px",
                  }}
                >
                  {todo.title}
                </span>
                {(todo.postponed_count || 0) > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#ff9500",
                      background: "#fff8ed",
                      border: "1px solid #fcd34d",
                      borderRadius: 4,
                      padding: "1px 5px",
                      whiteSpace: "nowrap",
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
                <span
                  style={{ fontSize: 12, color: priorityColor[todo.priority] }}
                >
                  {priorityLabel[todo.priority]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

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
        {(() => {
          const today = dayjs().startOf("day");
          const displayEvents = events.filter(
            (ev) => !ev.completed || dayjs(ev.start_time).isSame(today, "day"),
          );
          return displayEvents.length === 0 ? (
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
                        color: ev.completed ? "#7a7a7a" : "#1d1d1f",
                        letterSpacing: "-0.374px",
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
          );
        })()}
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

      {/* 오늘의 뉴스 미리보기 */}
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
                  {item.category === "realestate" ? "부동산" : "갱년기"}
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
