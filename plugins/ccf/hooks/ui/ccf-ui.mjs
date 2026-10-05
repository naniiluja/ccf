import { atom, read, update } from 'claude-code'

import { bandLine, boardColumns, boardCommands, boardSummary, closedTaskIds, hiddenMark, isCookTaskBrief, isPlanWavesRun, matchWaveTask, progressCells, progressSvg, waveLines, waveRows, wavesFromOutput } from '../lib/ui-model.mjs'

export const BOARD = 'ccf-board'
export const WAVES = 'ccf-waves'
export const COOK = /(^|\s)\/ccf:cook(\s|$)/
export const SNAPSHOT_SCRIPT = 'hooks/lib/ui-snapshot.mjs'
export const BUDGET_SCRIPT = 'scripts/spec-budget.mjs'
export const WAVES_SCRIPT = 'scripts/plan-waves.mjs'
export const WAVES_OFF_NOTICE = 'CCF wave map is off, so /ccf:cook shows no /ccf-waves pane. Turn on uiWaves for the ccf plugin in /config.'

const ACCENT = '#7fb2f0'
const BAR_COLUMNS = 20
const BAR_PIXELS = 200
const WIDE_BOARD_COLUMNS = 80
const STATE_GLYPH = { waiting: '○', running: '◉', done: '●' }
const WAVES_SCRIPT_LIMIT_MS = 15_000

const snapshot = atom({ plugin: 'ccf', key: 'snapshot' }, null)
const waves = atom({ plugin: 'ccf', key: 'waves' }, [])
const agents = atom({ plugin: 'ccf', key: 'agents' }, [])
const wavesSource = atom({ plugin: 'ccf', key: 'wavesSource' }, null)

export function wantsSnapshot(options) {
  return options.uiBand === true || options.uiBoard === true || options.uiStatusLine === true || options.uiWaves === true
}

export function wantsWaves(options) {
  return options.uiWaves === true
}

export function bandTree(elements, now, plan, running, options) {
  const line = bandLine(now)
  if (!line) return null
  const count = wantsWaves(options) ? waveRows(plan, running, closedTaskIds(now)).flat().filter(task => task.state === 'running').length : 0
  const suffix = count > 0 ? ` · ${count} worktree agent${count === 1 ? '' : 's'} running` : ''
  return h(elements.Text, { dimColor: true, wrap: 'truncate-end' }, `${line.text}${suffix}`)
}

function progressBar(surface, elements, done, total) {
  if (surface === 'terminal') {
    return h(elements.Raster, { key: 'progress', columns: BAR_COLUMNS, rows: 1, cells: progressCells(done, total, BAR_COLUMNS) })
  }
  if (elements.Svg) {
    return h(elements.Svg, { source: progressSvg(done, total, BAR_PIXELS), alt: `${done} of ${total} tasks closed`, width: BAR_PIXELS })
  }
  return null
}

function boardTree(surface, elements, bodyColumns, now, fill) {
  const { Box, Button, Text } = elements
  if (!now) return h(Text, { dimColor: true }, 'No CCF plan here: .claude/plan/PLAN.md was not found.')

  const columns = boardColumns(now.tasks)
  const closed = columns[3].tasks.length
  const isWide = bodyColumns >= WIDE_BOARD_COLUMNS
  const bar = progressBar(surface, elements, closed, now.tasks.length)

  return h(
    Box,
    { flexDirection: 'column', gap: 1 },
    h(
      Box,
      { flexDirection: 'row', gap: 1 },
      ...(bar ? [bar] : []),
      h(Text, { wrap: 'truncate-end' }, `${closed}/${now.tasks.length} closed · ${now.openRisks} open risk${now.openRisks === 1 ? '' : 's'} in PENDING.md`),
    ),
    h(
      Box,
      { flexDirection: isWide ? 'row' : 'column', gap: isWide ? 2 : 0 },
      ...columns.map(({ column, tasks }) =>
        h(
          Box,
          { key: `column-${column}`, flexDirection: 'column', flexGrow: 1, flexShrink: 1 },
          h(Text, { bold: true, color: ACCENT }, `${column} (${tasks.length})`),
          ...tasks.map(task => h(Text, { wrap: 'truncate-end' }, `${task.id} ${task.title}`)),
        ),
      ),
    ),
    h(
      Box,
      { flexDirection: 'row', gap: 1, flexWrap: 'wrap' },
      ...boardCommands(now).map(command => h(Button, { key: `fill:${command}`, label: command, onPress: () => fill(command) })),
    ),
  )
}

function wavesTree(elements, plan, running, now) {
  const { Box, Text } = elements
  const rows = waveRows(plan, running, closedTaskIds(now))
  if (rows.length === 0) return h(Text, { dimColor: true }, 'No /ccf:cook wave in this session yet.')
  return h(
    Box,
    { flexDirection: 'column', gap: 1 },
    ...rows.map((wave, index) =>
      h(
        Box,
        { key: `wave-${index + 1}`, flexDirection: 'column' },
        h(Text, { bold: true, color: ACCENT }, `wave ${index + 1}`),
        ...wave.map(task =>
          h(Text, { wrap: 'truncate-end', dimColor: task.state === 'done' }, `${STATE_GLYPH[task.state]} ${task.id} ${task.title} · ${task.state}`),
        ),
      ),
    ),
  )
}

