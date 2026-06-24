import { useEffect, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase";
import type { NewsItem } from "../lib/types";
import dayjs from "dayjs";

function stripHtml(str: string) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function naverSearch(query: string): Promise<any[]> {
  const res = await fetch(
    `/api/naver-news?query=${encodeURIComponent(query)}&display=20`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

function timeAgo(pubDate: string) {
  if (!pubDate) return "";
  const d = dayjs(pubDate);
  const diffH = dayjs().diff(d, "hour");
  if (diffH < 1) return "방금 전";
  if (diffH < 24) return `${diffH}시간 전`;
  return d.format("M월 D일");
}

function ArticleList({
  items,
  emptyMsg,
}: {
  items: NewsItem[];
  emptyMsg: string;
}) {
  if (items.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "#7a7a7a", padding: "20px 0" }}>
        {emptyMsg}
      </p>
    );
  }
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-1 px-5 py-4 no-underline transition-colors"
          style={{
            borderTop: i > 0 ? "1px solid #f0f0f0" : "none",
            display: "flex",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontSize: 15,
              color: "#1d1d1f",
              letterSpacing: "-0.374px",
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            {item.title}
          </span>
          {item.description && (
            <span
              style={{
                fontSize: 13,
                color: "#7a7a7a",
                letterSpacing: "-0.2px",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.description}
            </span>
          )}
          <span style={{ fontSize: 12, color: "#aeaeb2", marginTop: 2 }}>
            {timeAgo(item.published_at)}
          </span>
        </a>
      ))}
    </div>
  );
}

