import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import ResultsPage from "./pages/ResultsPage";
import SurveyPage from "./pages/SurveyPage";

const figmaReferenceUrl = import.meta.env.VITE_FIGMA_REFERENCE_URL?.trim();

export default function App() {
  const { pathname } = useLocation();
  const surveyMode = pathname === "/";

  return (
    <div className="shell">
      {surveyMode ? (
        <header className="app-toolbar-assessment" aria-label="Application">
          <NavLink className="app-toolbar-assessment__link" to="/admin">
            Admin
          </NavLink>
          <span className="app-toolbar-assessment__sep" aria-hidden>
            ·
          </span>
          <NavLink className="app-toolbar-assessment__link" to="/results">
            Results
          </NavLink>
          {figmaReferenceUrl ? (
            <>
              <span className="app-toolbar-assessment__sep" aria-hidden>
                ·
              </span>
              <a
                className="app-toolbar-assessment__link"
                href={figmaReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Figma
              </a>
            </>
          ) : null}
        </header>
      ) : (
        <header className="app-header">
          <div className="app-header-inner">
            <span className="app-mark">SDLC AI</span>
            <nav className="top" aria-label="Primary">
              <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} end to="/">
                Survey
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} to="/admin">
                Admin
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} to="/results">
                Results
              </NavLink>
            </nav>
            {figmaReferenceUrl ? (
              <a
                className="figma-ref"
                href={figmaReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Figma design reference"
              >
                Figma reference
              </a>
            ) : null}
          </div>
        </header>
      )}
      <main className={surveyMode ? "main-assessment" : "layout"}>
        <Routes>
          <Route path="/" element={<SurveyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  );
}
