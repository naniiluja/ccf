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
| 规格悄悄落后于代码 | 两个**新鲜度钩子**比较规格与代码的最后一次 **git 提交时间**并*提示*运行 `/ccf:ccf-updatespec`——在会话开始时和你停止时。 |
| 规划直接滑向改文件 | 一个 **`UserPromptSubmit` 钩子**硬性阻止 `/ccf:ccf-plan`，除非你处于 plan mode——规划保持只读且可审查。 |
| 设计决策基于陈旧记忆 | 自带 **Context7 + Microsoft Learn** MCP；CCF 提示词在动笔前引用官方文档。 |
| 错误跨会话重复出现 | `/ccf:ccf-updatespec` 写入**两层**——项目规则写进规格，防错 feedback 写进系统 **memory**（以更高权重加载）。 |
| 难以审查的大爆炸式功能 | 计划是**垂直切片的瀑布式**，每个切片是一颗细的曳光弹（DB→service→UI），各自带有测试关卡。 |
| 赶进度时测试写得草率（或被跳过） | 一个**可选启用的测试纪律**——启用后，`ccf-implementer` 在实现阶段设计契约级矩阵（等价类划分 + 边界值分析 + 决策表）并先写失败测试，且生成的 **Stop 钩子关卡会阻止停止**，直到测试真正通过。追求快速上线的流程则直接不启用。 |

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

## 6 个命令

| 命令 | 作用 |
|------|------|
| `/ccf:ccf-init` | 引导一个新项目（访谈 → 生成 CLAUDE.md + .claude + 计划）或接管一个已有项目（5 个只读分析 agent 映射真实结构）。 |
| `/ccf:ccf-plan` | 为一个功能创建串行计划，基于最佳实践。**需要 plan mode**（Shift+Tab）——由钩子强制。计划后用 agent 执行每个任务。 |
| `/ccf:ccf-check` | 对照规格验证实现（一致性、约定、SOLID/OOP、前后端交叉检查）。只读。 |
| `/ccf:ccf-fix` | 有纪律的调试：复现 → 逐步追踪日志/数据库 → 根因 → 失败测试 → 最小修复。不靠猜。 |
| `/ccf:ccf-updatespec` | 用本次会话的经验更新规格**和系统 memory**（包括新工具及其「何时使用」）。 |
| `/ccf:ccf-cook` | 一次性跑完整个 todo/in-progress backlog：顺序执行 `ccf-implementer` 循环（遇到红色关卡立即停止），然后批量验证（review + `/code-review` 并行，`/simplify`，重新过关，`/ccf:ccf-updatespec`）。与 `auto-verify.mjs --auto-verify` 互斥。 |

典型流程：`ccf-init` → （plan mode）`ccf-plan` → 实现（逐任务，或通过 `/ccf:ccf-cook` 跑完整个 backlog）→ `ccf-check` → `/code-review` → `ccf-updatespec`。启用测试纪律时，`ccf-implementer` 在实现阶段编写契约级测试矩阵，验证链会运行它们。

## 6 个 agent

专用子 agent **继承宿主项目的工具、MCP 服务器与 skill**——因此可以使用你项目提供的任意 MCP（Supabase、Oracle、chrome-devtools 等）并调用项目的 skill，无需为每个 agent 维护 allowlist。每个 CCF agent 都是 **leaf**——带有 `disallowedTools: Agent, Task`，因此不能 spawn 嵌套子 agent（子 agent 默认可嵌套 spawn 至深度 5；CCF 确定性地阻止）。只读 agent（除 `ccf-implementer` 外的全部）还额外列出 `Write, Edit, NotebookEdit`，因此拥有同样的 MCP/skill 访问范围但**不能写文件**。并行**仅用于只读研究**——写文件的 agent 绝不在同一功能上并行运行。

| Agent | 角色 | 模式 |
|---|---|---|
| `ccf-codebase-analyzer` | 分析已有代码库的一个切片；`/ccf-init` 并行 fan-out 5 个。 | 只读 |
| `ccf-best-practice-researcher` | 在隔离上下文中从 Context7 / MS Learn 获取带引用的最佳实践。 | 只读 |
| `ccf-implementer` | 实现**恰好一个**计划任务：先写失败测试，再写代码以满足验收标准。 | 写 |
| `ccf-spec-writer` | 根据决策摘要起草 CLAUDE.md / rules 内容。 | 起草 |
| `ccf-spec-checker` | 新鲜上下文的审查者——检查实现或评审一个计划，包含 premortem / 前瞻性失败视角。 | 只读 |
| `ccf-debugger` | 调查一个根因假设，跟踪 correlation ID，对照数据库验证。 | 只读 |

