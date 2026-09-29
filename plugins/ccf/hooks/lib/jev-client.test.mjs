// Tests for lib/jev-client.mjs — node --test, no dependency, no real network (fetch is injected).
// askJev must return every failure as DATA: it is called from a hook that may never throw or hang.

import { test } from "node:test";
import assert from "node:assert/strict";
import { askJev, JEV_DEFAULT_URL } from "./jev-client.mjs";

const KEY = "sk-test-SECRET-123";
const QUESTIONS = { q: { type: "noul", instructions: "Is it urgent?" } };

/**
 * A fake fetch answering with a fixed status and JSON body; records the call it received.
 * @param {number} status
 * @param {any} body
 */
function fakeFetch(status, body) {
  /** @type {{ url: string, init: any }[]} */
  const calls = [];
  const impl = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  return { impl, calls };
}

const OK_BODY = {
  model: "jev-1.13.0",
  answers: { q: { type: "noul", noul: 0.95 } },
  usage: { input_tokens: 296, output_tokens: 20 },
};

test("askJev: 200 → ok with answers and usage", async () => {
  const f = fakeFetch(200, OK_BODY);
  const r = await askJev({ apiKey: KEY, state: "help", questions: QUESTIONS, fetchImpl: f.impl });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.answers.q.noul, 0.95);
    assert.deepEqual(r.usage, { input_tokens: 296, output_tokens: 20 });
  }
});

test("askJev: request shape is POST {base}/v1/systemone with a Bearer header and the documented body", async () => {
  const f = fakeFetch(200, OK_BODY);
  await askJev({ apiKey: KEY, state: { a: 1 }, questions: QUESTIONS, fetchImpl: f.impl });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `${JEV_DEFAULT_URL}/v1/systemone`);
  assert.equal(f.calls[0].init.method, "POST");
  assert.equal(f.calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(f.calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { state: { a: 1 }, model: "jev-latest", questions: QUESTIONS });
});

test("askJev: a custom baseUrl is used, a trailing slash does not double up", async () => {
  const f = fakeFetch(200, OK_BODY);
  await askJev({ apiKey: KEY, baseUrl: "http://127.0.0.1:9/", state: "x", questions: QUESTIONS, fetchImpl: f.impl });
  assert.equal(f.calls[0].url, "http://127.0.0.1:9/v1/systemone");
});

test("askJev: empty / non-string key → no-key, and fetch is never called", async () => {
  for (const apiKey of ["", "   ", undefined, null, 42]) {
    const f = fakeFetch(200, OK_BODY);
    // @ts-expect-error deliberately wrong key types
    const r = await askJev({ apiKey, state: "x", questions: QUESTIONS, fetchImpl: f.impl });
    assert.deepEqual(r, { ok: false, reason: "no-key" });
    assert.equal(f.calls.length, 0);
  }
});

test("askJev: HTTP status → stable reason, never a throw", async () => {
  const table = /** @type {[number, string][]} */ ([
    [401, "unauthorized"],
    [422, "invalid-request"],
    [429, "rate-limited"],
    [529, "overloaded"],
    [500, "http-500"],
    [404, "http-404"],
  ]);
  for (const [status, reason] of table) {
    const f = fakeFetch(status, { error: "x" });
    const r = await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, fetchImpl: f.impl });
    assert.deepEqual(r, { ok: false, reason }, `status ${status}`);
  }
});

test("askJev: 200 with a non-JSON body → bad-json", async () => {
  const impl = async () => ({
    status: 200,
    ok: true,
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  });
  assert.deepEqual(await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, fetchImpl: impl }), {
    ok: false,
    reason: "bad-json",
  });
});

test("askJev: 200 JSON without an answers object → bad-shape", async () => {
  for (const body of [{}, { answers: null }, { answers: [] }, { answers: "x" }, null, []]) {
    const f = fakeFetch(200, body);
    const r = await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, fetchImpl: f.impl });
    assert.deepEqual(r, { ok: false, reason: "bad-shape" }, JSON.stringify(body));
  }
});

test("askJev: the network throwing → network", async () => {
  const impl = async () => {
    throw new TypeError("fetch failed");
  };
  assert.deepEqual(await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, fetchImpl: impl }), {
    ok: false,
    reason: "network",
  });
});

test("askJev: a response slower than timeoutMs is aborted → timeout (and returns promptly)", async () => {
  const impl = (/** @type {string} */ _url, /** @type {any} */ init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  const started = Date.now();
  const r = await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, timeoutMs: 40, fetchImpl: impl });
  assert.deepEqual(r, { ok: false, reason: "timeout" });
  assert.ok(Date.now() - started < 2000, "must not wait far past the deadline");
});

test("askJev: the key never appears in any returned reason", async () => {
  const cases = [
    fakeFetch(401, {}).impl,
    fakeFetch(500, {}).impl,
    async () => {
      throw new Error(`boom ${KEY}`);
    },
  ];
  for (const impl of cases) {
    const r = await askJev({ apiKey: KEY, state: "x", questions: QUESTIONS, fetchImpl: impl });
    assert.equal(JSON.stringify(r).includes(KEY), false);
  }
});

test("askJev: garbage args never throw", async () => {
  for (const bad of [undefined, null, {}, [], "x", 5]) {
    // @ts-expect-error deliberately wrong argument
    const r = await askJev(bad);
    assert.equal(r.ok, false);
  }
});
