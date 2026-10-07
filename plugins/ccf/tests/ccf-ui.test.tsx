import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

const SNAPSHOT = {
  ok: true,
  active: { id: '070', title: 'prune-archive', status: 'in-review', column: 'in-review' },
  tasks: [
    { id: '070', title: 'prune-archive', status: 'in-review', column: 'in-review' },
    { id: '073', title: 'exit code', status: 'done', column: 'done' },
    { id: '075', title: 'new slice', status: 'todo', column: 'todo' },
  ],
  openRisks: 8,
  specStale: true,
}

const BUDGET = {
  files: [{ path: 'CLAUDE.md', bytes: 7600, lines: 40, depth: 0 }],
  total: 61000,
  claudeMdOver: false,
  limits: { lines: 200, bytes: 12288 },
}

const WAVES = {
  ok: true,
  waves: [
    [
      { id: '070', title: 'prune-archive', taskFile: 'task-070-prune-archive.md', worktree: 'ccf-lc-070', branch: 'worktree-ccf-lc-070' },
      { id: '071', title: 'memory-audit', taskFile: 'task-071-memory-audit.md', worktree: 'ccf-lc-071', branch: 'worktree-ccf-lc-071' },
    ],
    [{ id: '072', title: 'spec sync', taskFile: 'task-072-spec-sync.md', worktree: 'ccf-lc-072', branch: 'worktree-ccf-lc-072' }],
  ],
}

const BAND = {
  plugin: 'ccf',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const pane = (requestId: string, bodyColumns: number) => ({
  plugin: 'ccf',
  component: 'Pane',
  requestId,
  props: { title: 'CCF', isFocused: false, bodyColumns, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} },
}) as const

const dockPane = (bodyRows: number) => ({
  plugin: 'ccf',
  component: 'Pane',
  requestId: 'rem',
  props: { title: 'Rem', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} },
}) as const

const wavesPane = (bodyColumns = 60) => ({
  plugin: 'ccf',
  component: 'Pane',
  requestId: 'waves',
  props: { title: 'Waves', isFocused: false, bodyColumns, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} },
}) as const

const wavesRun = (command = 'node "/cache/ccf/scripts/plan-waves.mjs" --tasks 070,071,072') => ({ tool: 'Bash', command }) as const

function answerWavesRun(on: On) {
  on('tool.call', () => ({ result: { stdout: JSON.stringify(WAVES), stderr: '', interrupted: false }, text: JSON.stringify(WAVES) }))
}

function collectToasts(on: On) {
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return toasts
}

const ALL_ON = { uiBand: true, uiBoard: true, uiWaves: true, uiStatusLine: true }

