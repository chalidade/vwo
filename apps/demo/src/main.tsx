import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setupInstall } from "./install";
import "@vwo/ui/src/rpg/rpg.css";
import "./styles.css";

setupInstall();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
