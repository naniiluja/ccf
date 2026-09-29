// CCF Jev client — one HTTP call to TypeSafe's System One API, no dependency.
// Contract (read from docs.typesafe.ai/api.md): POST {base}/v1/systemone, `Authorization: Bearer <key>`,
// body { state, model, questions }, answer { model, answers, usage }.
// It is called from a hook, so it never throws and never hangs: every failure comes back as
// `{ ok: false, reason }` with a FIXED reason string (the API key must never leak into a message),
// and the request is aborted at `timeoutMs` because the harness kills a hook at its own deadline
// (exit 1, nothing reported), which is worse than a clean, silent give-up.
// `fetchImpl` is a parameter so the whole error surface is testable without a network (the repo
// has no HTTP mock; an injected function is the smallest thing that works).

export const JEV_DEFAULT_URL = "https://api.typesafe.ai";
export const JEV_MODEL = "jev-latest";
/** Default abort deadline in ms: under the 10s hook timeout with room to print and exit. */
export const JEV_DEFAULT_TIMEOUT_MS = 6500;

/**
 * @typedef {{ ok: true, answers: Record<string, any>, usage: any }
 *   | { ok: false, reason: string }} JevResult
 */

/**
 * Map an HTTP status to a stable reason string.
 * @param {number} status
 * @returns {string}
 */
function reasonForStatus(status) {
  if (status === 401) return "unauthorized";
  if (status === 422) return "invalid-request";
  if (status === 429) return "rate-limited";
  if (status === 529) return "overloaded";
  return `http-${status}`;
}

/**
 * Ask Jev a set of questions about one `state`. Never throws.
 * @param {{
 *   apiKey?: string,
 *   baseUrl?: string,
 *   state?: any,
 *   questions?: Record<string, any>,
 *   timeoutMs?: number,
 *   fetchImpl?: (url: string, init: any) => Promise<any>,
 * }} args
 * @returns {Promise<JevResult>}
 */
export async function askJev(args) {
  try {
    const a = args && typeof args === "object" ? args : {};
    const apiKey = typeof a.apiKey === "string" ? a.apiKey.trim() : "";
    if (!apiKey) return { ok: false, reason: "no-key" };

    const base = String(a.baseUrl ?? JEV_DEFAULT_URL).replace(/\/+$/, "");
    const timeoutMs = typeof a.timeoutMs === "number" && a.timeoutMs > 0 ? a.timeoutMs : JEV_DEFAULT_TIMEOUT_MS;
    const doFetch = a.fetchImpl ?? globalThis.fetch;
    if (typeof doFetch !== "function") return { ok: false, reason: "network" };

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await doFetch(`${base}/v1/systemone`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state: a.state, model: JEV_MODEL, questions: a.questions }),
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false, reason: reasonForStatus(Number(res.status)) };
      let body;
      try {
        body = await res.json();
      } catch {
        return { ok: false, reason: timedOut ? "timeout" : "bad-json" };
      }
      const answers = body?.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) return { ok: false, reason: "bad-shape" };
      return { ok: true, answers, usage: body?.usage ?? null };
    } catch {
      return { ok: false, reason: timedOut ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false, reason: "network" };
  }
}
