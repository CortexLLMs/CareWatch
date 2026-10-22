// src/App.jsx
// CareWatch — Built by CortexLLM
// Routes between onboarding (Landing) and the live dashboard.

import { useState } from "react";
import Landing from "./components/Landing.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { loadLocal, clearLocal } from "./lib/storage";
import "./lib/credits";
import "./App.css";

const EMPTY = { medNames: [], medTimes: [], contact: "" };

export default function App() {
  const saved = loadLocal();
  const [page, setPage] = useState(saved ? "dash" : "land");
  const [med, setMed] = useState(saved || EMPTY);

  const handleReset = () => {
    clearLocal();
    setMed(EMPTY);
    setPage("land");
  };

  if (page === "land") {
    return <Landing onDone={(d) => { setMed(d); setPage("dash"); }}/>;
  }
  return (
    <Dashboard
      medData={med}
      onMedUpdate={setMed}
      onReset={handleReset}
    />
  );
}
