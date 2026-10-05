import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Elements, PluginOptions, Register, RenderElement, StateDollar, ToolCallResult } from 'claude-code'

import type { Feeling, Mood } from '../types'
import { SPRITE_COLUMNS, SPRITE_ROWS, encode, pixelsOf } from './sprite'
import { NO_TASK_LINE, claudeMdBudget, dockIsEmpty, dockLayout, isPlanWrite, liveAgents, planWavesRequest, scrollWindow, statusText, waveScroll, wavesFromOutput } from './lib/ui-model.mjs'
import {
  BOARD,
  BUDGET_SCRIPT,
  COOK,
  SNAPSHOT_SCRIPT,
  WAVES,
  WAVES_OFF_NOTICE,
  bandTree,
  dockBoardRows,
  dockDivider,
  dockWaveLines,
  dockWaveRows,
  isWavesOffRun,
  isWavesRun,
  shellOutput,
  registerCcfUi,
  wantsSnapshot,
  wantsWaves,
} from './ui/ccf-ui.mjs'
import { GREETING, VOICE_DEBOUNCE_MS, agentDoneLine, commandActivity, commandResult, doneLine, isVoiceOn, promptActivity, remVoice, startLine, voiceReply, voiceRequest } from './lib/rem-lines.mjs'

const PANE = 'rem'
const SLEEP_AFTER_MS = 10 * 60_000
const LONG_TURN_MS = 30_000
const HAIR = '#7fb2f0'
const CCF_SCRIPT_LIMIT_MS = 15_000
const CCF_NOTICE_MS = 8000
const DOCK_COLUMNS = 40
const GOODBYE = 'Rem đi nghỉ đây. Gõ /rem để gọi lại.'

const KAOMOJI: Readonly<Record<Mood, string>> = {
  idle: '(・ω・)',
  thinking: '(・_・?)',
  happy: '(^▽^)',
  worried: '(;・△・)',
  sleepy: '(－ω－)',
  surprised: '(゜o゜)',
}

const cellsByMood = new Map<Mood, string>()

function cellsOf(mood: Mood): string {
  const cached = cellsByMood.get(mood)
  if (cached !== undefined) return cached
  const cells = encode(pixelsOf(mood))
  cellsByMood.set(mood, cells)
  return cells
}

const feeling = atom({ plugin: 'ccf', key: 'feeling' } as const, GREETING as Feeling)
const isDismissed = atom({ plugin: 'ccf', key: 'isDismissed' } as const, false)
const isDocked = atom({ plugin: 'ccf', key: 'isDocked' } as const, false)
const ccfSnapshot = atom({ plugin: 'ccf', key: 'snapshot' } as const, null)
const ccfBudget = atom({ plugin: 'ccf', key: 'budget' } as const, null)
const ccfStatusLine = atom({ plugin: 'ccf', key: 'statusLine' } as const, null)
const ccfWaves = atom({ plugin: 'ccf', key: 'waves' } as const, [])
const ccfAgents = atom({ plugin: 'ccf', key: 'agents' } as const, [])
const ccfWavesSource = atom({ plugin: 'ccf', key: 'wavesSource' } as const, null)
const hasNoticedWavesOff = atom({ plugin: 'ccf', key: 'hasNoticedWavesOff' } as const, false)
const ccfWavesOffset = atom({ plugin: 'ccf', key: 'wavesOffset' } as const, 0)

type Engine = Pick<CoreEngineInterface, 'ui' | 'state'>
type TerminalElements = Elements['terminal']
type WaveRegion = { top: number; rows: number; total: number }
type Activity = NonNullable<ReturnType<typeof commandActivity>>
type CookAgent = { agentId: string; taskId: string; isDone: boolean }

const feel = ($: StateDollar, mood: Mood, line: string) => update($, feeling, () => ({ mood, line }))

