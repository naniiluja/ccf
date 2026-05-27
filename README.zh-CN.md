# CCF — Claude Context First

[English](./README.md) · [Tiếng Việt](./README.vi.md) · **简体中文**

一个面向 [Claude Code](https://code.claude.com) 的工作流插件，强制执行**上下文优先、规格驱动、严格串行**的工作方式：

- **上下文优先**：规格存放在 `CLAUDE.md` + `.claude/` 中，持续保持新鲜，让每个会话都以新鲜的上下文开始。
- **基于权威文档**：每个设计决策都参考来自 **Context7** 和 **Microsoft Learn** 的最佳实践（插件自带这两个 MCP 服务器）。
- **严格串行**：一次只做一个任务（瀑布式），不并行开发多个功能——以最大化质量。
- **适配你的代码库**：既可以将新项目引导为 monorepo（在根目录 git init；全栈则分为 `be/` + `fe/`，各自带有嵌套规格），也可以接管已有代码库——此时 `/ccf:ccf-init` 用 5 个只读 agent 分析真实结构并生成与之匹配的规格，不强加任何目录布局。

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
| `/ccf:ccf-init` | 引导一个新项目（访谈 → 生成 CLAUDE.md + .claude + 计划）或接管一个已有项目（5 个分析 agent）。 |
| `/ccf:ccf-plan` | 为一个功能创建串行计划。**需要 plan mode**（Shift+Tab）。计划后用 agent 执行每个任务。 |
| `/ccf:ccf-check` | 对照规格验证实现（一致性、约定、SOLID/OOP、前后端交叉检查）。 |
| `/ccf:ccf-fix` | 有纪律的调试：复现 → 逐步追踪日志/数据库 → 根因 → 失败测试 → 修复。 |
| `/ccf:ccf-updatespec` | 用本次会话的经验更新规格**和系统 memory**（包括新工具及其「何时使用」）。 |

典型流程：`ccf-init` → （plan mode）`ccf-plan` → 实现 → `ccf-check` → `/code-review` → `ccf-updatespec`。

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

主动的 `/compact <hint>` 优于让 auto-compact 自动触发（当上下文已「腐化」时，模型处于最不清醒的状态）。在你压缩之后，CCF 的 `SessionStart` 钩子（匹配器 `compact`）会自动从 `.claude/plan/PLAN.md` 重新加载进行中的任务，恢复正确的工作上下文，无需你重新粘贴。

## 架构

- **命令** = 在会话中驱动 Claude 的 markdown 提示（不是脚本）。
- **钩子** = 直接用 `node` 运行的 `.mjs` —— 无构建步骤、无依赖、Windows 友好。
- **Agent** = 6 个专用子 agent（分析器、研究员、实现者、规格撰写者、规格检查者、调试器）。

详见 `plugins/ccf/`。钩子需要 Node ≥ 18。

## 许可证

MIT
