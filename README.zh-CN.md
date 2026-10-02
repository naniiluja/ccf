# CCF — Claude Context First

[English](./README.md) · [Tiếng Việt](./README.vi.md) · **简体中文**

一个 [Claude Code](https://code.claude.com) 插件，让你的 AI 编程助手守规矩：先做计划、规格常新、对照规格验收、无关任务并行跑。

## 为什么用它

原生 Claude Code 是个聪明但健忘的助手。会话一长，它就忘记你的项目规则，规划做到一半滑成改文件，也从不提醒你更新文档。CCF 加了三个很牢的习惯：

- **先规划，后写代码。** `/ccf:plan` 只能在 plan mode 下运行，规划阶段只读、可审查，不会误改文件。
- **规格常新。** Hook（随会话事件自动触发的小脚本）在代码变化时提醒你更新规格。本次学到的教训写进系统 memory，同样的错不再犯第二遍。
- **验收通过才算完。** `/ccf:check` 用两个独立审查者对照规格检查成品。没通过检查的任务，不算 done。

## 安装

在 Claude Code 里：

```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

或一步到位：`npx @naniiluja/ccf`

然后在你的项目目录打开 Claude Code，运行 `/ccf:init`。

## 5 个命令

| 命令 | 大白话 |
|---|---|
| `/ccf:init` | 给项目接入 CCF。问你几个问题，然后写出项目规格（`CLAUDE.md`）。已有项目会先读真实代码，再按实际结构写规格。 |
| `/ccf:plan` | 把一个功能切成有序的小切片（数据库、服务、界面逐层），每个切片自带测试。需要 plan mode（Shift+Tab）。 |
| `/ccf:cook` | 按 wave 并行跑切片。互不相干的任务同时进行，每个任务在独立的 repo 副本（git worktree）里；每次合并后都跑测试。 |
| `/ccf:check` | 对照规格审查成品。任务标 done 之前唯一必须过的关。 |
| `/ccf:updatespec` | 把本次会话的经验写回规格和系统 memory。 |

常用流程：`/ccf:init` → `/ccf:plan` → `/ccf:cook` → `/ccf:check` → `/ccf:updatespec`。

## 引擎盖下面

不用看这节也能用 CCF。写给好奇的人。

- **Hook 是最确定的一层。** 命令和 agent 只是提示词，模型可以选择无视。Hook 是随会话事件运行的脚本，每次必触发：在 plan mode 之外挡住 `/ccf:plan`，代码变了就提醒更新规格，compact 之后自动载入未完成的任务。
- **Agent 是 6 个只读帮手**：读代码库切片、查官方最佳实践、起草规格、两个做审查，还有一个在你动手前尝试反驳每个阻断性发现。它们都不写代码，代码由你直接在会话里写。
- **脚本是 11 个命令行工具**，只在你（或某个命令先征得你同意后）启动时才运行，因为它们会改文件或调用外部 API。其中 `prune-archive.mjs` 清理已结束的旧 iteration 的任务文件（archive 和 git 历史仍保留记录），`memory-audit.mjs` 在系统 memory 增长到需要整理时提醒 `/ccf:updatespec`，`spec-budget.mjs` 测量每个 session 都要加载的 spec 字节数，`eval-changelog.mjs` 把每个版本的 eval 分数（或未运行的原因）写进 `CHANGELOG.md`。
- **文档查询内置。** 插件自带 Context7 和 Microsoft Learn（MCP 服务器），设计建议引用真实文档，而不是模型的记忆。

完整内部文档：[plugins/ccf/README.md](./plugins/ccf/README.md)。Hook 需要 Node ≥ 18。

## 许可证

MIT

## 致谢

本项目首发于 [LINUX DO](https://linux.do/) 社区，感谢大家的支持与反馈。
