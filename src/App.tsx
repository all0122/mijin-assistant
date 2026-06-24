import { useState } from "react";
import "./index.css";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Content from "./pages/Content";
import Calendar from "./pages/Calendar";
import Todos from "./pages/Todos";
import Memos from "./pages/Memos";
import Contacts from "./pages/Contacts";
import AiChat from "./pages/AiChat";
import Settings from "./pages/Settings";
import News from "./pages/News";
import type { Page } from "./lib/types";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard onNavigate={(p) => setPage(p as Page)} />;
      case "projects":
        return <Projects />;
      case "content":
        return <Content />;
      case "calendar":
        return <Calendar />;
      case "todos":
        return <Todos />;
      case "memos":
        return <Memos />;
      case "contacts":
        return <Contacts />;
      case "ai":
        return <AiChat onNavigate={(p) => setPage(p as Page)} />;
      case "news":
        return <News />;
      case "settings":
        return <Settings />;
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#f5f5f7" }}>
      <Sidebar current={page} onChange={setPage} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {renderPage()}
      </main>
    </div>
  );
}
