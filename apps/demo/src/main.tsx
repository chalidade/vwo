import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CrashGuard, watchErrors } from "./crash";
import { setupInstall } from "./install";
import "@vwo/ui/src/rpg/rpg.css";
import "./styles.css";

setupInstall();
watchErrors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CrashGuard>
      <App />
    </CrashGuard>
  </StrictMode>,
);
