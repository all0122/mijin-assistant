import { useEffect, useState, useCallback } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";
import type { ContentItem } from "../lib/types";
import dayjs from "dayjs";

type Account = "menopause" | "vibe";
type Stage = ContentItem["stage"];
type MaterialType = "link" | "text" | "quote" | "ai_summary";

interface ContentMaterial {
  id: string;
  content_item_id: string;
  type: MaterialType;
  content: string;
  source_url?: string;
  created_at: string;
}

const ACCOUNTS: { id: Account; label: string; emoji: string; color: string }[] =
  [
    { id: "menopause", label: "갱년기 인스타", emoji: "🌸", color: "rose" },
    { id: "vibe", label: "바이브코딩", emoji: "💻", color: "indigo" },
  ];

const STAGES: { id: Stage; label: string; emoji: string }[] = [
  { id: "idea", label: "아이디어", emoji: "💡" },
  { id: "research", label: "소재수집", emoji: "🔍" },
  { id: "filming", label: "촬영예정", emoji: "🎥" },
  { id: "editing", label: "편집중", emoji: "✂️" },
  { id: "uploaded", label: "업로드완료", emoji: "✅" },
];

const stageColors: Record<Stage, string> = {
  idea: "bg-yellow-50 border-yellow-200",
  research: "bg-blue-50 border-blue-200",
  filming: "bg-purple-50 border-purple-200",
  editing: "bg-orange-50 border-orange-200",
  uploaded: "bg-emerald-50 border-emerald-200",
};

const stageDotColors: Record<Stage, string> = {
  idea: "bg-yellow-400",
  research: "bg-blue-400",
  filming: "bg-purple-400",
  editing: "bg-orange-400",
  uploaded: "bg-emerald-400",
};

const matTypeLabel: Record<MaterialType, string> = {
  link: "🔗 링크",
  text: "📝 텍스트",
  quote: "💬 인용",
  ai_summary: "🤖 AI 정리",
};

const emptyForm = () => ({
  title: "",
  notes: "",
  due_date: "",
  links: "",
  stage: "idea" as Stage,
});