export default function News() {
  const [realestate, setRealestate] = useState<NewsItem[]>([]);
  const [menopause, setMenopause] = useState<NewsItem[]>([]);
  const [stocks, setStocks] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchStep, setFetchStep] = useState("");
  const [error, setError] = useState("");
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    loadTodayNews();
  }, []);

  async function loadTodayNews() {
    setLoading(true);
    const { data } = await supabase
      .from("news_items")
      .select("*")
      .eq("fetched_date", today)
      .order("created_at", { ascending: true });

    const items = (data || []) as NewsItem[];
    const re = items.filter((n) => n.category === "realestate");
    const mp = items.filter((n) => n.category === "menopause");
    const st = items.filter((n) => n.category === "stocks");

    setRealestate(re);
    setMenopause(mp);
    setStocks(st);
    setLoading(false);

    if (re.length === 0 || mp.length === 0 || st.length === 0) {
      fetchNews();
    }
  }

  async function fetchNews() {
    const apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      setError("Claude API 키가 필요해요. 설정에서 먼저 입력해주세요.");
      return;
    }

    setFetching(true);
    setError("");

    try {
      // 최근 30일 본 URL 가져오기 (중복 방지)
      setFetchStep("중복 확인 중...");
      const since = dayjs().subtract(30, "day").toISOString();
      const { data: seen } = await supabase
        .from("news_items")
        .select("url")
        .gte("created_at", since);
      const seenUrls = new Set((seen || []).map((r: any) => r.url));

      // 네이버 뉴스 검색
      setFetchStep("뉴스 검색 중...");
      const [re1, re2, mp1, mp2, mp3, st1, st2] = await Promise.all([
        naverSearch("부동산 동향 정책"),
        naverSearch("부동산 규제 시장 전망"),
        naverSearch("갱년기 연구 의학 최신"),
        naverSearch("폐경 호르몬 치료 임상 결과"),
        naverSearch("갱년기 롱제비티 노화 여성 건강"),
        naverSearch("주식 증시 시장 동향 오늘"),
        naverSearch("미국 주식 나스닥 코스피 투자"),
      ]);

      const dedup = (arr: any[]) => {
        const seen2 = new Set<string>();
        return arr.filter((a) => {
          const url = a.originallink || a.link;
          if (seenUrls.has(url) || seen2.has(url)) return false;
          seen2.add(url);
          return true;
        });
      };

      const reRaw = dedup([...re1, ...re2]);
      const mpRaw = dedup([...mp1, ...mp2, ...mp3]);
      const stRaw = dedup([...st1, ...st2]);

      // Claude가 상위 5개 선택
      setFetchStep("AI가 중요 뉴스 선별 중...");
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      const selectTop5 = async (
        articles: any[],
        category: "realestate" | "menopause" | "stocks",
      ): Promise<any[]> => {
        if (articles.length === 0) return [];
        if (articles.length <= 5) return articles;

        const list = articles
          .slice(0, 25)
          .map((a, i) => `${i + 1}. ${stripHtml(a.title)} (${a.pubDate})`)
          .join("\n");

        const prompt =
          category === "realestate"
            ? `부동산 전문 큐레이터입니다. 아래 기사 중 부동산 정책·법 변경, 시장 동향, 지역별 가격 변화 등 실질적으로 중요한 뉴스 5개 번호를 JSON 배열로만 응답: [1,3,5,8,12]`
            : category === "stocks"
              ? `주식 투자 전문 큐레이터입니다. 아래 기사 중 시장 동향, 주요 종목 분석, 경제 지표, 투자 인사이트가 담긴 뉴스 5개 번호를 JSON 배열로만 응답: [1,3,5,8,12]`
              : `여성 건강 전문 큐레이터입니다. 아래 기사 중 갱년기·폐경 의학 연구, 호르몬 치료 임상 결과, 롱제비티·노화 방지, 전문가 의견이 담긴 뉴스 5개 번호를 JSON 배열로만 응답: [1,3,5,8,12]\n일반 건강 상식·연예인 기사는 제외하고 의학적 근거가 있는 전문 콘텐츠를 우선 선택하세요.`;

        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{ role: "user", content: `${prompt}\n\n${list}` }],
        });

        const text = msg.content[0].type === "text" ? msg.content[0].text : "";
        const match = text.match(/\[[\d,\s]+\]/);
        if (!match) return articles.slice(0, 5);

        const indices: number[] = JSON.parse(match[0]);
        return indices
          .slice(0, 5)
          .map((i) => articles[i - 1])
          .filter(Boolean);
      };

      const [selectedRE, selectedMP, selectedST] = await Promise.all([
        selectTop5(reRaw, "realestate"),
        selectTop5(mpRaw, "menopause"),
        selectTop5(stRaw, "stocks"),
      ]);

      // Supabase에 저장
      setFetchStep("저장 중...");
      const toRow = (a: any, category: string) => ({
        category,
        title: stripHtml(a.title),
        description: stripHtml(a.description || ""),
        url: a.originallink || a.link,
        naver_url: a.link,
        published_at: a.pubDate || "",
        fetched_date: today,
      });

      const rows = [
        ...selectedRE.map((a: any) => toRow(a, "realestate")),
        ...selectedMP.map((a: any) => toRow(a, "menopause")),
        ...selectedST.map((a: any) => toRow(a, "stocks")),
      ];

      if (rows.length > 0) {
        const { data: inserted } = await supabase
          .from("news_items")
          .insert(rows)
          .select();
        const saved = (inserted || []) as NewsItem[];
        setRealestate(saved.filter((n) => n.category === "realestate"));
        setMenopause(saved.filter((n) => n.category === "menopause"));
        setStocks(saved.filter((n) => n.category === "stocks"));
      }
    } catch (err: any) {
      setError(`뉴스를 가져오지 못했어요: ${err.message}`);
    } finally {
      setFetching(false);
      setFetchStep("");
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#1d1d1f",
              letterSpacing: "-0.02em",
            }}
          >
            오늘의 뉴스
          </h2>
          <p style={{ fontSize: 14, color: "#7a7a7a", marginTop: 4 }}>
            {dayjs().format("M월 D일 dddd")}
          </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={fetching || loading}
          className="flex items-center gap-1.5 transition-all active:scale-95"
          style={{
            fontSize: 14,
            padding: "8px 16px",
            borderRadius: 9999,
            border: "1px solid #e0e0e0",
            background: fetching ? "#f5f5f7" : "#fff",
            color: fetching ? "#aeaeb2" : "#0066cc",
            cursor: fetching ? "default" : "pointer",
          }}
        >
          {fetching ? fetchStep || "가져오는 중..." : "↺ 새로 가져오기"}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontSize: 14,
            color: "#7a7a7a",
            background: "#fff8ed",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "12px 16px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            fontSize: 14,
            color: "#7a7a7a",
            textAlign: "center",
            padding: "48px 0",
          }}
        >
          불러오는 중...
        </div>
      ) : (
        <>
          {/* 갱년기·건강 */}
          <section>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              🌿 갱년기 · 건강 전문
            </h3>
            <ArticleList
              items={menopause}
              emptyMsg={
                fetching
                  ? "뉴스를 가져오고 있어요..."
                  : "오늘의 뉴스를 가져오려면 위 버튼을 눌러주세요."
              }
            />
          </section>

          {/* 주식·투자 */}
          <section>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              📊 주식 · 투자
            </h3>
            <ArticleList
              items={stocks}
              emptyMsg={
                fetching
                  ? "뉴스를 가져오고 있어요..."
                  : "오늘의 뉴스를 가져오려면 위 버튼을 눌러주세요."
              }
            />
          </section>

          {/* 부동산 */}
          <section>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1d1d1f",
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              🏠 부동산
            </h3>
            <ArticleList
              items={realestate}
              emptyMsg={
                fetching
                  ? "뉴스를 가져오고 있어요..."
                  : "오늘의 뉴스를 가져오려면 위 버튼을 눌러주세요."
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
