import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Memo } from "../lib/types";
import dayjs from "dayjs";
import MiJin from "../components/MiJin";

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

export default function Memos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Memo | null>(null);
  const [newMode, setNewMode] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("memos")
      .select("*")
      .order("updated_at", { ascending: false });
    setMemos(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = memos.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.content.toLowerCase().includes(q) ||
      (m.title || "").toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const parseTags = (s: string) =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const saveNew = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("memos")
      .insert({
        title: form.title || null,
        content: form.content,
        tags: parseTags(form.tags),
      })
      .select()
      .single();
    if (data) setMemos((prev) => [data, ...prev]);
    setForm({ title: "", content: "", tags: "" });
    setNewMode(false);
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const tags =
      typeof editing.tags === "string"
        ? parseTags(editing.tags as unknown as string)
        : editing.tags;
    const { data } = await supabase
      .from("memos")
      .update({ title: editing.title || null, content: editing.content, tags })
      .eq("id", editing.id)
      .select()
      .single();
    if (data)
      setMemos((prev) => prev.map((m) => (m.id === data.id ? data : m)));
    setEditing(null);
    setSaving(false);
  };

  const remove = async (id: string) => {
    await supabase.from("memos").delete().eq("id", id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
    setEditing(null);
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
          메모
        </h2>
        <button
          onClick={() => {
            setNewMode(true);
            setEditing(null);
          }}
          style={{
            background: "#0066cc",
            color: "#fff",
            borderRadius: 9999,
            padding: "8px 20px",
            fontSize: 15,
            border: "none",
            cursor: "pointer",
          }}
        >
          + 새 메모
        </button>
      </div>

      {/* 검색 */}
      <input
        placeholder="메모 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          ...inputStyle,
          marginBottom: 24,
          borderRadius: 9999,
          padding: "10px 20px",
        }}
      />

      {/* 새 메모 폼 */}
      {newMode && (
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
            placeholder="제목 (선택)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={inputStyle}
          />
          <textarea
            autoFocus
            placeholder="내용 *"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={5}
            style={{ ...inputStyle, resize: "none" }}
          />
          <input
            placeholder="태그 (쉼표로 구분: 업무, 아이디어)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            style={inputStyle}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setNewMode(false);
                setForm({ title: "", content: "", tags: "" });
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
              onClick={saveNew}
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

      {/* 편집 모달 */}
      {editing && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg space-y-3"
            style={{ background: "#fff", borderRadius: 18, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              placeholder="제목 (선택)"
              value={editing.title || ""}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
              style={inputStyle}
            />
            <textarea
              value={editing.content}
              onChange={(e) =>
                setEditing({ ...editing, content: e.target.value })
              }
              rows={8}
              style={{ ...inputStyle, resize: "none" }}
            />
            <input
              placeholder="태그 (쉼표로 구분)"
              value={
                Array.isArray(editing.tags)
                  ? editing.tags.join(", ")
                  : editing.tags
              }
              onChange={(e) =>
                setEditing({
                  ...editing,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              style={inputStyle}
            />
            <div className="flex gap-2 justify-between">
              <button
                onClick={() => remove(editing.id)}
                style={{
                  fontSize: 15,
                  padding: "8px 18px",
                  borderRadius: 9999,
                  border: "1px solid #ffccc7",
                  background: "#fff",
                  color: "#ff3b30",
                  cursor: "pointer",
                }}
              >
                삭제
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
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
                  onClick={saveEdit}
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
          </div>
        </div>
      )}

      {/* 메모 목록 */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#7a7a7a",
            padding: "64px 0",
            fontSize: 17,
          }}
        >
          <MiJin variant="nod" size={56} className="mx-auto mb-3" />
          {search ? "검색 결과가 없어요" : "메모가 없어요"}
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 gap-4 space-y-4">
          {filtered.map((memo) => (
            <button
              key={memo.id}
              onClick={() => {
                setEditing(memo);
                setNewMode(false);
              }}
              className="break-inside-avoid w-full text-left transition-all active:scale-95"
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 18,
                padding: 16,
                display: "block",
              }}
            >
              {memo.title && (
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1d1d1f",
                    letterSpacing: "-0.224px",
                    marginBottom: 4,
                  }}
                  className="truncate"
                >
                  {memo.title}
                </div>
              )}
              <div
                style={{
                  fontSize: 15,
                  color: "#333333",
                  letterSpacing: "-0.224px",
                  lineHeight: 1.47,
                }}
                className="line-clamp-4 whitespace-pre-wrap"
              >
                {memo.content}
              </div>
              {memo.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {memo.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        padding: "2px 10px",
                        borderRadius: 9999,
                        background: "#f5f5f7",
                        color: "#0066cc",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: "#cccccc",
                  marginTop: 8,
                  letterSpacing: "-0.12px",
                }}
              >
                {dayjs(memo.updated_at).format("M월 D일")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
