import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Elements, PluginOptions, Register, RenderElement, StateDollar, ToolCallResult } from 'claude-code'

import type { Feeling, Mood } from '../types'
import { SPRITE_COLUMNS, SPRITE_ROWS, encode, pixelsOf } from './sprite'
import { claudeMdBudget, statusText } from './lib/ui-model.mjs'
import {
  BOARD,
  BUDGET_SCRIPT,
  COOK,
  SNAPSHOT_SCRIPT,
  WAVES,
  WAVES_SCRIPT,
  bandTree,
  registerCcfUi,
  wantsSnapshot,
  wantsWaves,
} from './ui/ccf-ui.mjs'

const PANE = 'rem'
const BUILD = /\b(dotnet\s+(build|test|run|publish)|msbuild|(npm|pnpm|yarn)\s+(run\s+)?(build|test)|tsc|pytest|mvn|gradlew?|cargo\s+(build|test)|go\s+(build|test))\b/i
const FAILED = /Build FAILED|: error [A-Z]+\d+|Failed!|npm ERR!|\b[1-9]\d* (failed|errors?)\b/i
const SLEEP_AFTER_MS = 10 * 60_000
const LONG_TURN_MS = 30_000
const HAIR = '#7fb2f0'
const CCF_SCRIPT_LIMIT_MS = 15_000
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

const GREETING: Feeling = { mood: 'idle', line: 'Rem đây. Bạn cần gì cứ gọi nhé.' }
const feeling = atom({ plugin: 'ccf', key: 'feeling' } as const, GREETING)
const isDismissed = atom({ plugin: 'ccf', key: 'isDismissed' } as const, false)
const isDocked = atom({ plugin: 'ccf', key: 'isDocked' } as const, false)
const ccfSnapshot = atom({ plugin: 'ccf', key: 'snapshot' } as const, null)
const ccfBudget = atom({ plugin: 'ccf', key: 'budget' } as const, null)
const ccfWaves = atom({ plugin: 'ccf', key: 'waves' } as const, [])
const ccfAgents = atom({ plugin: 'ccf', key: 'agents' } as const, [])

type Engine = Pick<CoreEngineInterface, 'ui' | 'state'>
type TerminalElements = Elements['terminal']

const feel = ($: StateDollar, mood: Mood, line: string) => update($, feeling, () => ({ mood, line }))

async function dock($: Engine, { isAsked }: { isAsked: boolean }): Promise<boolean> {
  const opened = await $.ui.open({ id: PANE, title: 'Rem', columns: SPRITE_COLUMNS, rows: SPRITE_ROWS })
  await update($, isDocked, () => opened.isPlaced)
  if (!opened.isPlaced && isAsked) $.ui.toast(`Rem chưa đứng cạnh ô chat được: ${opened.reason}`, { timeoutMs: 8000 })
  return opened.isPlaced
}

async function canDock($: StateDollar, isLayoutReady: boolean): Promise<boolean> {
  return isLayoutReady && !(await read($, isDocked)) && !(await read($, isDismissed))
}

async function reactToBuild($: StateDollar, command: string, ran: ToolCallResult) {
  if (ran.deny !== undefined) return

  const what = command.match(BUILD)?.[0] ?? 'build'
  const failed = ran.isError === true || FAILED.test(ran.text ?? '')

  await (failed
    ? feel($, 'worried', `${what} lỗi rồi. Để Rem xem lại.`)
    : feel($, 'happy', `${what} xanh rồi! Rem mừng lắm.`))
}

const Bubble = ({ Box, Text }: TerminalElements, line: string) => (
  <Box borderStyle="round" borderColor={HAIR} paddingX={1} flexShrink={1}>
    <Text>{line}</Text>
  </Box>
)

const Rem = ({ Raster }: TerminalElements, mood: Mood) => (
  <Raster key="rem" columns={SPRITE_COLUMNS} rows={SPRITE_ROWS} cells={cellsOf(mood)} />
)

const inColumn = (elements: TerminalElements, { mood, line }: Feeling, minHeight: number) => (
  <elements.Box flexDirection="column" justifyContent="flex-end" minHeight={minHeight}>
    {Bubble(elements, line)}
    {Rem(elements, mood)}
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
    const cwd = await $.session.cwd()
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
  $.ui.status(now ? statusText(now.specStale, size ?? undefined) : undefined)
}

