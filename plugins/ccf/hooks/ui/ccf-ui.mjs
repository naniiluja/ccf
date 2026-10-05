import { atom, read, update } from 'claude-code'

import { bandLine, boardSummary, closedTaskIds, hiddenMark, isCookTaskBrief, isPlanWavesRun, progressCells, waveLines, waveRows, wavesFromOutput } from '../lib/ui-model.mjs'
import { GREETING, VOICE_DEBOUNCE_MS, isVoiceOn, remVoice, runningLine, spawnedTaskId, voiceReply, voiceRequest } from '../lib/rem-lines.mjs'

export const COOK = /(^|\s)\/ccf:cook(\s|$)/
export const SNAPSHOT_SCRIPT = 'hooks/lib/ui-snapshot.mjs'
export const BUDGET_SCRIPT = 'scripts/spec-budget.mjs'
export const WAVES_SCRIPT = 'scripts/plan-waves.mjs'
export const WAVES_OFF_NOTICE = 'CCF wave map is off, so the Rem dock shows no wave map during /ccf:cook. Turn on uiWaves for the ccf plugin in /config.'

const ACCENT = '#7fb2f0'
const BAR_COLUMNS = 20
const STATE_GLYPH = { waiting: '○', running: '◉', done: '●' }
const WAVES_SCRIPT_LIMIT_MS = 15_000

const snapshot = atom({ plugin: 'ccf', key: 'snapshot' }, null)
const waves = atom({ plugin: 'ccf', key: 'waves' }, [])
const agents = atom({ plugin: 'ccf', key: 'agents' }, [])
const wavesSource = atom({ plugin: 'ccf', key: 'wavesSource' }, null)
const feeling = atom({ plugin: 'ccf', key: 'feeling' }, GREETING)

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

async function speak($, options, mood, line) {
  await update($, feeling, () => ({ mood, line }))
  if (!isVoiceOn(options)) return
  const turn = remVoice.begin()
  const known = remVoice.cached(mood, line)
  if (known !== null) {
    await update($, feeling, () => ({ mood, line: known }))
    return
  }
  $.clock.after(VOICE_DEBOUNCE_MS, async () => {
    try {
      if (!remVoice.isCurrent(turn)) return
      const reply = await $.model.complete(voiceRequest(mood, line))
      const said = reply.isAnswered ? voiceReply(reply.text, line) : null
      if (said === null) return
      remVoice.remember(mood, line, said)
      await update($, feeling, now => (now.mood === mood && now.line === line ? { mood, line: said } : now))
    } catch {}
  })
}

async function refreshSnapshot($) {
  try {
    const dir = (await read($, wavesSource))?.dir ?? (await $.session.cwd())
    const ran = await $.process.run(['node', `${$.plugin.root}/${SNAPSHOT_SCRIPT}`, '--dir', dir], { cwd: dir, timeoutMs: WAVES_SCRIPT_LIMIT_MS })
    const found = JSON.parse(ran.stdout)
    if (found?.ok === true) await update($, snapshot, () => found)
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
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    try {
      const brief = `${e.description}\n${e.name ?? ''}\n${e.prompt}`
      if (wantsWaves(options) && started.agentId && (await read($, waves)).length === 0 && isCookTaskBrief(brief)) await reloadWaves($, await read($, wavesSource))
      if (wantsSnapshot(options) && started.agentId && isCookTaskBrief(brief)) $.clock.after(1, () => refreshSnapshot($))
      const taskId = started.agentId ? spawnedTaskId(await read($, waves), brief) : null
      if (taskId) await update($, agents, list => [...list, { agentId: started.agentId, taskId, isDone: false }])
      const line = taskId ? runningLine(await read($, waves), await read($, agents)) : null
      if (line) await speak($, options, 'thinking', line)
    } catch {}
    return started
  })
}
