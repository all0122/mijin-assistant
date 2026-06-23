import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Event } from "../lib/types";
import * as gcal from "../lib/googleCalendar";
import MiJin from "../components/MiJin";
import dayjs from "dayjs";
import "dayjs/locale/ko";
dayjs.locale("ko");

const colorClass: Record<string, string> = {
  indigo: "bg-indigo-400",
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};
// 구글 캘린더 colorId → 표시색
const gColorMap: Record<string, string> = {
  "1": "#ef4444",
  "2": "#22c55e",
  "3": "#a855f7",
  "4": "#f97316",
  "5": "#eab308",
  "6": "#06b6d4",
  "7": "#3b82f6",
  "8": "#64748b",
  "9": "#ec4899",
  "10": "#10b981",
  "11": "#6366f1",
};

interface UnifiedEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  source: "local" | "google";
  color?: string;
}

const emptyForm = () => ({
  title: "",
  description: "",
  start_time: dayjs().format("YYYY-MM-DDTHH:mm"),
  end_time: "",
  location: "",
  color: "indigo",
  saveToGoogle: true,
});

export default function Calendar() {
  const [current, setCurrent] = useState(dayjs());
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<UnifiedEvent | null>(null);
  const [googleConnected, setGoogleConnected] = useState(gcal.isConnected());
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [gapiReady, setGapiReady] = useState(false);

  // 이번 달 이벤트 로드
  const loadEvents = useCallback(async () => {
    const start = current.startOf("month");
    const end = current.endOf("month");

    // 로컬 DB 이벤트
    const { data: localData } = await supabase
      .from("events")
      .select("*")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time");

    const localEvents: UnifiedEvent[] = ((localData as Event[]) || []).map(
      (e) => ({
        id: e.id,
        title: e.title,
        start: e.start_time,
        end: e.end_time,
        location: e.location,
        description: e.description,
        source: "local",
        color: e.color,
      }),
    );

    // 구글 캘린더 이벤트
    let googleEvents: UnifiedEvent[] = [];
    if (gcal.isConnected()) {
      setLoadingGoogle(true);
      setGoogleError(null);
      const { events: gEvents, error } = await gcal.fetchEvents(
        start.toISOString(),
        end.toISOString(),
      );
      if (error) setGoogleError(error);
      googleEvents = gEvents.map((e) => ({
        id: `g_${e.id}`,
        title: e.summary || "(제목 없음)",
        start: e.start.dateTime || e.start.date || "",
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        description: e.description,
        source: "google",
        color: e.colorId ? gColorMap[e.colorId] : "#4f46e5",
      }));
      setLoadingGoogle(false);
    }

    // 합쳐서 시간순 정렬
    setEvents(
      [...localEvents, ...googleEvents].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    );
  }, [current]);

  // 구글 GAPI 초기화
  useEffect(() => {
    const clientId = gcal.getClientId();
    if (!clientId) {
      loadEvents();
      return;
    }
    const initAll = () => {
      gcal.initGapi().then(() => {
        gcal.initGis(clientId);
        setGapiReady(true);
      });
    };
    if (window.gapi) initAll();
    else window.addEventListener("load", initAll, { once: true });
  }, []);

  // gapi 준비 완료되거나 월이 바뀔 때 이벤트 로드
  useEffect(() => {
    if (gcal.isConnected() && !gapiReady) return; // gapi 초기화 기다리기
    loadEvents();
  }, [loadEvents, gapiReady]);

  useEffect(() => {
    const handler = () => {
      setGoogleConnected(gcal.isConnected());
      loadEvents();
    };
    window.addEventListener("google-auth-changed", handler);
    return () => window.removeEventListener("google-auth-changed", handler);
  }, [loadEvents]);

  const connectGoogle = async () => {
    const clientId = gcal.getClientId();
    if (!clientId) {
      alert("설정에서 Google Client ID를 먼저 입력해 주세요.");
      return;
    }
    await gcal.initGapi();
    gcal.initGis(clientId);
    gcal.requestToken();
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      // 로컬 DB 저장
      const { data } = await supabase
        .from("events")
        .insert({
          title: form.title,
          description: form.description || null,
          start_time: form.start_time,
          end_time: form.end_time || null,
          location: form.location || null,
          color: form.color,
        })
        .select()
        .single();

      // 구글 캘린더에도 저장
      if (form.saveToGoogle && gcal.isConnected()) {
        await gcal.createEvent({
          title: form.title,
          description: form.description,
          location: form.location,
          start: form.start_time,
          end: form.end_time || undefined,
        });
      }

      if (data) {
        setEvents((prev) =>
          [
            ...prev,
            {
              id: data.id,
              title: data.title,
              start: data.start_time,
              end: data.end_time,
              location: data.location,
              description: data.description,
              source: "local",
              color: data.color,
            },
          ].sort((a, b) => a.start.localeCompare(b.start)),
        );
      }
    } finally {
      setForm(emptyForm());
      setShowForm(false);
      setSaving(false);
    }
  };

  const remove = async (ev: UnifiedEvent) => {
    if (ev.source === "local") {
      await supabase.from("events").delete().eq("id", ev.id);
    } else {
      // 구글 이벤트 삭제
      const realId = ev.id.replace("g_", "");
      await gcal.deleteEvent(realId);
    }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    setSelected(null);
  };

  // 달력 그리드
  const daysInMonth = current.daysInMonth();
  const firstDay = current.startOf("month").day();
  const today = dayjs();

  const getEventsForDay = (day: number) => {
    const date = current.date(day).format("YYYY-MM-DD");
    return events.filter((e) => (e.start || "").slice(0, 10) === date);
  };

  const getEventDot = (ev: UnifiedEvent) => {
    if (ev.source === "google") {
      return { backgroundColor: ev.color || "#4f46e5" };
    }
    return {};
  };

  const getEventBg = (ev: UnifiedEvent) => {
    if (ev.source === "google")
      return { backgroundColor: ev.color || "#4f46e5" };
    return {};
  };

  const localColorClass = (color?: string) =>
    colorClass[color || "indigo"] || "bg-indigo-400";

  const upcomingEvents = events
    .filter((e) => dayjs(e.start).isAfter(today.subtract(1, "day")))
    .slice(0, 15);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📅 캘린더</h2>
          {googleConnected && (
            <span className="text-xs text-emerald-600 font-medium">
              ● 구글 캘린더 연결됨
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!googleConnected ? (
            <button
              onClick={connectGoogle}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <img
                src="https://www.google.com/favicon.ico"
                className="w-4 h-4"
                alt=""
              />
              구글 연결
            </button>
          ) : (
            <button
              onClick={() => {
                gcal.disconnect();
                setGoogleConnected(false);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-400"
            >
              연결 해제
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            + 일정 추가
          </button>
        </div>
      </div>

      {/* 구글 에러 배너 */}
      {googleError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm">
          {googleError === "TOKEN_EXPIRED" ? (
            <div>
              <span className="font-semibold text-amber-700">
                ⚠️ 로그인 만료
              </span>
              <p className="text-amber-600 mt-1">
                연결 해제 후 다시 구글 연결을 해주세요.
              </p>
            </div>
          ) : googleError === "GAPI_NOT_READY" ? (
            <p className="text-amber-600">
              Google API 초기화 중... 잠시 후 새로고침해주세요.
            </p>
          ) : (
            <div>
              <span className="font-semibold text-amber-700">
                ⚠️ 구글 캘린더 오류
              </span>
              <p className="text-amber-600 mt-1 font-mono text-xs break-all">
                {googleError}
              </p>
              <p className="text-amber-600 mt-2 text-xs">
                연결 해제 후 다시 연결해보세요.
              </p>
              <button
                onClick={() => {
                  gcal.disconnect();
                  setGoogleConnected(false);
                  setGoogleError(null);
                }}
                className="mt-2 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700"
              >
                연결 해제 후 재연결
              </button>
            </div>
          )}
        </div>
      )}

      {/* 일정 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 space-y-3">
          <input
            autoFocus
            placeholder="일정 제목 *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">시작</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">
                종료 (선택)
              </label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <input
            placeholder="장소 (선택)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <textarea
            placeholder="메모 (선택)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          {googleConnected && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.saveToGoogle}
                onChange={(e) =>
                  setForm({ ...form, saveToGoogle: e.target.checked })
                }
                className="rounded"
              />
              구글 캘린더에도 저장
            </label>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm());
              }}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 달력 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={() => setCurrent(current.subtract(1, "month"))}
            className="text-slate-400 hover:text-slate-700 text-lg px-2"
          >
            ‹
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {current.format("YYYY년 M월")}
            </span>
            {loadingGoogle && (
              <span className="text-xs text-slate-400 animate-pulse">
                구글 동기화 중...
              </span>
            )}
          </div>
          <button
            onClick={() => setCurrent(current.add(1, "month"))}
            className="text-slate-400 hover:text-slate-700 text-lg px-2"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="text-xs font-medium text-slate-400 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} className="h-16 border-t border-slate-50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvs = getEventsForDay(day);
            const isToday =
              today.date() === day &&
              today.month() === current.month() &&
              today.year() === current.year();
            return (
              <div
                key={day}
                className="h-16 border-t border-slate-50 p-1 overflow-hidden"
              >
                <div
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${isToday ? "bg-indigo-600 text-white" : "text-slate-600"}`}
                >
                  {day}
                </div>
                {dayEvs.slice(0, 2).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate text-white mb-0.5 ${ev.source === "local" ? localColorClass(ev.color) : ""}`}
                    style={
                      ev.source === "google"
                        ? { backgroundColor: ev.color || "#4f46e5" }
                        : {}
                    }
                  >
                    {ev.source === "google" && (
                      <span className="mr-0.5">G</span>
                    )}
                    {ev.title}
                  </button>
                ))}
                {dayEvs.length > 2 && (
                  <div className="text-[10px] text-slate-400">
                    +{dayEvs.length - 2}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-indigo-400 inline-block" />앱 일정
        </span>
        {googleConnected && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
            구글 캘린더
          </span>
        )}
      </div>

      {/* 이벤트 상세 모달 */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {selected.source === "google" && (
                  <img
                    src="https://www.google.com/favicon.ico"
                    className="w-4 h-4"
                    alt="Google"
                  />
                )}
                <h3 className="font-semibold text-slate-800">
                  {selected.title}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 text-xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div>
                🕐 {dayjs(selected.start).format("YYYY년 M월 D일 HH:mm")}
              </div>
              {selected.end && (
                <div>⏱ ~ {dayjs(selected.end).format("HH:mm")}</div>
              )}
              {selected.location && <div>📍 {selected.location}</div>}
              {selected.description && (
                <div className="text-slate-500 bg-slate-50 rounded-lg p-2 text-xs">
                  {selected.description}
                </div>
              )}
              <div className="text-xs text-slate-400">
                {selected.source === "google"
                  ? "📱 구글 캘린더"
                  : "💾 앱 내 일정"}
              </div>
            </div>
            <button
              onClick={() => remove(selected)}
              className="mt-4 w-full text-sm py-2 rounded-lg text-red-500 border border-red-200 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 예정 일정 리스트 */}
      <section>
        <h3 className="font-semibold text-slate-700 mb-3">예정된 일정</h3>
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8">
            <MiJin variant="nod" size={52} className="mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              이번 달 예정된 일정이 없어요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelected(ev)}
                className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <div
                  className={`w-2 h-10 rounded-full shrink-0 ${ev.source === "local" ? localColorClass(ev.color) : ""}`}
                  style={ev.source === "google" ? getEventDot(ev) : {}}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate flex items-center gap-1">
                    {ev.source === "google" && (
                      <img
                        src="https://www.google.com/favicon.ico"
                        className="w-3 h-3"
                        alt=""
                      />
                    )}
                    {ev.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {dayjs(ev.start).format("M월 D일 (ddd) HH:mm")}
                    {ev.location && ` · ${ev.location}`}
                  </div>
                </div>
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={getEventBg(ev)}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
