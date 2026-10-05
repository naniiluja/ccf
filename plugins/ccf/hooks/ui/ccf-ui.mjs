import { atom, read, update } from 'claude-code'

import { bandLine, boardColumns, boardCommands, matchWaveTask, progressCells, progressSvg, waveRows } from '../lib/ui-model.mjs'

export const BOARD = 'ccf-board'
export const WAVES = 'ccf-waves'
export const COOK = /^\s*\/ccf:cook(\s|$)/
export const SNAPSHOT_SCRIPT = 'hooks/lib/ui-snapshot.mjs'
export const BUDGET_SCRIPT = 'scripts/spec-budget.mjs'
export const WAVES_SCRIPT = 'scripts/plan-waves.mjs'

const ACCENT = '#7fb2f0'
const BAR_COLUMNS = 20
const BAR_PIXELS = 200
const WIDE_BOARD_COLUMNS = 80
const STATE_GLYPH = { waiting: '○', running: '◉', done: '●' }

const snapshot = atom({ plugin: 'ccf', key: 'snapshot' }, null)
const waves = atom({ plugin: 'ccf', key: 'waves' }, [])
const agents = atom({ plugin: 'ccf', key: 'agents' }, [])

export function wantsSnapshot(options) {
  return options.uiBand === true || options.uiBoard === true || options.uiStatusLine === true
}

export function wantsWaves(options) {
  return options.uiWaves === true
}

export function bandTree(elements, now, plan, running, options) {
  const line = bandLine(now)
  if (!line) return null
  const count = wantsWaves(options) ? waveRows(plan, running).flat().filter(task => task.state === 'running').length : 0
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
      h(Text, null, `${closed}/${now.tasks.length} closed · ${now.openRisks} open risk${now.openRisks === 1 ? '' : 's'} in PENDING.md`),
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

function wavesTree(elements, plan, running) {
  const { Box, Text } = elements
  const rows = waveRows(plan, running)
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
        const taskId = started.agentId ? matchWaveTask(await read($, waves), `${e.description}\n${e.name ?? ''}\n${e.prompt}`) : null
        if (taskId) await update($, agents, list => [...list, { agentId: started.agentId, taskId, isDone: false }])
      } catch {}
      return started
    })

    on('command.run', { command: WAVES }, async $ => {
      const opened = await $.ui.open({ id: WAVES, title: 'CCF waves' })
      return { text: opened.isPlaced ? 'CCF wave map opened.' : `CCF wave map could not be placed: ${opened.reason}` }
    })

    on('ui.render', { component: 'Pane', requestId: WAVES }, async ($, e) =>
      wavesTree($.ui.resolve(e), await read($, waves), await read($, agents)),
    )
  }
}