async function loadCcfWaves($: CoreEngineInterface) {
  const plan = await runCcfScript($, WAVES_SCRIPT)
  const found = plan?.ok === true && Array.isArray(plan.waves) ? plan.waves : []
  await update($, ccfAgents, () => [])
  await update($, ccfWaves, () => found)
  if (found.length > 0) await $.ui.open({ id: WAVES, title: 'CCF waves' })
}

async function ccfSessionStart($: CoreEngineInterface, options: PluginOptions) {
  try {
    if (options.uiBoard === true) await $.command.register({ name: BOARD, description: 'Open the CCF board: PLAN.md tasks by status and open PENDING.md risks' })
    if (wantsWaves(options)) await $.command.register({ name: WAVES, description: 'Open the CCF wave map of the current /ccf:cook run' })
    if (wantsSnapshot(options)) $.clock.after(1, () => refreshCcf($, options))
  } catch {}
}

function ccfPromptSubmit($: CoreEngineInterface, text: string, options: PluginOptions) {
  try {
    if (wantsWaves(options) && COOK.test(text)) $.clock.after(1, () => loadCcfWaves($))
  } catch {}
}

async function ccfTurnComplete($: CoreEngineInterface, agentId: string | undefined, options: PluginOptions) {
  try {
    if (agentId !== undefined) {
      if (wantsWaves(options)) await update($, ccfAgents, list => list.map(agent => (agent.agentId === agentId ? { ...agent, isDone: true } : agent)))
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

  on('session.start', async ($, e, next) => {
    await ccfSessionStart($, options)
    lastActiveAt = await $.clock.now()
    await $.command.register({ name: 'rem', description: 'Gọi Rem ra đứng cạnh ô chat, hoặc cho Rem đi nghỉ' })

    $.clock.after(2000, async () => {
      if (await canDock($, isFullscreenLayout && !hasTriedDock)) await dock($, { isAsked: false })
    })

    $.clock.every(60_000, async () => {
      if (isTurnRunning) return
      if ((await $.clock.now()) - lastActiveAt < SLEEP_AFTER_MS) return
      if ((await read($, feeling)).mood === 'sleepy') return
      await feel($, 'sleepy', 'Lâu quá không thấy bạn. Rem chợp mắt một chút nhé.')
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    ccfPromptSubmit($, e.text, options)
    if (await canDock($, isFullscreenLayout && !hasTriedDock)) {
      hasTriedDock = true
      await dock($, { isAsked: true })
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
      return { text: (await dock($, { isAsked: true })) ? 'Rem ra đứng cạnh ô chat rồi.' : 'Rem vẫn đứng phía trên ô chat, lý do ở thông báo vừa hiện.' }
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
      if (e.origin.kind === 'person') await update($, isDismissed, () => true)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    await feel($, 'thinking', 'Để Rem lo việc này.')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if ((e.tool !== 'PowerShell' && e.tool !== 'Bash') || !BUILD.test(e.command)) return next(e)

    const ran = await next(e)
    await reactToBuild($, e.command, ran)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    await ccfTurnComplete($, e.agentId, options)
    if (e.agentId !== undefined) return next(e)

    isTurnRunning = false
    lastActiveAt = await $.clock.now()

    if (e.reason === 'aborted') {
      await feel($, 'surprised', 'Ơ, bạn dừng Rem lại à?')
    } else if (e.reason !== 'answer') {
      await feel($, 'worried', 'Hình như có trục trặc rồi, bạn thử lại giúp Rem nhé.')
    } else if ((await read($, feeling)).mood === 'thinking') {
      await feel($, 'happy', 'Xong rồi, bạn xem thử nhé.')
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
      return e.props.placement === 'dock' ? inColumn(elements, now, e.props.scroll.bodyRows) : inRow(elements, now)
    }

    const { Text } = $.ui.resolve(e)
    return <Text color={HAIR}>{KAOMOJI[now.mood]} Rem: {now.line}</Text>
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'terminal' && e.viewport !== undefined) isFullscreenLayout = e.viewport.isFullscreen === true

    const band = await ccfBand($, e, $.ui.resolve(e) as TerminalElements, options)
    const now = await read($, feeling)
    const isHidden = e.props.hasSurvey || (await read($, isDocked)) || (await read($, isDismissed))
    if (isHidden && band == null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const rem = isHidden ? await next(e) : e.surface === 'terminal' ? inRow($.ui.resolve(e), now) : <Text color={HAIR}>{KAOMOJI[now.mood]} Rem: {now.line}</Text>
    if (band == null) return rem
    return rem ? <Box flexDirection="column">{band}{rem}</Box> : band
  })
}
