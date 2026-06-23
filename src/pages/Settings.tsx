import { useEffect, useState } from "react";

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
  fontFamily: "inherit",
};

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedGoogle, setSavedGoogle] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem("anthropic_api_key") || "");
    setGoogleClientId(localStorage.getItem("google_client_id") || "");
  }, []);

  const save = () => {
    localStorage.setItem("anthropic_api_key", apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveGoogle = () => {
    localStorage.setItem("google_client_id", googleClientId.trim());
    setSavedGoogle(true);
    setTimeout(() => setSavedGoogle(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-6 space-y-8">
      <h2
        style={{
          fontSize: 34,
          fontWeight: 600,
          color: "#1d1d1f",
          letterSpacing: "-0.374px",
        }}
      >
        설정
      </h2>

      {/* Claude API 키 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: 18,
          padding: 24,
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "#1d1d1f",
            letterSpacing: "-0.374px",
            marginBottom: 4,
          }}
        >
          Claude API 키
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "#7a7a7a",
            letterSpacing: "-0.224px",
            marginBottom: 16,
          }}
        >
          AI 비서 · 업무 분석 기능에 필요해요.
        </p>
        <div style={{ position: "relative" }}>
          <input
            type={showKey ? "text" : "password"}
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ ...inputStyle, paddingRight: 60, fontFamily: "monospace" }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13,
              color: "#7a7a7a",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {showKey ? "숨기기" : "보기"}
          </button>
        </div>
        <button
          onClick={save}
          className="w-full mt-3 transition-all active:scale-95"
          style={{
            background: saved ? "#34c759" : "#0066cc",
            color: "#fff",
            borderRadius: 9999,
            padding: "11px 22px",
            fontSize: 17,
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.374px",
          }}
        >
          {saved ? "✓ 저장됨" : "저장"}
        </button>
        <div
          style={{
            background: "#f5f5f7",
            borderRadius: 11,
            padding: 12,
            marginTop: 12,
            fontSize: 13,
            color: "#7a7a7a",
          }}
        >
          console.anthropic.com → API Keys → 새 키 생성
        </div>
      </section>

      {/* 구글 캘린더 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: 18,
          padding: 24,
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "#1d1d1f",
            letterSpacing: "-0.374px",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <img
            src="https://www.google.com/favicon.ico"
            style={{ width: 16, height: 16 }}
            alt=""
          />
          구글 캘린더 연동
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "#7a7a7a",
            letterSpacing: "-0.224px",
            marginBottom: 16,
          }}
        >
          Google Cloud Console에서 발급한 OAuth 클라이언트 ID를 입력하세요.
        </p>
        <input
          type="text"
          placeholder="123456789.apps.googleusercontent.com"
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
        <button
          onClick={saveGoogle}
          className="w-full mt-3 transition-all active:scale-95"
          style={{
            background: savedGoogle ? "#34c759" : "#1d1d1f",
            color: "#fff",
            borderRadius: 9999,
            padding: "11px 22px",
            fontSize: 17,
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.374px",
          }}
        >
          {savedGoogle ? "✓ 저장됨" : "저장"}
        </button>

        {/* 가이드 */}
        <div
          style={{
            background: "#f5f5f7",
            borderRadius: 11,
            padding: 14,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1d1d1f",
              marginBottom: 8,
            }}
          >
            연동 방법
          </div>
          <ol
            style={{
              fontSize: 13,
              color: "#7a7a7a",
              paddingLeft: 16,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            <li>console.cloud.google.com 접속 → 새 프로젝트 생성</li>
            <li>API 및 서비스 → Google Calendar API 활성화</li>
            <li>
              사용자 인증 정보 → OAuth 클라이언트 ID 생성 (웹 애플리케이션)
            </li>
            <li>
              승인된 JavaScript 원본에{" "}
              <code
                style={{
                  background: "#fff",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                http://localhost:5173
              </code>{" "}
              추가
            </li>
            <li>생성된 클라이언트 ID를 위에 붙여넣기</li>
          </ol>
        </div>
      </section>

      {/* 앱 정보 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: 18,
          padding: 24,
        }}
      >
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "#1d1d1f",
            letterSpacing: "-0.374px",
            marginBottom: 16,
          }}
        >
          앱 정보
        </h3>
        {[
          { label: "버전", value: "1.2.0" },
          { label: "데이터 저장소", value: "Supabase" },
          { label: "AI 모델", value: "Claude Sonnet 4.6" },
          {
            label: "캘린더 연동",
            value: localStorage.getItem("google_client_id")
              ? "설정됨"
              : "미설정",
            color: localStorage.getItem("google_client_id")
              ? "#34c759"
              : "#7a7a7a",
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-center"
            style={{
              borderTop: "1px solid #f0f0f0",
              padding: "12px 0",
              fontSize: 15,
              letterSpacing: "-0.224px",
            }}
          >
            <span style={{ color: "#7a7a7a" }}>{row.label}</span>
            <span style={{ color: row.color || "#1d1d1f", fontWeight: 500 }}>
              {row.value}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
