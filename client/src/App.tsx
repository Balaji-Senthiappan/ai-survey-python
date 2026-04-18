import { NavLink, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import ResultsPage from "./pages/ResultsPage";
import SurveyPage from "./pages/SurveyPage";

export default function App() {
  return (
    <div className="layout">
      <nav className="top">
        <NavLink to="/">Survey</NavLink>
        <NavLink to="/admin">Admin</NavLink>
        <NavLink to="/results">Results</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SurveyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </div>
  );
}
