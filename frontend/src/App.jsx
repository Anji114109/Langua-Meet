import React from "react";
import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Home from "./pages/Home";

const CallPage = lazy(() => import("./pages/CallPage"));
const SummaryPage = lazy(() => import("./pages/SummaryPage")); // 🔥 ADD THIS

const App = () => {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meeting/:id" element={<CallPage />} />
        <Route path="/summary/:id" element={<SummaryPage />} /> {/* 🔥 ADD THIS */}
      </Routes>
    </Suspense>
  );
};

export default App;