export default function Content() {
  const [account, setAccount] = useState<Account>("menopause");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // 소재 관련 state
  const [materials, setMaterials] = useState<ContentMaterial[]>([]);
  const [matLoading, setMatLoading] = useState(false);
  const [matType, setMatType] = useState<MaterialType>("text");
  const [matContent, setMatContent] = useState("");
  const [matUrl, setMatUrl] = useState("");
  const [matSaving, setMatSaving] = useState(false);

  // AI 자동 정리
  const [rawText, setRawText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_items")
      .select("*")
      .eq("account", account)
      .order("created_at", { ascending: false });
    setItems((data as ContentItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [account]);

  const loadMaterials = useCallback(async (itemId: string) => {
    setMatLoading(true);
    const { data } = await supabase
      .from("content_materials")
      .select("*")
      .eq("content_item_id", itemId)
      .order("created_at", { ascending: true });
    setMaterials((data as ContentMaterial[]) || []);
    setMatLoading(false);
  }, []);

  const openDetail = (item: ContentItem) => {
    setSelected(item);
    setShowAiPanel(false);
    setMatContent("");
    setMatUrl("");
    setRawText("");
    loadMaterials(item.id);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const links = form.links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const { data } = await supabase
      .from("content_items")
      .insert({
        account,
        stage: form.stage,
        title: form.title.trim(),
        notes: form.notes || null,
        due_date: form.due_date || null,
        links,
      })
      .select()
      .single();
    if (data) setItems((prev) => [data as ContentItem, ...prev]);
    setForm(emptyForm());
    setShowForm(false);
    setSaving(false);
  };

  const moveStage = async (item: ContentItem, dir: 1 | -1) => {
    const idx = STAGES.findIndex((s) => s.id === item.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    setMovingId(item.id);
    await supabase
      .from("content_items")
      .update({ stage: next.id, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stage: next.id } : i)),
    );
    if (selected?.id === item.id) setSelected({ ...item, stage: next.id });
    setMovingId(null);
  };

  const remove = async (id: string) => {
    await supabase.from("content_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected(null);
  };

  const saveMaterial = async () => {
    if (!selected || !matContent.trim()) return;
    setMatSaving(true);
    const { data } = await supabase
      .from("content_materials")
      .insert({
        content_item_id: selected.id,
        type: matType,
        content: matContent.trim(),
        source_url: matUrl.trim() || null,
      })
      .select()
      .single();
    if (data) setMaterials((prev) => [...prev, data as ContentMaterial]);
    setMatContent("");
    setMatUrl("");
    setMatSaving(false);
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("content_materials").delete().eq("id", id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  // AI로 소재 자동 정리
  const aiOrganize = async () => {
    if (!selected || !rawText.trim()) return;
    const apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      alert("설정에서 Claude API 키를 먼저 입력해주세요.");
      return;
    }
    setAiLoading(true);
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const accountLabel =
        account === "menopause" ? "갱년기 인스타그램" : "바이브코딩 인스타그램";
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `당신은 인스타그램 콘텐츠 전문가입니다.
채널: ${accountLabel}
콘텐츠 주제: "${selected.title}"

아래 수집된 소재/텍스트를 분석하여 다음 형식으로 정리해주세요:

1. 핵심 포인트 3-5개 (불릿 형식)
2. 인스타그램 캡션에 쓸 수 있는 인용구 1-2개
3. 촬영 시 담아야 할 장면/내용 2-3가지

수집된 소재:
${rawText}

한국어로 답변해주세요.`,
          },
        ],
      });

      const aiText = msg.content[0].type === "text" ? msg.content[0].text : "";

      // AI 정리 결과를 소재로 저장
      const { data } = await supabase
        .from("content_materials")
        .insert({
          content_item_id: selected.id,
          type: "ai_summary",
          content: aiText,
          source_url: null,
        })
        .select()
        .single();
      if (data) setMaterials((prev) => [...prev, data as ContentMaterial]);
      setRawText("");
      setShowAiPanel(false);
    } catch (e) {
      console.error(e);
      alert("AI 정리 중 오류가 발생했어요.");
    }
    setAiLoading(false);
  };

  const byStage = (stage: Stage) => items.filter((i) => i.stage === stage);
  const uploadedCount = byStage("uploaded").length;
  const totalActive = items.filter((i) => i.stage !== "uploaded").length;
  const currentAccount = ACCOUNTS.find((a) => a.id === account)!;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            🎬 콘텐츠 파이프라인
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            아이디어 → 소재수집 → 촬영 → 편집 → 업로드
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          + 아이디어 추가
        </button>
      </div>

      {/* 계정 탭 */}
      <div className="flex gap-2 mb-6">
        {ACCOUNTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAccount(a.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              account === a.id
                ? a.color === "rose"
                  ? "bg-rose-500 text-white"
                  : "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>{a.emoji}</span>
            {a.label}
          </button>
        ))}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-slate-700">{totalActive}</div>
          <div className="text-xs text-slate-400 mt-0.5">진행중</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-purple-600">
            {byStage("filming").length + byStage("editing").length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">촬영·편집</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {uploadedCount}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">업로드 완료</div>
        </div>
      </div>

      {/* 아이디어 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-md p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span>{currentAccount.emoji}</span>
            {currentAccount.label} 콘텐츠 추가
          </div>
          <input
            autoFocus
            placeholder="콘텐츠 제목 / 아이디어 *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">단계</label>
              <select
                value={form.stage}
                onChange={(e) =>
                  setForm({ ...form, stage: e.target.value as Stage })
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">
                목표일 (선택)
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <textarea
            placeholder="메모 (선택)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
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
              disabled={saving || !form.title.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 파이프라인 보드 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {STAGES.map((stage) => {
            const stageItems = byStage(stage.id);
            return (
              <div
                key={stage.id}
                className={`rounded-2xl border p-4 ${stageColors[stage.id]}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${stageDotColors[stage.id]}`}
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    {stage.emoji} {stage.label}
                  </span>
                  <span className="text-xs text-slate-400 bg-white rounded-full px-2 py-0.5">
                    {stageItems.length}
                  </span>
                </div>
                {stageItems.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1 py-2">
                    {stage.id === "idea"
                      ? "+ 아이디어 추가 버튼으로 시작하세요"
                      : "없음"}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {stageItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openDetail(item)}
                        className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {item.title}
                        </div>
                        {item.notes && (
                          <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {item.notes}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          {item.due_date ? (
                            <span className="text-[10px] text-slate-400">
                              🗓 {dayjs(item.due_date).format("M/D")}
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex gap-1">
                            {stage.id !== "idea" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveStage(item, -1);
                                }}
                                disabled={movingId === item.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
                              >
                                ← 이전
                              </button>
                            )}
                            {stage.id !== "uploaded" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveStage(item, 1);
                                }}
                                disabled={movingId === item.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                              >
                                다음 →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 패널 (풀스크린 오버레이) */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-end z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white h-full w-full max-w-lg shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 패널 헤더 */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${stageDotColors[selected.stage]}`}
                  />
                  <span className="text-xs text-slate-400">
                    {STAGES.find((s) => s.id === selected.stage)?.emoji}{" "}
                    {STAGES.find((s) => s.id === selected.stage)?.label}
                  </span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">
                    {currentAccount.emoji} {currentAccount.label}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  {selected.title}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 text-2xl leading-none ml-3"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* 기본 정보 */}
              {(selected.notes || selected.due_date) && (
                <div className="space-y-2">
                  {selected.notes && (
                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 whitespace-pre-wrap">
                      {selected.notes}
                    </div>
                  )}
                  {selected.due_date && (
                    <div className="text-sm text-slate-500">
                      🗓 목표일:{" "}
                      {dayjs(selected.due_date).format("YYYY년 M월 D일")}
                    </div>
                  )}
                </div>
              )}

              {/* 단계 이동 */}
              <div className="flex gap-2">
                {selected.stage !== "idea" && (
                  <button
                    onClick={() => moveStage(selected, -1)}
                    className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    ← 이전 단계
                  </button>
                )}
                {selected.stage !== "uploaded" && (
                  <button
                    onClick={() => moveStage(selected, 1)}
                    className="flex-1 text-sm py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    다음 단계 →
                  </button>
                )}
              </div>

              {/* 소재 섹션 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700 text-sm">
                    🔍 수집된 소재
                  </h4>
                  <span className="text-xs text-slate-400">
                    {materials.length}개
                  </span>
                </div>

                {/* 소재 목록 */}
                {matLoading ? (
                  <p className="text-xs text-slate-400 py-2">불러오는 중...</p>
                ) : materials.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    아직 수집된 소재가 없어요. 아래에서 추가하세요.
                  </p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {materials.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl p-3 text-xs relative group ${
                          m.type === "ai_summary"
                            ? "bg-indigo-50 border border-indigo-100"
                            : m.type === "link"
                              ? "bg-blue-50 border border-blue-100"
                              : m.type === "quote"
                                ? "bg-amber-50 border border-amber-100"
                                : "bg-slate-50 border border-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-500">
                            {matTypeLabel[m.type]}
                          </span>
                          <button
                            onClick={() => deleteMaterial(m.id)}
                            className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap">
                          {m.content}
                        </div>
                        {m.source_url && (
                          <div className="text-indigo-500 mt-1 truncate">
                            {m.source_url}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 소재 추가 폼 */}
                <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                  <div className="flex gap-1 flex-wrap">
                    {(["text", "link", "quote"] as MaterialType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setMatType(t)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                          matType === t
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-slate-500 border border-slate-200"
                        }`}
                      >
                        {matTypeLabel[t]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder={
                      matType === "link"
                        ? "https://..."
                        : matType === "quote"
                          ? "인용할 문장을 입력하세요"
                          : "수집한 내용, 아이디어, 정보를 입력하세요"
                    }
                    value={matContent}
                    onChange={(e) => setMatContent(e.target.value)}
                    rows={3}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                  {matType !== "link" && (
                    <input
                      placeholder="출처 URL (선택)"
                      value={matUrl}
                      onChange={(e) => setMatUrl(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  )}
                  <button
                    onClick={saveMaterial}
                    disabled={matSaving || !matContent.trim()}
                    className="w-full text-xs py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {matSaving ? "저장 중..." : "소재 저장"}
                  </button>
                </div>

                {/* AI 자동 정리 */}
                <div className="mt-3">
                  <button
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    🤖 AI 소재 자동 정리
                    <span className="text-xs text-indigo-400">
                      (텍스트 붙여넣기 → 핵심 포인트 추출)
                    </span>
                  </button>

                  {showAiPanel && (
                    <div className="mt-2 bg-indigo-50 rounded-xl p-3 space-y-2 border border-indigo-100">
                      <p className="text-xs text-indigo-600">
                        수집한 기사, 유튜브 내용, 메모 등을 그대로 붙여넣으세요.
                        Claude가 핵심 포인트와 촬영 계획으로 정리해드려요.
                      </p>
                      <textarea
                        placeholder="여기에 수집한 내용을 모두 붙여넣기..."
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        rows={6}
                        className="w-full text-xs border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      />
                      <button
                        onClick={aiOrganize}
                        disabled={aiLoading || !rawText.trim()}
                        className="w-full text-sm py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {aiLoading ? (
                          <>
                            <span className="animate-spin">⏳</span> AI 정리
                            중...
                          </>
                        ) : (
                          "🤖 AI로 정리하기"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 삭제 */}
              <button
                onClick={() => remove(selected.id)}
                className="w-full text-sm py-2 rounded-lg text-red-400 border border-red-100 hover:bg-red-50"
              >
                콘텐츠 삭제
              </button>

              <div className="text-xs text-slate-300 text-center pb-4">
                {dayjs(selected.created_at).format("YYYY.M.D HH:mm")} 생성
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
