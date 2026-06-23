import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Contact, ContactInteraction } from "../lib/types";
import dayjs from "dayjs";

const emptyContact = (): Omit<Contact, "id" | "created_at"> => ({
  name: "",
  phone: "",
  email: "",
  company: "",
  notes: "",
});

const INTERACTION_TYPES = ["전화", "미팅", "메시지", "이메일", "기타"];

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyContact());
  const [interactionForm, setInteractionForm] = useState({
    type: "전화",
    note: "",
    date: dayjs().format("YYYY-MM-DD"),
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("contacts").select("*").order("name");
    setContacts(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const loadInteractions = async (contactId: string) => {
    const { data } = await supabase
      .from("contact_interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("date", { ascending: false });
    setInteractions(data || []);
  };

  const selectContact = (c: Contact) => {
    setSelected(c);
    loadInteractions(c.id);
  };

  const saveContact = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("contacts")
      .insert({
        ...form,
        phone: form.phone || null,
        email: form.email || null,
        company: form.company || null,
        notes: form.notes || null,
      })
      .select()
      .single();
    if (data)
      setContacts((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
    setForm(emptyContact());
    setShowForm(false);
    setSaving(false);
  };

  const removeContact = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
  };

  const addInteraction = async () => {
    if (!selected || !interactionForm.note.trim()) return;
    const { data } = await supabase
      .from("contact_interactions")
      .insert({ contact_id: selected.id, ...interactionForm })
      .select()
      .single();
    if (data) setInteractions((prev) => [data, ...prev]);
    setInteractionForm({
      type: "전화",
      note: "",
      date: dayjs().format("YYYY-MM-DD"),
    });
  };

  const removeInteraction = async (id: string) => {
    await supabase.from("contact_interactions").delete().eq("id", id);
    setInteractions((prev) => prev.filter((i) => i.id !== id));
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  });

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const avatarColors = [
    "bg-indigo-400",
    "bg-violet-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-rose-400",
    "bg-cyan-400",
  ];
  const getColor = (name: string) =>
    avatarColors[name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">👥 연락처</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + 추가
        </button>
      </div>

      <input
        placeholder="🔍 이름, 회사, 전화번호 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {/* 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-md p-5 mb-5 space-y-3">
          <input
            autoFocus
            placeholder="이름 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2">
            <input
              placeholder="전화번호"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              placeholder="이메일"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <input
            placeholder="회사/소속"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <textarea
            placeholder="메모"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyContact());
              }}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              onClick={saveContact}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* 연락처 목록 */}
        <div className="flex-1 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-16">
              {search ? "검색 결과가 없어요" : "연락처가 없어요"}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => selectContact(c)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  selected?.id === c.id
                    ? "bg-indigo-50 border border-indigo-200"
                    : "bg-white shadow-sm hover:shadow-md"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full ${getColor(c.name)} flex items-center justify-center text-white font-semibold text-sm shrink-0`}
                >
                  {getInitial(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {[c.company, c.phone].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* 상세/히스토리 패널 */}
        {selected && (
          <div className="w-72 shrink-0 bg-white rounded-2xl shadow-sm p-4 space-y-4 h-fit">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-10 h-10 rounded-full ${getColor(selected.name)} flex items-center justify-center text-white font-bold`}
                  >
                    {getInitial(selected.name)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">
                      {selected.name}
                    </div>
                    {selected.company && (
                      <div className="text-xs text-slate-400">
                        {selected.company}
                      </div>
                    )}
                  </div>
                </div>
                {selected.phone && (
                  <div className="text-xs text-slate-500 mt-1">
                    📞 {selected.phone}
                  </div>
                )}
                {selected.email && (
                  <div className="text-xs text-slate-500">
                    ✉️ {selected.email}
                  </div>
                )}
                {selected.notes && (
                  <div className="text-xs text-slate-400 mt-2 bg-slate-50 rounded-lg p-2">
                    {selected.notes}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-300 hover:text-slate-500 text-xl"
              >
                ×
              </button>
            </div>

            {/* 상호작용 추가 */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                히스토리 추가
              </div>
              <select
                value={interactionForm.type}
                onChange={(e) =>
                  setInteractionForm({
                    ...interactionForm,
                    type: e.target.value,
                  })
                }
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="date"
                value={interactionForm.date}
                onChange={(e) =>
                  setInteractionForm({
                    ...interactionForm,
                    date: e.target.value,
                  })
                }
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <textarea
                placeholder="내용"
                value={interactionForm.note}
                onChange={(e) =>
                  setInteractionForm({
                    ...interactionForm,
                    note: e.target.value,
                  })
                }
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <button
                onClick={addInteraction}
                className="w-full text-xs py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                추가
              </button>
            </div>

            {/* 히스토리 목록 */}
            <div className="border-t border-slate-100 pt-3 space-y-2 max-h-64 overflow-y-auto">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                히스토리
              </div>
              {interactions.length === 0 ? (
                <div className="text-xs text-slate-300 py-2 text-center">
                  기록이 없어요
                </div>
              ) : (
                interactions.map((i) => (
                  <div key={i.id} className="flex gap-2 group">
                    <div className="flex-1 bg-slate-50 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-medium text-slate-600">
                          {i.type}
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {dayjs(i.date).format("M/D")}
                        </span>
                      </div>
                      {i.note && (
                        <div className="text-xs text-slate-500">{i.note}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeInteraction(i.id)}
                      className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => removeContact(selected.id)}
              className="w-full text-xs py-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
            >
              연락처 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
