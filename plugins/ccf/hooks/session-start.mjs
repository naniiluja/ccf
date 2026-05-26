#!/usr/bin/env node
// CCF session-start hook — bơm reminder context-first + tín hiệu freshness.
// Matcher: startup|clear|compact (re-inject sau compact/clear).
// Vế khôi phục của cơ chế compact-aware: sau compact, re-load task đang in-progress từ PLAN.md.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";

const input = await readStdinJson();
const cwd = String(input.cwd ?? process.cwd());
const source = String(input.source ?? "");

const planDir = join(cwd, ".claude", "plan");
const planFile = join(planDir, "PLAN.md");
const rulesDir = join(cwd, ".claude", "rules");
const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
const managed = existsSync(planDir) || hasClaudeMd;

let msg =
  "<ccf>Dự án này theo workflow CCF (Claude Context First): context-first, spec-driven, " +
  "STRICTLY SEQUENTIAL (một task một lần, không phát triển song song nhiều feature). " +
  "Ground mọi quyết định thiết kế bằng Context7 + Microsoft Learn. Giữ CLAUDE.md/.claude luôn tươi.";

if (!managed) {
  msg += " Dự án CHƯA được CCF khởi tạo — chạy /ccf:ccf-init để bắt đầu.</ccf>";
  emitContext("SessionStart", msg);
}

// --- Đã CCF-managed ---

// Tín hiệu freshness: spec cũ hơn code → nhắc updatespec.
if (specsOlderThanCode(cwd, rulesDir)) {
  msg +=
    " Spec có vẻ cũ hơn code — cân nhắc chạy /ccf:ccf-updatespec để cập nhật context.";
}

// Re-load task in-progress sau compact/clear.
if (source === "compact" || source === "clear") {
  const task = findInProgressTask(planFile);
  if (task) {
    msg +=
      ` Bạn đang dở task ${task.id}: ${task.title}.` +
      ` Đọc .claude/plan/ (task ${task.id}) để tiếp tục đúng chỗ thay vì đọc lại toàn bộ.`;
  }
}

msg += "</ccf>";
emitContext("SessionStart", msg);

// ----------------------------------------------------------------------------

/**
 * So sánh mtime mới nhất của file nguồn vs .claude/rules. True nếu code mới hơn spec.
 * Heuristic nhẹ — chỉ để nhắc, không phải kết luận chắc chắn.
 * @param {string} root
 * @param {string} rules
 */
function specsOlderThanCode(root, rules) {
  if (!existsSync(rules)) return false;
  const specMtime = newestMtime(rules, 0);
  if (specMtime === 0) return false;
  // Quét nông các thư mục nguồn phổ biến để tránh đi sâu toàn repo.
  const srcDirs = ["src", "be", "fe", "app", "lib", "packages"].map((d) => join(root, d));
  let codeMtime = 0;
  for (const d of srcDirs) {
    if (existsSync(d)) codeMtime = Math.max(codeMtime, newestMtime(d, 2));
  }
  return codeMtime > specMtime;
}

/**
 * mtime lớn nhất của file .md/.ts/.js... trong cây, giới hạn độ sâu để rẻ.
 * @param {string} dir
 * @param {number} depth còn lại được phép đệ quy
 * @returns {number}
 */
function newestMtime(dir, depth) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = join(dir, e.name);
    try {
      if (e.isDirectory()) {
        if (depth > 0) newest = Math.max(newest, newestMtime(full, depth - 1));
      } else {
        newest = Math.max(newest, statSync(full).mtimeMs);
      }
    } catch {
      // bỏ qua file không đọc được
    }
  }
  return newest;
}

/**
 * Tìm task đầu tiên có status "in-progress" trong bảng task của PLAN.md.
 * Định dạng hàng: | 001 | Title | BE | — | in-progress |
 * @param {string} file
 * @returns {{ id: string, title: string } | null}
 */
function findInProgressTask(file) {
  if (!existsSync(file)) return null;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    if (!/in[-\s]?progress/i.test(line)) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length >= 2) {
      return { id: cells[0], title: cells[1] };
    }
  }
  return null;
}