export function shellOutput(ran) {
  if (ran.deny !== undefined || ran.isError === true) return ''
  return typeof ran.result?.stdout === 'string' ? ran.result.stdout : ran.text ?? ''
}

async function reloadWaves($, source) {
  try {
    const dir = source?.dir ?? (await $.session.cwd())
    const tasks = source?.tasks ? ['--tasks', source.tasks] : []
    const ran = await $.process.run(['node', `${$.plugin.root}/${WAVES_SCRIPT}`, '--dir', dir, ...tasks], { cwd: dir, timeoutMs: WAVES_SCRIPT_LIMIT_MS })
    const found = wavesFromOutput(ran.stdout)
    if (found) await update($, waves, () => found)
  } catch {}
}

function isShellPlanWavesRun(e) {
  return (e.tool === 'Bash' || e.tool === 'PowerShell') && isPlanWavesRun(e.command)
}

export function isWavesRun(e, options) {
  return wantsWaves(options) && isShellPlanWavesRun(e)
}

export function isWavesOffRun(e, options) {
  return !wantsWaves(options) && isShellPlanWavesRun(e)
}

export function dockWaveLines(plan, running, now) {
  return waveLines(waveRows(plan, running, closedTaskIds(now)))
}

export function dockDivider(elements, bodyColumns, key) {
  return h(elements.Text, { key, dimColor: true, wrap: 'truncate-end' }, '─'.repeat(Math.max(1, bodyColumns)))
}

export function dockBoardRows(elements, now, rows) {
  const { Box, Raster, Text } = elements
  const summary = boardSummary(now)
  const head = h(
    Box,
    { key: 'board-head', flexDirection: 'row', gap: 1 },
    h(Raster, { key: 'progress', columns: BAR_COLUMNS, rows: 1, cells: progressCells(summary.closed, summary.total, BAR_COLUMNS) }),
    h(Box, { flexGrow: 1, flexShrink: 1 }, h(Text, { wrap: 'truncate-end' }, summary.headline)),
  )
  return rows > 1 ? [head, h(Text, { key: 'board-counts', dimColor: true, wrap: 'truncate-end' }, summary.counts)] : [head]
}

export function dockWaveRows(elements, lines, window) {
  const { Box, Text } = elements
  const shown = lines.slice(window.start, window.end)
  const last = shown.length - 1
  return shown.map((line, index) => {
    const mark = last === 0
      ? hiddenMark(window.hiddenAbove + window.hiddenBelow)
      : index === 0 ? hiddenMark(window.hiddenAbove) : index === last ? hiddenMark(window.hiddenBelow) : ''
    const text = line.isHeading ? line.text : `${STATE_GLYPH[line.state]} ${line.text}`
    const style = line.isHeading ? { bold: true, color: ACCENT } : { dimColor: line.state === 'done' }
    return h(
      Box,
      { key: `wave-line-${window.start + index}`, flexDirection: 'row', gap: 1 },
      h(Box, { flexGrow: 1, flexShrink: 1 }, h(Text, { ...style, wrap: 'truncate-end' }, text)),
      ...(mark ? [h(Text, { dimColor: true }, mark)] : []),
    )
  })
}

export function registerCcfUi(on, options) {
  if (options.uiBoard === true) {
    on('ui.render', { component: 'Pane', requestId: BOARD }, async ($, e) =>
      boardTree(e.surface, $.ui.resolve(e), e.props.bodyColumns ?? 0, await read($, snapshot), command => $.prompt.fill({ text: command })),
    )
  }

  if (wantsWaves(options)) {
    on('agent.spawn', async ($, e, next) => {
      const started = await next(e)
      try {
        const brief = `${e.description}\n${e.name ?? ''}\n${e.prompt}`
        if (started.agentId && (await read($, waves)).length === 0 && isCookTaskBrief(brief)) await reloadWaves($, await read($, wavesSource))
        const taskId = started.agentId ? matchWaveTask(await read($, waves), brief) : null
        if (taskId) await update($, agents, list => [...list, { agentId: started.agentId, taskId, isDone: false }])
      } catch {}
      return started
    })

    on('command.run', { command: WAVES }, async $ => {
      await reloadWaves($, await read($, wavesSource))
      const opened = await $.ui.open({ id: WAVES, title: 'CCF waves' })
      return { text: opened.isPlaced ? 'CCF wave map opened.' : `CCF wave map could not be placed: ${opened.reason}` }
    })

    on('ui.render', { component: 'Pane', requestId: WAVES }, async ($, e) =>
      wavesTree($.ui.resolve(e), await read($, waves), await read($, agents), await read($, snapshot)),
    )
  }
}