async function speak($: CoreEngineInterface, options: PluginOptions, mood: Mood, line: string) {
  await feel($, mood, line)
  if (!isVoiceOn(options)) return
  const turn = remVoice.begin()
  const known = remVoice.cached(mood, line)
  if (known !== null) {
    await feel($, mood, known)
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

async function dock($: Engine, { isAsked, columns }: { isAsked: boolean; columns: number }): Promise<boolean> {
  const opened = await $.ui.open({ id: PANE, title: 'Rem', columns, rows: SPRITE_ROWS })
  await update($, isDocked, () => opened.isPlaced)
  await showStatus($)
  if (!opened.isPlaced && isAsked) $.ui.toast(`Rem chưa đứng cạnh ô chat được: ${opened.reason}`, { timeoutMs: 8000 })
  return opened.isPlaced
}

async function showStatus($: Engine) {
  const line = await read($, ccfStatusLine)
  if (line === null) return
  $.ui.status((await read($, isDocked)) ? undefined : line)
}

async function canDock($: StateDollar, isLayoutReady: boolean): Promise<boolean> {
  return isLayoutReady && !(await read($, isDocked)) && !(await read($, isDismissed))
}

async function reactToRun($: CoreEngineInterface, activity: Activity, ran: ToolCallResult, options: PluginOptions) {
  if (ran.deny !== undefined) return null

  const result = commandResult(activity, ran.isError === true, shellOutput(ran) || (ran.text ?? ''))
  if (result.mood === 'thinking') await feel($, 'thinking', result.line)
  else await speak($, options, result.mood as Mood, result.line)
  return result.mood === 'thinking' ? null : result
}

const Bubble = ({ Box, Text }: TerminalElements, line: string) => (
  <Box borderStyle="round" borderColor={HAIR} paddingX={1} flexShrink={1}>
    <Text>{line}</Text>
  </Box>
)

const Rem = ({ Raster }: TerminalElements, mood: Mood) => (
  <Raster key="rem" columns={SPRITE_COLUMNS} rows={SPRITE_ROWS} cells={cellsOf(mood)} />
)

const StatusRow = ({ Text }: TerminalElements, status: string | null) =>
  status !== null ? <Text key="status" dimColor wrap="truncate-end">{status}</Text> : null

const EmptyRow = ({ Text }: TerminalElements, isEmpty: boolean) =>
  isEmpty ? <Text key="no-task" dimColor wrap="truncate-end">{NO_TASK_LINE}</Text> : null

const inColumn = (elements: TerminalElements, { mood, line }: Feeling, minHeight: number, band: RenderElement | null, status: string | null, isEmpty = false) => (
  <elements.Box flexDirection="column" justifyContent="flex-end" minHeight={minHeight}>
    {EmptyRow(elements, isEmpty)}
    {Bubble(elements, line)}
    {Rem(elements, mood)}
    {band}
    {StatusRow(elements, status)}
  </elements.Box>
)

const inRow = (elements: TerminalElements, { mood, line }: Feeling) => (
  <elements.Box flexDirection="row" justifyContent="flex-end" alignItems="flex-end" gap={1}>
    {Bubble(elements, line)}
    {Rem(elements, mood)}
  </elements.Box>
)

async function runCcfScript($: CoreEngineInterface, script: string) {
  try {
    const cwd = (await read($, ccfWavesSource))?.dir ?? (await $.session.cwd())
    const ran = await $.process.run(['node', `${$.plugin.root}/${script}`, '--dir', cwd], { cwd, timeoutMs: CCF_SCRIPT_LIMIT_MS })
    return JSON.parse(ran.stdout)
  } catch {
    return null
  }
}

async function refreshCcf($: CoreEngineInterface, options: PluginOptions) {
  const found = await runCcfScript($, SNAPSHOT_SCRIPT)
  const now = found?.ok === true ? found : null
  await update($, ccfSnapshot, () => now)
  if (options.uiStatusLine !== true) return
  const size = now ? claudeMdBudget(await runCcfScript($, BUDGET_SCRIPT)) : null
  await update($, ccfBudget, () => size)
  const line = now ? statusText(now.specStale, size ?? undefined) ?? null : null
  await update($, ccfStatusLine, () => line)
  if (line === null) $.ui.status(undefined)
  else await showStatus($)
}

async function noticeWavesOff($: CoreEngineInterface, options: PluginOptions) {
  try {
    if (wantsWaves(options) || (await read($, hasNoticedWavesOff))) return
    await update($, hasNoticedWavesOff, () => true)
    $.ui.toast(WAVES_OFF_NOTICE, { timeoutMs: CCF_NOTICE_MS })
  } catch {}
}

async function loadWavesFromRun($: CoreEngineInterface, command: string, ran: ToolCallResult, options: PluginOptions) {
  try {
    const found = wavesFromOutput(shellOutput(ran))
    if (!found) return
    const { dir, tasks } = planWavesRequest(command)
    const source = { dir: dir ?? (await $.session.cwd()), tasks: tasks ?? null }
    await update($, ccfWavesSource, () => source)
    await update($, ccfAgents, liveAgents)
    await update($, ccfWavesOffset, () => 0)
    await update($, ccfWaves, () => found)
    $.clock.after(1, () => refreshCcf($, options))
    if (found.length === 0 || (await read($, isDocked))) return
    const opened = await $.ui.open({ id: WAVES, title: 'CCF waves' })
    if (!opened.isPlaced) $.ui.toast(`CCF wave map is waiting: ${opened.reason}. Type /ccf-waves to open it.`, { timeoutMs: CCF_NOTICE_MS })
  } catch {}
}

async function ccfSessionStart($: CoreEngineInterface, options: PluginOptions) {
  try {
    if (options.uiBoard === true) await $.command.register({ name: BOARD, description: 'Open the CCF board: PLAN.md tasks by status and open PENDING.md risks' })
    if (wantsWaves(options)) await $.command.register({ name: WAVES, description: 'Open the CCF wave map of the current /ccf:cook run' })
    if (wantsSnapshot(options)) $.clock.after(1, () => refreshCcf($, options))
  } catch {}
}

async function ccfTurnComplete($: CoreEngineInterface, agentId: string | undefined, options: PluginOptions) {
  try {
    if (agentId !== undefined) {
      await update($, ccfAgents, list => list.map(agent => (agent.agentId === agentId ? { ...agent, isDone: true } : agent)))
      if (!wantsWaves(options)) return
      $.clock.after(1, () => refreshCcf($, options))
    } else if (wantsSnapshot(options)) {
      $.clock.after(1, () => refreshCcf($, options))
    }
  } catch {}
}

async function ccfBand($: CoreEngineInterface, e: { surface: string; props: { hasSurvey: boolean } }, elements: TerminalElements, options: PluginOptions) {
  if (options.uiBand !== true || e.props.hasSurvey) return null
  try {
    return (bandTree(elements, await read($, ccfSnapshot), await read($, ccfWaves), await read($, ccfAgents), options) ?? null) as RenderElement | null
  } catch {
    return null
  }
}

async function dockTree(
  $: StateDollar,
  elements: TerminalElements,
  now: Feeling,
  { bodyRows, bodyColumns }: { bodyRows: number; bodyColumns: number },
  options: PluginOptions,
): Promise<{ tree: RenderElement; region: WaveRegion | null }> {
  const snapshot = options.uiBoard === true || options.uiBand === true || wantsWaves(options) ? await read($, ccfSnapshot) : null
  const board = options.uiBoard === true ? snapshot : null
  const lines = wantsWaves(options) ? dockWaveLines(await read($, ccfWaves), await read($, ccfAgents), snapshot) : []
  const band = options.uiBand === true ? ((bandTree(elements, snapshot, await read($, ccfWaves), await read($, ccfAgents), options) ?? null) as RenderElement | null) : null
  const status = options.uiStatusLine === true ? await read($, ccfStatusLine) : null
  const isEmpty = (options.uiBoard === true || wantsWaves(options)) && dockIsEmpty(snapshot, lines.length)
  if (isEmpty || (board === null && lines.length === 0)) return { tree: inColumn(elements, now, bodyRows, band, status, isEmpty), region: null }

  const layout = dockLayout({ bodyRows, bodyColumns, line: now.line, hasBoard: board !== null, waveLineCount: lines.length, spriteRows: SPRITE_ROWS + (band !== null ? 1 : 0) + (status !== null ? 1 : 0) })
  const window = scrollWindow(lines.length, lines.length > 0 ? await read($, ccfWavesOffset) : 0, layout.waveRows)
  const { Box } = elements
  const tree = (
    <Box flexDirection="column" minHeight={bodyRows}>
      {board !== null ? [...dockBoardRows(elements, board, layout.boardRows), dockDivider(elements, bodyColumns, 'board-divider')] : null}
      {lines.length > 0 ? [...dockWaveRows(elements, lines, window), dockDivider(elements, bodyColumns, 'wave-divider')] : null}
      <Box flexGrow={1} />
      {Bubble(elements, now.line)}
      {Rem(elements, now.mood)}
      {band}
      {StatusRow(elements, status)}
    </Box>
  )
  return { tree, region: lines.length > 0 ? { top: layout.waveTop, rows: window.end - window.start, total: lines.length } : null }
}

export const register: Register = (on, options) => {
  registerCcfUi(on, options)

  if (options.uiBoard === true) {
    on('command.run', { command: 'ccf-board' }, async $ => {
      await refreshCcf($, options)
      const opened = await $.ui.open({ id: BOARD, title: 'CCF board' })
      return { text: opened.isPlaced ? 'CCF board opened.' : `CCF board could not be placed: ${opened.reason}` }
    })
  }

  let lastActiveAt = 0
  let isTurnRunning = false
  let isFullscreenLayout = false
  let hasTriedDock = false
  let waveRegion: WaveRegion | null = null
  let lastPrompt: ReturnType<typeof promptActivity> = null
  let lastResult: Awaited<ReturnType<typeof reactToRun>> = null
  const dockColumns = options.uiBoard === true || wantsWaves(options) ? DOCK_COLUMNS : SPRITE_COLUMNS

  on('session.start', async ($, e, next) => {
    await ccfSessionStart($, options)
    lastActiveAt = await $.clock.now()
    await $.command.register({ name: 'rem', description: 'Gọi Rem ra đứng cạnh ô chat, hoặc cho Rem đi nghỉ' })

    $.clock.after(2000, async () => {
      if (await canDock($, isFullscreenLayout && !hasTriedDock)) await dock($, { isAsked: false, columns: dockColumns })
    })

    $.clock.every(60_000, async () => {
      if (isTurnRunning) return
      if ((await $.clock.now()) - lastActiveAt < SLEEP_AFTER_MS) return
      if ((await read($, feeling)).mood === 'sleepy') return
      await speak($, options, 'sleepy', 'Lâu quá không thấy bạn. Rem chợp mắt một chút nhé.')
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    lastPrompt = promptActivity(e.text)
    lastResult = null
    if (COOK.test(e.text)) await noticeWavesOff($, options)
    if (await canDock($, isFullscreenLayout && !hasTriedDock)) {
      hasTriedDock = true
      await dock($, { isAsked: true, columns: dockColumns })
    }
    return next(e)
  })

  on('command.run', { command: 'rem' }, async ($, e) => {
    if (await read($, isDocked)) {
      await update($, isDismissed, () => true)
      await $.ui.close({ id: PANE })
      return { text: GOODBYE }
    }

    if (e.presentation.isFullscreen) {
      await update($, isDismissed, () => false)
      return { text: (await dock($, { isAsked: true, columns: dockColumns })) ? 'Rem ra đứng cạnh ô chat rồi.' : 'Rem vẫn đứng phía trên ô chat, lý do ở thông báo vừa hiện.' }
    }

    const wasDismissed = await read($, isDismissed)
    await update($, isDismissed, () => !wasDismissed)
    return {
      text: wasDismissed
        ? 'Rem quay lại rồi. Giao diện này chưa phải fullscreen nên Rem đứng ở góc phải phía trên ô chat.'
        : GOODBYE,
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      await update($, isDocked, () => false)
      await showStatus($)
      if (e.origin.kind === 'person') await update($, isDismissed, () => true)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    if (lastPrompt !== null) await speak($, options, 'thinking', startLine(lastPrompt))
    else await feel($, 'thinking', startLine(lastPrompt))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const activity = e.tool === 'PowerShell' || e.tool === 'Bash' ? commandActivity(e.command) : null
    if (activity !== null) await feel($, 'thinking', activity.line)
    if (isWavesRun(e, options)) {
      const ran = await next(e)
      await loadWavesFromRun($, e.command, ran, options)
      if (activity !== null) lastResult = (await reactToRun($, activity, ran, options)) ?? lastResult
      return ran
    }
    if (isWavesOffRun(e, options)) await noticeWavesOff($, options)
    if (wantsSnapshot(options) && e.agentId === undefined && isPlanWrite(e.tool, String((e as { file_path?: unknown }).file_path ?? ''))) {
      const ran = await next(e)
      $.clock.after(1, () => refreshCcf($, options))
      return ran
    }
    if (activity === null) return next(e)

    const ran = await next(e)
    lastResult = (await reactToRun($, activity, ran, options)) ?? lastResult
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    await ccfTurnComplete($, e.agentId, options)
    if (e.agentId !== undefined) {
      const agents: CookAgent[] = await read($, ccfAgents)
      const finished = agents.find(agent => agent.agentId === e.agentId)
      const line = finished ? agentDoneLine(await read($, ccfWaves), agents, finished.taskId) : null
      if (line !== null) await speak($, options, 'thinking', line)
      return next(e)
    }

    isTurnRunning = false
    lastActiveAt = await $.clock.now()

    if (e.reason === 'aborted') {
      await speak($, options, 'surprised', 'Ơ, bạn dừng Rem lại à?')
    } else if (e.reason !== 'answer') {
      await speak($, options, 'worried', 'Hình như có trục trặc rồi, bạn thử lại giúp Rem nhé.')
    } else if (['thinking', 'happy', 'worried'].includes((await read($, feeling)).mood)) {
      await speak($, options, lastResult?.failed ? 'worried' : 'happy', doneLine(lastPrompt ?? undefined, lastResult?.outcome ?? ''))
    }

    if (!e.isAborted && e.durationMs > LONG_TURN_MS) {
      $.ui.toast(`Rem làm xong rồi (${Math.round(e.durationMs / 1000)}s)`)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const now = await read($, feeling)

    if (e.surface === 'terminal') {
      const elements = $.ui.resolve(e)
      if (e.props.placement !== 'dock') {
        waveRegion = null
        return inRow(elements, now)
      }
      const drawn = await dockTree($, elements, now, { bodyRows: e.props.scroll.bodyRows, bodyColumns: e.props.bodyColumns }, options)
      waveRegion = drawn.region
      return drawn.tree
    }

    const { Text } = $.ui.resolve(e)
    return <Text color={HAIR}>{KAOMOJI[now.mood]} Rem: {now.line}</Text>
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const region = waveRegion
    const offset = await read($, ccfWavesOffset)
    const moved = region === null ? null : waveScroll(region, offset, e.by, e.pointer !== undefined, e.pointer?.row ?? 0)
    if (moved === null) return next(e)
    if (moved !== offset) await update($, ccfWavesOffset, () => moved)
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'terminal' && e.viewport !== undefined) isFullscreenLayout = e.viewport.isFullscreen === true

    const docked = await read($, isDocked)
    const band = e.surface === 'terminal' && docked ? null : await ccfBand($, e, $.ui.resolve(e) as TerminalElements, options)
    const now = await read($, feeling)
    const isHidden = e.props.hasSurvey || docked || (await read($, isDismissed))
    if (isHidden && band == null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const rem = isHidden ? await next(e) : e.surface === 'terminal' ? inRow($.ui.resolve(e), now) : <Text color={HAIR}>{KAOMOJI[now.mood]} Rem: {now.line}</Text>
    if (band == null) return rem
    return rem ? <Box flexDirection="column">{band}{rem}</Box> : band
  })
}
