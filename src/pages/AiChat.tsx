import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";
import * as gcal from "../lib/googleCalendar";
import type { Message, Todo, Event } from "../lib/types";
import MiJin from "../components/MiJin";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const QUICK = [
  "이번 주 제일 중요한 게 뭐야?",
  "데드라인 임박한 거 알려줘",
  "지금 뭐 하면 좋을까?",
  "오늘 시간 계획 짜줘",
];

interface Props {
  onNavigate?: (page: string) => void;
}

export default function AiChat({ onNavigate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [googleEvents, setGoogleEvents] = useState<
    { title: string; start: string; location?: string }[]
  >([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("anthropic_api_key") || "");
    loadContext();
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isNearBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setIsNearBottom(nearBottom);
  };

  const loadContext = async () => {
    const today = dayjs().format("YYYY-MM-DD");
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase
        .from("todos")
        .select("*")
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(30),
      supabase
        .from("events")
        .select("*")
        .gte("start_time", today + "T00:00:00")
        .order("start_time", { ascending: true })
        .limit(20),
    ]);
    setTodos((t || []) as Todo[]);
    setEvents((e || []) as Event[]);

    // 구글 캘린더 연결된 경우 이벤트 추가 로드
    if (gcal.isConnected()) {
      try {
        const clientId = gcal.getClientId();
        if (clientId && window.gapi) {
          await gcal.initGapi();
          gcal.initGis(clientId);
        }
        const { events: gEvents } = await gcal.fetchEvents(
          dayjs().toISOString(),
          dayjs().add(30, "day").toISOString(),
        );
        setGoogleEvents(
          gEvents.map((ev) => ({
            title: ev.summary || "(제목 없음)",
            start: ev.start.dateTime || ev.start.date || "",
            location: ev.location,
          })),
        );
      } catch {
        // 구글 캘린더 로드 실패 시 무시
      }
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          content:
            "⚠️ Claude API 키가 설정되지 않았어요. 설정 화면에서 API 키를 입력해 주세요.",
        },
      ]);
      setInput("");
      return;
    }
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsNearBottom(true);
    setLoading(true);
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const todoList =
        todos.length === 0
          ? "없음"
          : todos
              .map((t) => {
                const due = t.due_date
                  ? ` (마감: ${dayjs(t.due_date).format("M/D")})`
                  : "";
                const priority =
                  t.priority === "high"
                    ? "🔴"
                    : t.priority === "medium"
                      ? "🟡"
                      : "⚪";
                return `${priority} ${t.title}${due}`;
              })
              .join("\n");

      const supabaseEventList = events
        .map(
          (e) =>
            `- ${dayjs(e.start_time).format("M/D HH:mm")} ${e.title}${e.location ? ` (${e.location})` : ""}`,
        )
        .join("\n");

      const googleEventList = googleEvents
        .map(
          (e) =>
            `- ${dayjs(e.start).format("M/D HH:mm")} ${e.title}${e.location ? ` (${e.location})` : ""}`,
        )
        .join("\n");

      const eventList =
        supabaseEventList || googleEventList
          ? [supabaseEventList, googleEventList].filter(Boolean).join("\n")
          : "없음";

      const systemPrompt = `당신은 미진님의 전담 개인 비서입니다. 지금은 ${dayjs().format("YYYY년 M월 D일 dddd A h시 mm분")}입니다.

【미진님의 할일 목록】
${todoList}

【앞으로의 일정 (앱 + 구글 캘린더)】
${eventList}

비서로서 역할:
- 위 할일과 일정을 실제로 파악해서 "이것부터 하세요"처럼 구체적으로 알려줍니다
- 데드라인이 임박한 일, 놓치면 안 될 일을 먼저 짚어줍니다
- 여유 시간이 생기면 그 시간에 맞는 일을 추천합니다
- 평가하거나 분석하지 않고, 실제로 도움이 되는 행동만 제안합니다
- 잡담, 고민, 아이디어도 함께 이야기합니다

말투: 친근하고 간결하게. "~하시는 게 어떨까요?" 대신 "~하는 게 좋겠어요"처럼 적극적으로.`;
      const history = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
      });
      const reply =
        response.content[0].type === "text" ? response.content[0].text : "";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `오류가 발생했어요: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const greeting =
    todos.length > 0 || events.length > 0
      ? `안녕하세요 미진님! 할일 ${todos.length}개, 일정 ${events.length}개가 있어요.\n\n뭐부터 챙겨드릴까요?`
      : "안녕하세요 미진님! 오늘 필요한 거 뭐든지 말씀해 주세요.";

  const displayMessages =
    messages.length === 0
      ? [{ role: "assistant" as const, content: greeting }]
      : messages;

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-[calc(100dvh-80px)] md:h-dvh">
      {/* 헤더 */}
      <div
        className="px-6 py-5 shrink-0"
        style={{ borderBottom: "1px solid #f0f0f0", background: "#fff" }}
      >
        <h2
          style={{
            fontSize: 21,
            fontWeight: 600,
            color: "#1d1d1f",
            letterSpacing: "-0.02em",
          }}
        >
          AI 비서
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#7a7a7a",
            marginTop: 2,
            letterSpacing: "-0.224px",
          }}
        >
          미완료 할일 {todos.length}개 · 예정 일정 {events.length}개
        </p>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-hide"
        style={{ background: "#f5f5f7" }}
      >
        {displayMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <MiJin variant="nod" size={34} className="mr-2 mt-0.5" />
            )}
            <div
              className="max-w-[80%] whitespace-pre-wrap"
              style={{
                padding: "12px 16px",
                borderRadius:
                  msg.role === "user"
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                fontSize: 15,
                letterSpacing: "-0.224px",
                lineHeight: 1.47,
                background: msg.role === "user" ? "#0066cc" : "#ffffff",
                color: msg.role === "user" ? "#ffffff" : "#1d1d1f",
                border: msg.role === "assistant" ? "1px solid #e0e0e0" : "none",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <MiJin variant="bounce" size={34} className="mr-2" />
            <div
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "18px 18px 18px 4px",
                padding: "12px 16px",
              }}
            >
              <div className="flex gap-1 items-center h-5">
                {[0, 150, 300].map((d) => (
                  <div
                    key={d}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "#cccccc", animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 질문 */}
      {messages.length === 0 && (
        <div
          className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0"
          style={{ background: "#f5f5f7" }}
        >
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput(q);
                textareaRef.current?.focus();
              }}
              className="shrink-0 transition-all active:scale-95"
              style={{
                fontSize: 13,
                padding: "6px 14px",
                borderRadius: 9999,
                background: "#fff",
                border: "1px solid #e0e0e0",
                color: "#0066cc",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* API 키 미설정 경고 */}
      {!apiKey && (
        <div
          className="mx-4 mb-2 flex items-center justify-between gap-3"
          style={{
            fontSize: 13,
            color: "#7a7a7a",
            background: "#fff8ed",
            border: "1px solid #fcd34d",
            borderRadius: 11,
            padding: "10px 14px",
          }}
        >
          <span>
            ⚠️ Claude API 키가 필요해요.{" "}
            <span style={{ color: "#aaa" }}>
              (새 기기에서는 매번 입력해야 해요)
            </span>
          </span>
          {onNavigate && (
            <button
              onClick={() => onNavigate("settings")}
              style={{
                fontSize: 13,
                color: "#0066cc",
                background: "none",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontWeight: 600,
                padding: 0,
              }}
            >
              설정 →
            </button>
          )}
        </div>
      )}

      {/* 입력창 */}
      <div
        className="px-4 pb-6 pt-3 shrink-0"
        style={{ background: "#fff", borderTop: "1px solid #f0f0f0" }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Enter로 전송)"
            rows={1}
            className="flex-1 resize-none scrollbar-hide"
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 22,
              padding: "10px 16px",
              fontSize: 15,
              letterSpacing: "-0.224px",
              color: "#1d1d1f",
              outline: "none",
              maxHeight: 120,
              overflowY: "auto",
              background: "#f5f5f7",
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 flex items-center justify-center transition-all active:scale-95"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: loading || !input.trim() ? "#e0e0e0" : "#0066cc",
              color: "#fff",
              cursor: loading || !input.trim() ? "default" : "pointer",
            }}
          >
            <svg
              className="w-5 h-5 rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
