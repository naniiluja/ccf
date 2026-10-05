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

const runCommand = (command: string) => ({
  command,
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
}) as const

const ALL_ON = { uiBand: true, uiBoard: true, uiWaves: true, uiStatusLine: true }

function answerScripts(on: On, ran: string[]) {
  on('process.run', ($, e) => {
    const script = e.argv[1] ?? ''
    ran.push(script)
    const body = script.endsWith('ui-snapshot.mjs') ? SNAPSHOT : script.endsWith('spec-budget.mjs') ? BUDGET : script.endsWith('plan-waves.mjs') ? WAVES : {}
    return { value: { exitCode: 0, stdout: JSON.stringify(body), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: '/project' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
}

const finishTurn = (agentId?: string) => ({ answer: '', durationMs: 10, isAborted: false, turnId: 'turn-1', reason: 'answer', ...(agentId ? { agentId } : {}) }) as const

describe('ccf ui layer', () => {
  test('default config: no CCF script runs, no band line, no board command', async ($, on) => {
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
    await $.command.run(runCommand('ccf-board'))

    for (const surface of ['terminal', 'desktop'] as const) {
      const band = await $.ui.mount({ surface, ...BAND })
      expect(await band.find({ type: 'Text', text: '070 ●━━●━━◉━━○ in-review · next: /ccf:check' })).toBeDefined()
      await band.unmount()
    }
  })

  test('board: four columns, open risks, Raster on terminal and Svg on desktop', { options: { uiBoard: true } }, async ($, on) => {
    answerScripts(on, [])
    expect((await $.command.run(runCommand('ccf-board'))).text).toMatch(/CCF board opened/)

    const terminal = await $.ui.mount({ surface: 'terminal', ...pane('ccf-board', 120) })
    expect(await terminal.find({ type: 'Raster', key: 'progress' })).toBeDefined()
    for (const heading of ['todo (1)', 'in-progress (0)', 'in-review (1)', 'done (1)']) {
      expect(await terminal.find({ type: 'Text', text: heading })).toBeDefined()
    }
    expect(await terminal.find({ type: 'Text', text: /1\/3 closed · 8 open risks in PENDING\.md/ })).toBeDefined()
    await terminal.unmount()

    const desktop = await $.ui.mount({ surface: 'desktop', ...pane('ccf-board', 120) })
    expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
    expect(await desktop.find({ type: 'Svg' })).toBeDefined()
    await desktop.unmount()
  })

  test('board buttons only prefill the prompt, they never submit it', { options: { uiBoard: true } }, async ($, on) => {
    answerScripts(on, [])
    const filled: string[] = []
    const submitted: string[] = []
    on('prompt.fill', ($, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    on('prompt.submit', ($, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    await $.command.run(runCommand('ccf-board'))

    const board = await $.ui.mount({ surface: 'terminal', ...pane('ccf-board', 120) })
    await board.press({ key: 'fill:/ccf:check' })
    await board.unmount()

    expect(filled).toEqual(['/ccf:check'])
    expect(submitted).toEqual([])
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

  test('wave map: /ccf:cook loads plan-waves.mjs and tracks each worktree agent', { options: ALL_ON }, async ($, on) => {
    const ran: string[] = []
    answerScripts(on, ran)
    const clock = mock.clock(on)
    on('prompt.submit', ($, e) => ({ text: e.text }))
    on('agent.spawn', ($, e) => ({ model: 'sonnet', agentId: e.description.includes('070') ? 'agent-070' : 'agent-071' }))

    await $.prompt.submit({ text: '/ccf:cook' } as never)
    await clock.advance(10)
    expect(ran.some(script => script.endsWith('plan-waves.mjs'))).toBe(true)

    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-070-prune-archive.md', description: 'task 070' } as never)
    await $.agent.spawn({ prompt: 'Implement .claude/plan/task-071-memory-audit.md', description: 'task 071' } as never)
    await $.turn.complete(finishTurn('agent-070'))

    const map = await $.ui.mount({ surface: 'terminal', ...pane('ccf-waves', 80) })
    expect(await map.find({ type: 'Text', text: /● 070 prune-archive · done/ })).toBeDefined()
    expect(await map.find({ type: 'Text', text: /◉ 071 memory-audit · running/ })).toBeDefined()
    expect(await map.find({ type: 'Text', text: /○ 072 spec sync · waiting/ })).toBeDefined()
    await map.unmount()
  })

  test('a failing CCF script leaves the engine band and the mascot untouched', { options: ALL_ON }, async ($, on) => {
    on('process.run', () => {
      throw new Error('node missing')
    })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('session.cwd', () => ({ value: '/project' }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    await $.command.run(runCommand('ccf-board'))
    const band = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await band.find({ type: 'Text', text: /next:/ })).toBeUndefined()
    expect(await band.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await band.unmount()

    const board = await $.ui.mount({ surface: 'terminal', ...pane('ccf-board', 120) })
    expect(await board.find({ type: 'Text', text: /PLAN\.md was not found/ })).toBeDefined()
    await board.unmount()
  })
})
