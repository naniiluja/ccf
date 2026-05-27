# CCF — Claude Context First

[English](./README.md) · [Tiếng Việt](./README.vi.md) · **简体中文**

一个面向 [Claude Code](https://code.claude.com) 的工作流插件，强制执行**上下文优先、规格驱动、严格串行**的工作方式。CCF 把松散的「氛围式编码」循环变成一条有纪律的流水线：规格始终新鲜、每个决策都基于真实文档、工作以可验证的切片逐个推进。

- **上下文优先** — 规格存放在 `CLAUDE.md` + `.claude/` 中，持续保持新鲜，让每个会话开始时就已经了解项目。
- **基于权威文档** — 每个设计决策都参考来自 **Context7** 和 **Microsoft Learn**（插件自带这两个 MCP 服务器）的最佳实践，而不是凭记忆。
- **严格串行** — 一次只做一个任务（垂直切片的瀑布式），不并行开发多个功能，以最大化质量。
- **适配你的代码库** — 既可以将新项目引导为 monorepo（在根目录 git init；全栈则分为 `be/` + `fe/`，各自带有嵌套规格），也可以接管已有代码库——此时 `/ccf:ccf-init` 用 5 个只读 agent 分析真实结构并生成与之匹配的规格，不强加任何目录布局。

## 为什么用 CCF — 它解决的问题

| 纯 Claude Code 的痛点 | CCF 的应对 |
|---|---|
| 长会话中上下文「腐化」，模型偏离规则 | 一个 **`SessionStart` 钩子**在每次 start/clear/compact 时重新注入上下文优先提醒，并在 compact 后重新加载进行中的任务。 |
| 规格悄悄落后于代码 | 两个**新鲜度钩子**比较规格与代码的 mtime 并*提示*运行 `/ccf:ccf-updatespec`——在会话开始时和你停止时。 |
| 规划直接滑向改文件 | 一个 **`UserPromptSubmit` 钩子**硬性阻止 `/ccf:ccf-plan`，除非你处于 plan mode——规划保持只读且可审查。 |
| 设计决策基于陈旧记忆 | 自带 **Context7 + Microsoft Learn** MCP；CCF 提示词在动笔前引用官方文档。 |
| 错误跨会话重复出现 | `/ccf:ccf-updatespec` 写入**两层**——项目规则写进规格，防错 feedback 写进系统 **memory**（以更高权重加载）。 |
| 难以审查的大爆炸式功能 | 计划是**垂直切片的瀑布式**，每个切片是一颗细的曳光弹（DB→service→UI），各自带有测试关卡。 |

## 安装

### 通过 marketplace（推荐）
```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

### 通过 npx
```
npx @naniiluja/ccf
```
（替你执行 `claude plugin marketplace add` + `install`）

### 本地（用于开发）
```
claude plugin marketplace add D:/projects/ccf
claude plugin install ccf@ccf
```

安装后，在你的项目文件夹中打开 Claude Code 并运行 `/ccf:ccf-init`。

## 5 个命令

| 命令 | 作用 |
|------|------|
| `/ccf:ccf-init` | 引导一个新项目（访谈 → 生成 CLAUDE.md + .claude + 计划）或接管一个已有项目（5 个只读分析 agent 映射真实结构）。 |
| `/ccf:ccf-plan` | 为一个功能创建串行计划，基于最佳实践。**需要 plan mode**（Shift+Tab）——由钩子强制。计划后用 agent 执行每个任务。 |
| `/ccf:ccf-check` | 对照规格验证实现（一致性、约定、SOLID/OOP、前后端交叉检查）。只读。 |
| `/ccf:ccf-fix` | 有纪律的调试：复现 → 逐步追踪日志/数据库 → 根因 → 失败测试 → 最小修复。不靠猜。 |
| `/ccf:ccf-updatespec` | 用本次会话的经验更新规格**和系统 memory**（包括新工具及其「何时使用」）。 |

典型流程：`ccf-init` → （plan mode）`ccf-plan` → 实现 → `ccf-check` → `/code-review` → `ccf-updatespec`。

## 6 个 agent

专用子 agent，各自拥有最小权限的工具。并行**仅用于只读研究**——写文件的 agent 绝不在同一功能上并行运行。

| Agent | 角色 | 模式 |
|---|---|---|
| `ccf-codebase-analyzer` | 分析已有代码库的一个切片；`/ccf-init` 并行 fan-out 5 个。 | 只读 |
| `ccf-best-practice-researcher` | 在隔离上下文中从 Context7 / MS Learn 获取带引用的最佳实践。 | 只读 |
| `ccf-implementer` | 实现**恰好一个**计划任务：先写失败测试，再写代码以满足验收标准。 | 写 |
| `ccf-spec-writer` | 根据决策摘要起草 CLAUDE.md / rules 内容。 | 起草 |
| `ccf-spec-checker` | 新鲜上下文的审查者——检查实现或评审一个计划。 | 只读 |
| `ccf-debugger` | 调查一个根因假设，跟踪 correlation ID，对照数据库验证。 | 只读 |

## 钩子 — 确定性层

命令和 agent 都是*提示词*（模型可以选择忽略一个提示词）。**钩子是 CCF 唯一确定性的部分**——在生命周期事件由 `node` 运行的 `.mjs` 脚本，因此无论模型如何决定它们每次都会触发。它们**无构建、无依赖、Windows 友好**（Node ≥ 18，仅用内置模块）。

| 钩子 | 事件 | 它保证什么 |
|---|---|---|
| **plan-mode-guard** | `UserPromptSubmit` | 若提示词含 `/ccf:ccf-plan` 但会话**不在 plan mode**，它会**阻止**（exit 2）并让你进入 plan mode。其他提示词原样通过。这是「规划只读且执行前经审查」中*被强制执行*的那一半。 |
| **session-start** | `SessionStart`（`startup\|clear\|compact`） | 注入上下文优先提醒，让模型醒来就已处于 CCF 模式。若**受 CCF 管理**，当代码看起来比规格新时它会加上*新鲜度信号*，并在 `compact`/`clear` 后从 `.claude/plan/PLAN.md` **重新加载进行中的任务**，让你精确地从中断处继续。 |
| **updatespec-nudge** | `Stop` | 纯**建议性**，从不阻止。当你停止时若代码变了但规格没变，它会提示 `/ccf:ccf-check` 然后 `/ccf:ccf-updatespec`。通过 `stop_hook_active` 防止重复触发循环。 |
| **context-nudge** | `PostToolUse` | 纯**建议性**，从不阻止。读取会话 transcript 估算上下文用量；一旦超过模型上下文窗口的约 40%（即「变笨区」），它会提示你执行**主动 `/compact`**——并附上一条从进行中任务预填好的 hint——而不是等到自动 compact（那发生在模型最不敏锐的时刻）。尽力而为：读不到 transcript 时保持沉默。 |

**新鲜度启发式（共享，单一事实来源位于 `hooks/lib/freshness.mjs`）：** 两个具备新鲜度感知的钩子都比较*代码*文件的最新 `mtime` 与*规格*文件（`.claude/rules` 下的 `.md`）的最新 `mtime`。它**有限深度地遍历项目目录树**——因此适用于*任何*布局（`src/`、`server/`、`packages/x/src`、插件式的 `plugins/x/hooks`，或位于根目录的代码），而非一份固定的文件夹名单。这是轻量提示，绝非硬性结论——内容层面「规格是否仍然准确？」的判断留给 `/ccf:ccf-updatespec`。

**为什么钩子是自动加载、而非声明：** 与命令/agent/MCP 一样，钩子从标准位置 `hooks/hooks.json` 自动加载——当前 Claude Code（v2.1.x）会自动发现它。**不要**在 `plugin.json` 里加 `"hooks"` 字段指回这个标准路径：那会把文件加载两次并报错 `Duplicate hooks file detected`。`manifest.hooks` 字段仅用于位于非标准路径的*额外*钩子文件。

## 自带的 MCP 服务器

插件自带 2 个 MCP 服务器（插件级作用域，由 Claude Code 自动启停）：

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp`（远程 HTTP，无需认证）。
- **context7** — `https://mcp.context7.com/mcp`（远程 HTTP，开箱即用，无需密钥）。

> **Context7 速率限制：** 插件以无 API key 方式运行 Context7（免费速率限制）。若遇到速率限制，请在 [context7.com/dashboard](https://context7.com/dashboard) 获取免费密钥，设置 `CONTEXT7_API_KEY` 环境变量，然后重启 Claude Code。

## 规格 vs Memory（两层上下文）

`/ccf:ccf-updatespec` 把经验记录到**两个地方**，用途不同：

- **规格**（`CLAUDE.md` + `.claude/rules/`）——作为 *user message* 加载，权重较低。存放**项目规则**：约定、架构、技术栈、工具。
- **Memory**（`~/.claude/projects/<path>/memory/`）——加载进 *system prompt*，**不被降权**，因此 Claude 更严格地遵循。存放跨会话的**防错 feedback** + **用户偏好** → 帮助 Claude 少犯重复错误。

原则：**不重复**。CLAUDE.md 中总被遗忘的规则 → 写一条 `feedback` memory 来*强化*它（附上「为什么」），而不是复制其内容。

## 压缩感知机制

主动的 `/compact <hint>` 优于让 auto-compact 自动触发（当上下文已「腐化」时，模型处于最不清醒的状态）。在你压缩之后，CCF 的 `session-start` 钩子（匹配器 `compact`）会自动从 `.claude/plan/PLAN.md` 重新加载进行中的任务，恢复正确的工作上下文，无需你重新粘贴。

## 计划 = 垂直切片的瀑布式

`/ccf:ccf-init` 和 `/ccf:ccf-plan` 在 `.claude/plan/` 中生成一份计划（一个 `PLAN.md` 索引 + 若干 `task-NNN-*.md` 文件）。每个任务都是一个**细的垂直切片**——穿过它所触及各层（DB + service + UI）的曳光弹，按从薄到厚排序，每个都遵循 *规格 → 失败测试 → 实现*。每个任务恰好有**一个前驱**，并指明下一切片开始前必须变绿的**测试关卡**。这正是让「严格串行」变得具体且可审查的东西。

## 架构

- **命令** = 在会话中驱动 Claude 的 markdown 提示（不是脚本）。
- **Agent** = 6 个专用子 agent（分析器、研究员、实现者、规格撰写者、规格检查者、调试器）。
- **钩子** = 4 个直接用 `node` 运行的 `.mjs` —— 无构建步骤、无依赖、Windows 友好；共享的辅助模块（新鲜度、plan 解析、context-usage）位于 `hooks/lib/`。
- **模板** = 带 `{{...}}` 占位符的文件（`root/` 始终使用，`backend/` + `frontend/` 在全栈时使用），由 `/ccf:ccf-init` 实例化。

详见 `plugins/ccf/`。钩子需要 Node ≥ 18。

## 许可证

MIT

## 致谢

本项目首发于 [LINUX DO](https://linux.do/) 社区，感谢社区佬友的支持与反馈。