function answerScripts(on: On, ran: string[], argvs: string[][] = [], opened?: string[], waitReason?: string) {
  on('process.run', ($, e) => {
    const script = e.argv[1] ?? ''
    ran.push(script)
    argvs.push([...e.argv])
    const body = script.endsWith('ui-snapshot.mjs') ? SNAPSHOT : script.endsWith('spec-budget.mjs') ? BUDGET : script.endsWith('plan-waves.mjs') ? WAVES : {}
    return { value: { exitCode: 0, stdout: JSON.stringify(body), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', ($, e) => {
    opened?.push(e.id)
    return waitReason === undefined ? { value: { isPlaced: true } } : { value: { isPlaced: false, reason: waitReason } }
  })
  on('session.cwd', () => ({ value: '/project' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
}

async function loadSnapshot($: any, clock: { advance: (ms: number) => Promise<void> }) {
  await $.turn.complete(finishTurn())
  await clock.advance(10)
}

async function dockRem($: any, clock: { advance: (ms: number) => Promise<void> }) {
  const above = await $.ui.mount({ surface: 'terminal', ...BAND, viewport: { columns: 130, rows: 40, isFullscreen: true } })
  await clock.advance(10)
  await above.unmount()
}

const finishTurn = (agentId?: string) => ({ answer: '', durationMs: 10, isAborted: false, turnId: 'turn-1', reason: 'answer', ...(agentId ? { agentId } : {}) }) as const

describe('ccf ui layer', () => {
  test('default config: no CCF script runs and no band line', async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    const clock = mock.clock(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    await $.turn.complete(finishTurn())
    await clock.advance(10)

    const band = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await band.find({ type: 'Text', text: /next:/ })).toBeUndefined()
    await band.unmount()
    expect(ran).toEqual([])
  })

  test('band shows the active task, its lifecycle track and the next command', { options: { uiBand: true, uiBoard: true } }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    await loadSnapshot($, clock)

    for (const surface of ['terminal', 'desktop'] as const) {
      const band = await $.ui.mount({ surface, ...BAND })
      expect(await band.find({ type: 'Text', text: '070 ●━━●━━◉━━○ in-review · next: /ccf:check' })).toBeDefined()
      await band.unmount()
    }
  })

  test('status line reports spec freshness and the CLAUDE.md size', { options: { uiStatusLine: true } }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    const lines: (string | undefined)[] = []
    on('ui.status', ($, e) => {
      lines.push(e.text)
      return { value: undefined }
    })

    await $.turn.complete(finishTurn())
    await clock.advance(10)

    expect(lines.at(-1)).toBe('CCF · spec older than code: /ccf:updatespec · CLAUDE.md 7.4/12KB, 40 lines · paid 59.6KB')
  })

  test('wave map: submitting /ccf:cook runs no script, the step 2 plan-waves.mjs call loads the waves', { options: ALL_ON }, async ($, on) => {
    const ran: string[] = []
    const opened: string[] = []
    answerScripts(on, ran, [], opened)
    const clock = mock.clock(on)
    on('prompt.submit', ($, e) => ({ text: e.text }))
    on('tool.call', () => ({ result: { stdout: JSON.stringify(WAVES, null, 2), stderr: '', interrupted: false }, text: JSON.stringify(WAVES) }))
    on('agent.spawn', ($, e) => ({ model: 'sonnet', agentId: e.description.includes('070') ? 'agent-070' : 'agent-071' }))

    await dockRem($, clock)
    await $.prompt.submit({ text: '/ccf:cook' } as never)
    await clock.advance(10)
    expect(ran.some(script => script.endsWith('plan-waves.mjs'))).toBe(false)

    await $.tool.call({ tool: 'Bash', command: 'node "/cache/ccf/scripts/plan-waves.mjs" --tasks 070,071,072' })
    expect(opened).toEqual(['rem'])

    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-070-prune-archive.md', description: 'task 070' } as never)
    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-071-memory-audit.md', description: 'task 071' } as never)
    await $.turn.complete(finishTurn('agent-070'))

    const map = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await map.find({ type: 'Button', text: /● 070 prune-archive/ })).toBeDefined()
    expect(await map.find({ type: 'Button', text: /◉ 071 memory-audit/ })).toBeDefined()
    expect(await map.find({ type: 'Button', text: /○ 072 spec sync/ })).toBeDefined()
    await map.unmount()
  })

  test('wave map: a plan-waves.mjs call that fails or says no-plan loads nothing', { options: ALL_ON }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    on('tool.call', () => ({ result: { stdout: JSON.stringify({ ok: false, reason: 'no-plan' }), stderr: '', interrupted: false }, text: '' }))

    await dockRem($, clock)
    await $.tool.call({ tool: 'Bash', command: 'node /cache/ccf/scripts/plan-waves.mjs --tasks 070' })

    const map = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await map.find({ type: 'Button', text: /wave 1/ })).toBeUndefined()
    await map.unmount()
  })

  test('uiWaves off: /ccf:cook shows one toast per session naming the option', async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    const toasts: string[] = []
    on('ui.toast', ($, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('prompt.submit', ($, e) => ({ text: e.text }))

    await $.prompt.submit({ text: '/ccf:plan add x' } as never)
    expect(toasts).toEqual([])
    await $.prompt.submit({ text: '/ccf:cook' } as never)
    await $.prompt.submit({ text: '/ccf:cook 070' } as never)

    expect(toasts.length).toBe(1)
    expect(toasts[0]).toMatch(/wave map is off.*uiWaves/)
    expect(ran).toEqual([])
  })

  test('uiWaves on: /ccf:cook shows no wave-map toast', { options: { uiWaves: true } }, async ($, on) => {
    answerScripts(on, [])
    const toasts: string[] = []
    on('ui.toast', ($, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('prompt.submit', ($, e) => ({ text: e.text }))

    await $.prompt.submit({ text: '/ccf:cook' } as never)
    expect(toasts.filter(text => /uiWaves/.test(text))).toEqual([])
  })

  test('a failing CCF script leaves the engine band and the mascot untouched', { options: ALL_ON }, async ($, on) => {
    on('process.run', () => {
      throw new Error('node missing')
    })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('session.cwd', () => ({ value: '/project' }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    const clock = mock.clock(on)
    await loadSnapshot($, clock)
    const band = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await band.find({ type: 'Text', text: /next:/ })).toBeUndefined()
    expect(await band.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await band.unmount()
  })

  test('uiWaves off: a plan-waves.mjs run from a cook the model started toasts once per session', async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    const toasts = collectToasts(on)
    answerWavesRun(on)
    on('prompt.submit', ($, e) => ({ text: e.text }))

    await $.prompt.submit({ text: 'chạy lại cook đi' } as never)
    expect(toasts).toEqual([])
    await $.tool.call(wavesRun())
    await $.tool.call(wavesRun())

    expect(toasts.length).toBe(1)
    expect(toasts[0]).toMatch(/wave map is off.*uiWaves/)
    expect(ran).toEqual([])
  })

  test('uiWaves off: /ccf:cook inside a sentence toasts, a longer command name does not', async ($, on) => {
    answerScripts(on, [])
    const toasts = collectToasts(on)
    on('prompt.submit', ($, e) => ({ text: e.text }))

    await $.prompt.submit({ text: 'chạy /ccf:cookbook đi' } as never)
    expect(toasts).toEqual([])
    await $.prompt.submit({ text: 'chạy /ccf:cook đi' } as never)
    expect(toasts.length).toBe(1)
  })

  test('wave map: a task PLAN.md shows in-review is done with no agent seen, read from the plan-waves --dir', { options: { uiWaves: true } }, async ($, on) => {
    const argvs: string[][] = []
    answerScripts(on, [], argvs)
    const clock = mock.clock(on)
    answerWavesRun(on)
    await dockRem($, clock)

    await $.tool.call(wavesRun('node "/cache/ccf/scripts/plan-waves.mjs" --dir /work/app --tasks 070,071,072'))
    await clock.advance(10)

    expect(argvs.find(argv => (argv[1] ?? '').endsWith('ui-snapshot.mjs'))?.slice(2)).toEqual(['--dir', '/work/app'])
    const map = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await map.find({ type: 'Button', text: /● 070 prune-archive/ })).toBeDefined()
    expect(await map.find({ type: 'Button', text: /○ 071 memory-audit/ })).toBeDefined()
    await map.unmount()
  })

  test('wave map: a second plan-waves.mjs run keeps the agents still running', { options: { uiWaves: true } }, async ($, on) => {
    answerScripts(on, [])
    answerWavesRun(on)
    const clock = mock.clock(on)
    on('agent.spawn', ($, e) => ({ model: 'sonnet', agentId: e.description.includes('071') ? 'agent-071' : 'agent-072' }))

    await dockRem($, clock)
    await $.tool.call(wavesRun())
    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-071-memory-audit.md', description: 'task 071' } as never)
    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-072-spec-sync.md', description: 'task 072' } as never)
    await $.turn.complete(finishTurn('agent-072'))
    await $.tool.call(wavesRun())

    const map = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await map.find({ type: 'Button', text: /◉ 071 memory-audit/ })).toBeDefined()
    expect(await map.find({ type: 'Button', text: /○ 072 spec sync/ })).toBeDefined()
    await map.unmount()
  })

  test('wave map: a cook task agent spawned before any plan-waves.mjs run reloads the waves and is tracked', { options: { uiWaves: true } }, async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    const clock = mock.clock(on)
    on('agent.spawn', () => ({ model: 'sonnet', agentId: 'agent-071' }))

    await dockRem($, clock)
    await $.agent.spawn({ prompt: 'Explore the repo', description: 'explore' } as never)
    expect(ran.filter(script => script.endsWith('plan-waves.mjs'))).toEqual([])

    await $.agent.spawn({ prompt: 'Task: 071, task file `task-071-memory-audit.md`. Branch: `worktree-ccf-lc-071`.', description: 'task 071' } as never)
    expect(ran.filter(script => script.endsWith('plan-waves.mjs')).length).toBe(1)

    const map = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await map.find({ type: 'Button', text: /◉ 071 memory-audit/ })).toBeDefined()
    await map.unmount()
  })

  test('board: a PLAN.md write in the main session refreshes the snapshot, another file does not', { options: { uiBoard: true } }, async ($, on) => {
    let status = 'todo'
    const ran: string[] = []
    on('process.run', ($, e) => {
      const script = e.argv[1] ?? ''
      ran.push(script)
      const body = { ...SNAPSHOT, tasks: SNAPSHOT.tasks.map(task => (task.id === '075' ? { ...task, status, column: status } : task)) }
      return { value: { exitCode: 0, stdout: JSON.stringify(body), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('session.cwd', () => ({ value: '/project' }))
    on('tool.call', () => ({ result: '', text: '' }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    const clock = mock.clock(on)

    await dockRem($, clock)
    await loadSnapshot($, clock)
    status = 'in-progress'
    await $.tool.call({ tool: 'Edit', file_path: '/project/src/a.ts', old_string: 'a', new_string: 'b' } as never)
    await clock.advance(10)
    expect(ran.filter(script => script.endsWith('ui-snapshot.mjs')).length).toBe(1)

    await $.tool.call({ tool: 'Edit', file_path: '/project/.claude/plan/PLAN.md', old_string: '| todo |', new_string: '| in-progress |' } as never)
    await clock.advance(10)
    expect(ran.filter(script => script.endsWith('ui-snapshot.mjs')).length).toBe(2)

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Text', text: 'todo 0 · doing 1 · review 1 · done 1' })).toBeDefined()
    await dock.unmount()
  })

  test('board: a cook task agent spawn refreshes the snapshot, an unrelated spawn does not', { options: { uiBoard: true } }, async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    on('agent.spawn', () => ({ model: 'sonnet', agentId: 'agent-071' }))
    const clock = mock.clock(on)

    await $.agent.spawn({ prompt: 'Explore the repo', description: 'explore' } as never)
    await clock.advance(10)
    expect(ran.filter(script => script.endsWith('ui-snapshot.mjs'))).toEqual([])

    await $.agent.spawn({ prompt: 'Task: 071, task file `task-071-memory-audit.md`. Branch: `worktree-ccf-lc-071`.', description: 'task 071' } as never)
    await clock.advance(10)
    expect(ran.filter(script => script.endsWith('ui-snapshot.mjs')).length).toBe(1)
  })

  test('dock: with no PLAN.md task and no wave the dock says there is no task yet and points to /ccf:plan', { options: { uiBoard: true } }, async ($, on) => {
    let tasks: typeof SNAPSHOT.tasks = []
    on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify({ ...SNAPSHOT, active: null, tasks }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('session.cwd', () => ({ value: '/project' }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    const clock = mock.clock(on)

    await dockRem($, clock)
    await loadSnapshot($, clock)
    const empty = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await empty.find({ type: 'Text', text: 'Chưa có task nào. Gõ /ccf:plan nhé.' })).toBeDefined()
    expect(await empty.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    expect(await empty.find({ type: 'Raster', key: 'progress' })).toBeUndefined()
    await empty.unmount()

    tasks = SNAPSHOT.tasks
    await loadSnapshot($, clock)
    const full = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await full.find({ type: 'Text', text: /Chưa có task nào/ })).toBeUndefined()
    expect(await full.find({ type: 'Raster', key: 'progress' })).toBeDefined()
    await full.unmount()
  })

  test('dock: with the board and the wave map off the dock shows no empty-state line', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await dockRem($, mock.clock(on))
    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Text', text: /Chưa có task nào/ })).toBeUndefined()
    await dock.unmount()
  })

  test('dock: Rem opens 40 columns wide when the board or the wave map is on', { options: { uiBoard: true } }, async ($, on) => {
    const columns: number[] = []
    on('ui.open', ($, e) => {
      columns.push(e.columns ?? 0)
      return { value: { isPlaced: true } }
    })
    const clock = mock.clock(on)

    await dockRem($, clock)
    expect(columns).toEqual([40])
  })

  test('dock: one Rem pane holds the board summary, the wave map and Rem, and the wave map opens no pane of its own', { options: ALL_ON }, async ($, on) => {
    const opened: string[] = []
    answerScripts(on, [], [], opened)
    const clock = mock.clock(on)
    answerWavesRun(on)

    await dockRem($, clock)
    await $.tool.call(wavesRun())
    await clock.advance(10)
    expect(opened).toEqual(['rem'])

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Raster', key: 'progress' })).toBeDefined()
    expect(await dock.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    const headline = await dock.find({ type: 'Text', text: '1/3 closed · 8 risks' })
    expect(headline?.props.wrap).toBe('truncate-end')
    expect(await dock.find({ type: 'Text', text: 'todo 1 · doing 0 · review 1 · done 1' })).toBeDefined()
    expect(await dock.find({ type: 'Button', text: 'wave 2' })).toBeDefined()
    const task = await dock.find({ type: 'Button', text: '● 070 prune-archive' })
    expect(task?.props.plain).toBe(true)
    expect(await dock.find({ type: 'Text', text: /^\.\. \+/ })).toBeUndefined()
    await dock.unmount()

    const inline = await $.ui.mount({ surface: 'terminal', ...pane('rem', 80) })
    expect(await inline.find({ type: 'Raster', key: 'progress' })).toBeUndefined()
    expect(await inline.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await inline.unmount()
  })

  test('dock: a short dock shows a window of the wave map with .. +N marks for the hidden rows', { options: ALL_ON }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    answerWavesRun(on)

    await dockRem($, clock)
    await $.tool.call(wavesRun())
    await clock.advance(10)

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(25) })
    expect(await dock.find({ type: 'Button', text: 'wave 1' })).toBeDefined()
    expect(await dock.find({ type: 'Text', text: '.. +4' })).toBeDefined()
    expect(await dock.find({ type: 'Button', text: 'wave 2' })).toBeUndefined()
    await dock.unmount()
  })

  test('status line: drawn under Rem while docked instead of $.ui.status', { options: { uiStatusLine: true } }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    const lines: (string | undefined)[] = []
    on('ui.status', ($, e) => {
      lines.push(e.text)
      return { value: undefined }
    })
    const STATUS = 'CCF · spec older than code: /ccf:updatespec · CLAUDE.md 7.4/12KB, 40 lines · paid 59.6KB'

    await dockRem($, clock)
    await loadSnapshot($, clock)
    expect(lines.at(-1)).toBeUndefined()

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    const row = await dock.find({ type: 'Text', text: STATUS })
    expect(row?.props.wrap).toBe('truncate-end')
    expect(await dock.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await dock.unmount()
  })

  test('band: drawn under Rem while docked instead of above the prompt', { options: { uiBand: true } }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    const LINE = '070 ●━━●━━◉━━○ in-review · next: /ccf:check'

    await dockRem($, clock)
    await loadSnapshot($, clock)

    const above = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await above.find({ type: 'Text', text: LINE })).toBeUndefined()
    await above.unmount()

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Text', text: LINE })).toBeDefined()
    expect(await dock.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await dock.unmount()
  })

  test('waves tab: pressing a wave row opens pane waves; the pane draws the whole map', { options: ALL_ON }, async ($, on) => {
    const opened: string[] = []
    answerScripts(on, [], [], opened)
    const clock = mock.clock(on)
    answerWavesRun(on)

    await dockRem($, clock)
    await $.tool.call(wavesRun())
    await clock.advance(10)

    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    const row = await dock.find({ key: 'wave-line-1' })
    expect(row?.type).toBe('Button')
    expect(row?.props.plain).toBe(true)
    await dock.press({ key: 'wave-line-1' })
    expect(opened).toEqual(['rem', 'waves'])
    await dock.unmount()

    const tab = await $.ui.mount({ surface: 'terminal', ...wavesPane() })
    expect(await tab.find({ type: 'Text', text: '2 wave · 1 xong · 0 đang chạy · 2 chờ' })).toBeDefined()
    expect(await tab.find({ type: 'Raster', key: 'progress' })).toBeDefined()
    expect(await tab.find({ type: 'Text', text: 'wave 1 · 2 task · 1 xong' })).toBeDefined()
    expect(await tab.find({ type: 'Text', text: 'wave 2 · 1 task · 0 xong' })).toBeDefined()
    expect(await tab.find({ type: 'Text', text: '● 070' })).toBeDefined()
    expect(await tab.find({ type: 'Text', text: 'prune-archive' })).toBeDefined()
    expect(await tab.find({ type: 'Text', text: /^─+$/ })).toBeDefined()
    await tab.unmount()

    const desktop = await $.ui.mount({ surface: 'desktop', ...wavesPane() } as never)
    expect(await desktop.find({ type: 'Text', text: '2 wave' })).toBeDefined()
    await desktop.unmount()
  })

  test('waves tab: with no wave the pane says so', { options: ALL_ON }, async ($, on) => {
    answerScripts(on, [])
    const tab = await $.ui.mount({ surface: 'terminal', ...wavesPane() })
    expect(await tab.find({ type: 'Text', text: 'Chưa có wave nào. Chạy /ccf:cook.' })).toBeDefined()
    await tab.unmount()
  })

  test('waves tab: uiWaves on with no wave yet draws no Button in Rem', { options: ALL_ON }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    await dockRem($, clock)
    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Button' })).toBeUndefined()
    await dock.unmount()
  })

  test('waves tab: uiWaves off draws no Button in Rem even after a plan-waves run', { options: { uiBoard: true } }, async ($, on) => {
    answerScripts(on, [])
    const clock = mock.clock(on)
    answerWavesRun(on)
    await dockRem($, clock)
    await $.tool.call(wavesRun())
    const dock = await $.ui.mount({ surface: 'terminal', ...dockPane(40) })
    expect(await dock.find({ type: 'Button' })).toBeUndefined()
    await dock.unmount()
  })
})
