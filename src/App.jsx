import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import UnityPage from "./pages/UnityPage";
import ResultPage from "./pages/ResultsPage";

export default function App() {
  return (
    <Router>
      {/* Use a real DOM container for sizing; BrowserRouter doesn't render a DOM node that accepts style props */}
      <div className="app-root">
        <nav>
          <Link to="/">Play</Link> | <Link to="/result">Result</Link>
        </nav>
        <Routes>
          <Route path="/" element={<UnityPage />} />
          <Route path="/result" element={<ResultPage />} />
        </Routes>
      </div>
    </Router>
  );
}
