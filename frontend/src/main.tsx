import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { describeError, logError } from "./diagnostics/log";
import "./styles.css";

// Anything that goes wrong without being handled still reaches the log.
window.addEventListener("error", (event) => logError("app", event.message || "Unexpected error", event.filename ? `${event.filename}:${event.lineno}` : undefined));
window.addEventListener("unhandledrejection", (event) => logError("app", "Unhandled failure", describeError(event.reason)));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
