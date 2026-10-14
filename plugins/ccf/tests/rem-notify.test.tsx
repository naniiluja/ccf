import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

type Notice = { text: string; title?: string }

function collectNotices(on: On, answer: () => unknown = () => ({ value: { isSent: true, channel: 'kitty' } })) {
  const notices: Notice[] = []
  on('ui.notify', ($, e) => {
    notices.push({ text: e.text, title: e.title })
    return answer() as never
  })
  return notices
}

function quietEngine(on: On, toasts: string[] = []) {
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  return toasts
}

const finishTurn = (durationMs: number, extra: Record<string, unknown> = {}) =>
  ({ answer: '', durationMs, isAborted: false, turnId: 'turn-1', reason: 'answer', ...extra }) as never

const cookBrief = (taskId: string) =>
  ({ prompt: `Task: ${taskId}, task file \`.claude/plan/task-${taskId}-x.md\`. Branch: \`worktree-ccf-it-${taskId}\`.`, description: `task ${taskId}` }) as never

describe('rem native notify', () => {
  test('a long turn raises one native notification titled CCF', async ($, on) => {
    const clock = mock.clock(on)
    quietEngine(on)
    const notices = collectNotices(on)

    await $.turn.complete(finishTurn(45_000))
    await clock.advance(10)

    expect(notices).toEqual([{ text: 'Rem làm xong rồi (45s)', title: 'CCF' }])
  })

  test('a short turn, an aborted turn and a subagent turn stay silent', async ($, on) => {
    const clock = mock.clock(on)
    quietEngine(on)
    const notices = collectNotices(on)

    await $.turn.complete(finishTurn(29_000))
    await $.turn.complete(finishTurn(30_000))
    await $.turn.complete(finishTurn(90_000, { isAborted: true, reason: 'aborted' }))
    await $.turn.complete(finishTurn(90_000, { agentId: 'agent-x' }))
    await clock.advance(10)

    expect(notices).toEqual([])
  })

  test('a long turn that ends in an error says so', async ($, on) => {
    const clock = mock.clock(on)
    quietEngine(on)
    const notices = collectNotices(on)

    await $.turn.complete(finishTurn(40_000, { reason: 'error' }))
    await clock.advance(10)

    expect(notices.map(notice => notice.text)).toEqual(['Lượt chạy dừng vì trục trặc (40s)'])
  })

  test('back-to-back long turns notify once until the cooldown passes', async ($, on) => {
    const clock = mock.clock(on)
    quietEngine(on)
    const notices = collectNotices(on)

    await $.turn.complete(finishTurn(35_000))
    await clock.advance(10)
    await $.turn.complete(finishTurn(35_000))
    await clock.advance(10)
    expect(notices.length).toBe(1)

    await clock.advance(60_000)
    await $.turn.complete(finishTurn(35_000))
    await clock.advance(10)
    expect(notices.length).toBe(2)
  })

  test('cook: notify only when the last agent of the wave reports back', async ($, on) => {
    const clock = mock.clock(on)
    quietEngine(on)
    const notices = collectNotices(on)
    let spawned = 0
    on('agent.spawn', () => ({ model: 'sonnet', agentId: `agent-${++spawned}` }))

    await $.agent.spawn(cookBrief('012'))
    await $.agent.spawn(cookBrief('013'))

    await $.turn.complete(finishTurn(10, { agentId: 'agent-1' }))
    await clock.advance(10)
    expect(notices).toEqual([])

    await $.turn.complete(finishTurn(10, { agentId: 'agent-2' }))
    await clock.advance(10)
    expect(notices).toEqual([{ text: 'Task 013 xong rồi, cả wave đã báo về.', title: 'CCF' }])
  })

  test('a refused or failing notify never breaks the turn', async ($, on) => {
    const clock = mock.clock(on)
    const toasts = quietEngine(on)
    collectNotices(on, () => {
      throw new Error('write failed')
    })

    const ended = await $.turn.complete(finishTurn(45_000))
    await clock.advance(10)

    expect(ended).toBeDefined()
    expect(toasts).toEqual(['Rem làm xong rồi (45s)'])
  })
})
