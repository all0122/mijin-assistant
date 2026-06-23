import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";
import type { Message } from "../lib/types";
import MiJin from "../components/MiJin";
import dayjs from "dayjs";

const SYSTEM_PROMPT = `당신은 사용자의 개인 AI 비서입니다. 한국어로 친근하고 간결하게 답변하세요.

사용자의 일정, 할일, 메모, 연락처를 관리하는 앱의 비서입니다.
현재 날짜: ${dayjs().format("YYYY년 M월 D일 dddd")}

다음과 같은 일을 도울 수 있습니다:
- 일정/할일/메모 추가 방법 안내
- 우선순위 조언
- 일정 정리 및 계획 수립
- 업무 관련 조언 및 아이디어
- 일반적인 질문 답변

답변은 핵심만 간결하게 해주세요.`;

const QUICK = [
  "오늘 할일 정리해줘",
  "이번 주 계획 세우는 법 알려줘",
  "집중력 높이는 팁",
  "업무 우선순위 정하는 방법",
];

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "안녕하세요! 저는 당신의 AI 비서예요 🤖\n\n일정 추가, 할일 정리, 아이디어 정리 등 무엇이든 도와드릴게요. 무엇을 도와드릴까요?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [todoCount, setTodoCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("anthropic_api_key") || "");
    loadContext();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadContext = async () => {
    const today = dayjs().format("YYYY-MM-DD");
    const [{ count: tc }, { count: ec }] = await Promise.all([
      supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("completed", false),
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("start_time", today),
    ]);
    setTodoCount(tc || 0);
    setEventCount(ec || 0);
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
    setLoading(true);
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const contextNote = `\n\n[현재 상태: 미완료 할일 ${todoCount}개, 예정 일정 ${eventCount}개]`;
      const history = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + contextNote,
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

  return (
    <div
      className="flex flex-col max-w-2xl mx-auto"
      style={{ height: "calc(100vh - 0px)" }}
    >
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
          미완료 할일 {todoCount}개 · 예정 일정 {eventCount}개
        </p>
      </div>

      {/* 메시지 영역 */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-hide"
        style={{ background: "#f5f5f7" }}
      >
        {messages.map((msg, i) => (
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
      {messages.length <= 1 && (
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
          className="mx-4 mb-2"
          style={{
            fontSize: 13,
            color: "#7a7a7a",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 11,
            padding: "10px 14px",
          }}
        >
          ⚠️ 설정에서 Claude API 키를 입력해야 AI 기능을 사용할 수 있어요.
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