## 钩子 — 确定性层

命令和 agent 都是*提示词*（模型可以选择忽略一个提示词）。**钩子是 CCF 唯一确定性的部分**——在生命周期事件由 `node` 运行的 `.mjs` 脚本，因此无论模型如何决定它们每次都会触发。它们**无构建、无依赖、Windows 友好**（Node ≥ 18，仅用内置模块）。

| 钩子 | 事件 | 它保证什么 |
|---|---|---|
| **plan-mode-guard** | `UserPromptSubmit` | 若提示词含 `/ccf:ccf-plan` 但会话**不在 plan mode**，它会**阻止**（exit 2）并让你进入 plan mode。其他提示词原样通过。这是「规划只读且执行前经审查」中*被强制执行*的那一半。 |
| **plan-review-gate** | `PreToolUse`（`ExitPlanMode`） | 在 `/ccf-plan` 会话中，**拒绝** `ExitPlanMode`（使计划无法被提交审批），直到 transcript 显示已运行过一次 `ccf-spec-checker` 计划审查。对未公开的 transcript 结构尽力而为：任何读取失败或非 CCF 会话都会放行，因此绝不会误阻——强力强制，并由 `ccf-plan` 第 6 步提示词作为后备。（审查现在包含 premortem 视角；gate 机制不变。） |
| **session-start** | `SessionStart`（`startup\|clear\|compact`） | 注入上下文优先提醒，让模型醒来就已处于 CCF 模式。若**受 CCF 管理**，当代码看起来比规格新时它会加上*新鲜度信号*，并在 `compact`/`clear` 后从 `.claude/plan/PLAN.md` **重新加载进行中的任务**，让你精确地从中断处继续。 |
| **updatespec-nudge** | `Stop` | 纯**建议性**，从不阻止。三个独立提示：**(A)** 若本次会话改了代码却没跑测试，提醒你*验证工作*（运行测试 / 类型检查）；**(B)** 若代码变了但规格没变，提示 `/ccf:ccf-check` 然后 `/ccf:ccf-updatespec`；**(C)** 若本次会话跑了 `git commit` 但 `PLAN.md` 仍有任务未 `done`，提醒你把每个任务标为 `done`（仅在其 `/ccf-check` + `/code-review` 通过后）或修正其状态。通过 `stop_hook_active` 防止重复触发循环。 |
| **auto-verify** | `Stop` | **可选开启**（默认关闭），且是 CCF 唯一能**阻止**停止的 Stop 钩子。在 `hooks.json` 的 `auto-verify.mjs` 命令后加上 `--auto-verify` 即可启用。当某任务处于 **in-review**、本次会话**改了代码**、且尚无 `ccf-spec-checker` 评审运行时，它返回 `decision: "block"`（「ralph loop」），其 reason 驱动主循环跑完验证链——`/ccf:ccf-check` → `/code-review` →（若开启测试纪律则运行项目的测试命令）→ 仅当两者都干净时才 `/ccf:ccf-updatespec`。通过 `stop_hook_active` 防止循环；尽力而为，任何错误都静默退出。 |
| **context-guard** | `UserPromptSubmit` | 当 transcript 显示上下文已超过模型上下文窗口的约 40%——并设置 ~300k token 的绝对上限，因为 40% 的 1M-native 窗口（Opus/Sonnet 4.x）在自动 compact 前不可能达到——即「变笨区」，它会提示执行**主动 `/compact`**（附上从当前任务预填好的 hint）。**默认 = 警告**，不阻止：建议会同时送达你（`systemMessage`）和模型（`additionalContext`），每轮触发。**启用硬阻止**：在 `hooks.json` 的 `context-guard.mjs` 命令后加上 `--hard-block`——届时它会**阻止**（exit 2）任何超阈值的 prompt 直到你 compact，并带有逃生舱（在 prompt 前缀 `/compact`，或包含 `ccf:override`）。尽力而为：读不到 transcript 时保持沉默。 |
| **agent-rules-inject** | `SubagentStart` | 输出样式只修改**主**循环，不会被子 agent 继承，因此被 spawn 的写文件 `ccf-implementer` 可能违反编码规则。在 spawn 时，此钩子**注入**（通过 `additionalContext`）一条指令，要求阅读并遵守项目规则（`.claude/rules/*` + CLAUDE.md）以及当前生效输出样式的**编码**规则（排除人设/语气/emoji），然后自检。仅写文件的 agent 会收到（只读 agent 为 no-op）；尽力而为，绝不阻止 spawn。 |
| **explore-guide-inject** | `SubagentStart`（`Explore`） | CCF 不拥有内置 `Explore` 子 agent 的提示词，因此在 spawn 时此钩子**注入**（通过 `additionalContext`）一条简短、**与语言无关、按 LSP 条件**的探索指令：优先语义导航（`LSP` 工具——`workspaceSymbol`/`goToDefinition`/`findReferences`/`documentSymbol`，无 language server 时回退）以及 `Grep`（ripgrep）和 `Glob`，仅在定位到相关区域后才读取整个文件。尽力而为，绝不阻止 spawn。 |

