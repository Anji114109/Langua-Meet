import React from "react"; // ✅ REQUIRED in your setup
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FirebaseProvider } from "./context/Firebase";
import App from "./App";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <FirebaseProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </FirebaseProvider>
);
