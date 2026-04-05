import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Leaderboard } from "./leaderboard.js";
import "../index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
    const root = createRoot(rootElement);
    root.render((
        <StrictMode>
            <Leaderboard />
        </StrictMode>
    ));
}