**新鲜度启发式（共享，单一事实来源位于 `hooks/lib/freshness.mjs`）：** 两个具备新鲜度感知的钩子都比较*代码*文件与*规格*文件（`.claude/rules` 下的 `.md` 加 `CLAUDE.md`）的最后一次 **git 提交时间**（`git log -1 --format=%ct`）——采用 committer time，因此反映真实的内容变更，并**不受 `checkout`/`pull`/`clone` 造成的 `mtime` 扰动影响**。当 git 无法回答时（不是 git 仓库，或某路径尚无提交——例如刚 `/ccf-init` 的项目），它会**回退到有限深度的 `mtime` 遍历**，适用于*任何*布局（`src/`、`server/`、`packages/x/src`、插件式的 `plugins/x/hooks`，或位于根目录的代码）。这是轻量提示，绝非硬性结论——内容层面「规格是否仍然准确？」的判断留给 `/ccf:ccf-updatespec`。

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
- **`MEMORY.md` 是纯索引** —— 每个会话只加载**前 200 行或 25KB**，因此要保持精简；最强的一层是 **`feedback`**（始终附带 `Why`）。

原则：**不重复**。CLAUDE.md 中总被遗忘的规则 → 写一条 `feedback` memory 来*强化*它（附上「为什么」），而不是复制其内容。

## 压缩感知机制

主动的 `/compact <hint>` 优于让 auto-compact 自动触发（当上下文已「腐化」时，模型处于最不清醒的状态）。在你压缩之后，CCF 的 `session-start` 钩子（匹配器 `compact`）会自动从 `.claude/plan/PLAN.md` 重新加载进行中的任务，恢复正确的工作上下文，无需你重新粘贴。

## 计划 = 垂直切片的瀑布式

`/ccf:ccf-init` 和 `/ccf:ccf-plan` 在 `.claude/plan/` 中生成一份计划（一个 `PLAN.md` 索引 + 若干 `task-NNN-*.md` 文件）。每个任务都是一个**细的垂直切片**——穿过它所触及各层（DB + service + UI）的曳光弹，按从薄到厚排序，每个都遵循 *规格 → 失败测试 → 实现*。每个任务恰好有**一个前驱**，并指明下一切片开始前必须变绿的**测试关卡**。这正是让「严格串行」变得具体且可审查的东西。

## 架构

- **命令** = 7 个在会话中驱动 Claude 的 markdown 提示（不是脚本）：init、plan、check、test、fix、updatespec、cook。
- **Agent** = 6 个专用子 agent（分析器、研究员、实现者、规格撰写者、规格检查者、调试器）。
- **Skill** = 1 个内部 skill（`grill-me`）——各命令通过 Skill 工具调用的共享需求访谈引擎；从 `/` 菜单隐藏（`user-invocable: false`）。
- **钩子** = 8 个直接用 `node` 运行的 `.mjs` —— 无构建步骤、无依赖、Windows 友好；共享的辅助模块（新鲜度、plan 解析、context-usage、review-trace、git-trace、verify-trace、verify-chain、output-style、explore-guide）位于 `hooks/lib/`。
- **模板** = 带 `{{...}}` 占位符的文件（`root/` 始终使用，`backend/` + `frontend/` 在全栈时使用），由 `/ccf:ccf-init` 实例化。

详见 `plugins/ccf/`。钩子需要 Node ≥ 18。

## 许可证

MIT

## 致谢

本项目首发于 [LINUX DO](https://linux.do/) 社区，感谢社区佬友的支持与反馈。
