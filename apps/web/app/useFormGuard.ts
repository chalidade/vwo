"use client";

import { solvePow } from "@vwo/shared";
import { useEffect, useRef, useState } from "react";

/** Wait this long after a token came before sending: the server refuses anything faster (lib/antibot.ts FORM_MIN_MS). */
const MIN_WAIT_MS = 3_300;

/**
 * The browser's half of the form checks: keep the page's signed token (and the fresh one each answer
 * brings), work out its proof of work in the background while the person types, and when they send,
 * wait until the token is old enough. Nobody notices either: filling the form takes far longer.
 */
export function useFormGuard(initial: string) {
  // "at" is this device's clock when the token arrived (the first one is as old as the page).
  const [token, setToken] = useState(() => ({ value: initial, at: Date.now() }));
  const work = useRef<Promise<string | null> | null>(null);
  useEffect(() => {
    const bits = Number(token.value.split(".")[2]) || 0;
    const stop = { aborted: false };
    work.current = bits > 0 && typeof crypto !== "undefined" && crypto.subtle ? solvePow(token.value, bits, undefined, stop) : Promise.resolve(bits > 0 ? null : "0");
    return () => {
      stop.aborted = true;
    };
  }, [token.value]);
  return {
    /** A new token from an answer of the server. */
    renew(next: unknown) {
      if (typeof next === "string" && next !== token.value) setToken({ value: next, at: Date.now() });
    },
    /** What goes with the form: the token and its proof of work, once the token is old enough. */
    async fields() {
      const wait = MIN_WAIT_MS - (Date.now() - token.at);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const pow = (await work.current) ?? undefined;
      return { form: token.value, ...(pow ? { pow } : {}) };
    },
  };
}
