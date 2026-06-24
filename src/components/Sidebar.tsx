import type { Page } from "../lib/types";

interface Props {
  current: Page;
  onChange: (p: Page) => void;
}

const nav: { id: Page; label: string; icon: string; badge?: string }[] = [
  { id: "dashboard", label: "대시보드", icon: "🏠" },
  { id: "news", label: "뉴스", icon: "📰" },
  { id: "content", label: "콘텐츠", icon: "🎬", badge: "NEW" },
  { id: "projects", label: "내 업무", icon: "🗂️" },
  { id: "calendar", label: "캘린더", icon: "📅" },
  { id: "todos", label: "할일", icon: "✅" },
  { id: "memos", label: "메모", icon: "📝" },
  { id: "ai", label: "AI 비서", icon: "🤖" },
];

const mobileNav: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "홈", icon: "🏠" },
  { id: "news", label: "뉴스", icon: "📰" },
  { id: "calendar", label: "캘린더", icon: "📅" },
  { id: "projects", label: "업무", icon: "🗂️" },
  { id: "ai", label: "AI", icon: "🤖" },
];

export default function Sidebar({ current, onChange }: Props) {
  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside
        className="hidden md:flex flex-col w-56 min-h-screen shrink-0"
        style={{ background: "#000000" }}
      >
        {/* 로고 */}
        <div
          className="px-5 py-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h1
            className="text-base font-semibold text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            나의 비서
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#7a7a7a" }}>
            AI Personal Assistant
          </p>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background:
                  current === item.id ? "rgba(255,255,255,0.1)" : "transparent",
                color: current === item.id ? "#ffffff" : "#7a7a7a",
                fontWeight: current === item.id ? 500 : 400,
                letterSpacing: "-0.01em",
              }}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: "#0066cc", color: "#fff" }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 설정 */}
        <div
          className="px-3 pb-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => onChange("settings")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mt-3"
            style={{
              background:
                current === "settings"
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
              color: current === "settings" ? "#ffffff" : "#7a7a7a",
              letterSpacing: "-0.01em",
            }}
          >
            <span className="text-base">⚙️</span>
            <span>설정</span>
          </button>
        </div>
      </aside>

      {/* 모바일 하단 탭바 */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-50"
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid #e0e0e0",
        }}
      >
        {mobileNav.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors"
            style={{ color: current === item.id ? "#0066cc" : "#7a7a7a" }}
          >
            <span className="text-xl mb-0.5">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
