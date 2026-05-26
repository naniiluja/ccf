#!/usr/bin/env node
// CCF plan-mode guard — cưỡng chế /ccf-plan chỉ chạy khi session ở plan mode.
// Sự kiện: UserPromptSubmit (vì command là prompt, không phải tool call).
// Cơ chế deterministic: đọc permission_mode từ stdin; nếu không phải "plan" → chặn (exit 2).

import { readStdinJson, blockUserPrompt } from "./lib/io.mjs";

const input = await readStdinJson();
const prompt = String(input.prompt ?? "");

// Chỉ can thiệp lệnh ccf-plan (cả dạng namespaced lẫn bare). Bỏ qua mọi prompt khác.
const isCcfPlan = /(^|\s)\/ccf:ccf-plan(\s|$)|(^|\s)\/ccf-plan(\s|$)/.test(prompt);
if (!isCcfPlan) {
  process.exit(0);
}

const mode = String(input.permission_mode ?? "");
if (mode === "plan") {
  process.exit(0); // đang ở plan mode → cho phép
}

// Không ở plan mode → chặn dứt khoát và hướng dẫn người dùng.
blockUserPrompt(
  "CCF: /ccf-plan yêu cầu plan mode. Hãy vào plan mode (nhấn Shift+Tab để xoay tới 'plan', " +
    "hoặc khởi động với --permission-mode plan) rồi chạy lại /ccf:ccf-plan. " +
    "Việc lập kế hoạch phải read-only và được duyệt trước khi thực thi.",
);
