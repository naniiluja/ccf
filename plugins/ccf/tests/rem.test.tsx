import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import type { Mood } from '../types'
import { SPRITE_COLUMNS, SPRITE_ROWS, encode, pixelsOf } from '../hooks/sprite'

const MOODS: readonly Mood[] = ['idle', 'thinking', 'happy', 'worried', 'sleepy', 'surprised']
const SPACE = 0x20
const DEFAULT_COLOR = 0x01000000
const isBlockElement = (codePoint: number) => codePoint >= 0x2580 && codePoint <= 0x259f

const BAND = {
  plugin: 'ccf',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const paneProps = (placement: 'dock' | 'inline') => ({
  plugin: 'ccf',
  component: 'Pane',
  requestId: 'rem',
  props: {
    title: 'Rem',
    isFocused: false,
    bodyColumns: SPRITE_COLUMNS,
    placement,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}) as const

const runRem = (isFullscreen: boolean) => ({
  command: 'rem',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen, columns: 120 },
}) as const

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

function answerModel(on: On, asked: { model: string; prompt: string; timeoutMs?: number }[], reply: (prompt: string) => string | null) {
  on('model.complete', ($, e) => {
    asked.push({ model: e.model, prompt: e.prompt, timeoutMs: e.timeoutMs })
    const text = reply(e.prompt)
    return { value: text === null ? { isAnswered: false, reason: 'empty-reply', usage: USAGE } : { isAnswered: true, text, usage: USAGE } }
  })
}

function greenRuns(on: On) {
  const run = { count: '5' }
  on('tool.call', () => ({ result: { stdout: `${run.count} pass`, stderr: '', interrupted: false }, text: `${run.count} pass` }))
  return run
}

async function remSays($: Parameters<Parameters<typeof test>[1]>[0], line: RegExp) {
  const ui = await $.ui.mount({ surface: 'desktop', ...BAND })
  const found = await ui.find({ type: 'Text', text: line })
  await ui.unmount()
  return found !== undefined
}

describe('rem-mascot', () => {
  test('mọi ô của Rem là ký tự khối BMP mà Raster nhận, và không ô nào vẽ bằng màu chữ mặc định', async () => {
    expect([SPRITE_COLUMNS, SPRITE_ROWS]).toEqual([19, 15])

    for (const mood of MOODS) {
      const bytes = Uint8Array.from(atob(encode(pixelsOf(mood))), char => char.charCodeAt(0))
      expect(bytes.length).toBe(SPRITE_COLUMNS * SPRITE_ROWS * 12)

      const view = new DataView(bytes.buffer)
      for (let offset = 0; offset < bytes.length; offset += 12) {
        const codePoint = view.getUint32(offset, true)
        const foreground = view.getUint32(offset + 4, true)
        expect(codePoint === SPACE || isBlockElement(codePoint)).toBe(true)
        if (codePoint !== SPACE) expect(foreground).not.toBe(DEFAULT_COLOR)
      }
    }
  })

  test('giao diện classic: Rem pixel nguyên người đứng góc phải phía trên ô chat, kể cả khi build lỗi', async ($, on) => {
    on('tool.call', () => ({
      isError: true,
      result: 'build failed',
      text: 'Program.cs(3,1): error CS1002: ; expected',
    }))

    await $.tool.call({ tool: 'PowerShell', command: 'dotnet build -m:1' })

    const ui = await $.ui.mount({ surface: 'terminal', ...BAND })
    const rem = await ui.find({ type: 'Raster', key: 'rem' })
    expect(rem?.props.rows).toBe(SPRITE_ROWS)
    expect(await ui.find({ type: 'Text', text: /dotnet build lỗi rồi/ })).toBeDefined()
    await ui.unmount()
  })

  test('build xanh thì Rem vui', async ($, on) => {
    on('tool.call', () => ({ result: { stdout: 'Build succeeded.', stderr: '', interrupted: false }, text: 'Build succeeded.' }))

    await $.tool.call({ tool: 'PowerShell', command: 'dotnet test' })

    const ui = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: /dotnet test xanh rồi/ })).toBeDefined()
    await ui.unmount()
  })

  test('/ccf:cook 007: Rem nói đang cook 007, rồi báo kết quả test cụ thể khi xong lượt', async ($, on) => {
    on('prompt.submit', ($, e) => ({ text: e.text }))
    mock.clock(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('ui.toast', () => ({ value: undefined }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('tool.call', () => ({ result: { stdout: 'ℹ pass 12\nℹ fail 0', stderr: '', interrupted: false }, text: 'ℹ pass 12\nℹ fail 0' }))

    await $.prompt.submit({ text: '/ccf:cook 007' } as never)
    await $.turn.start({ turnId: 'turn-1' } as never)
    const started = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await started.find({ type: 'Text', text: /Rem đang cook task 007 đây/ })).toBeDefined()
    await started.unmount()

    await $.tool.call({ tool: 'Bash', command: 'node --test plugins/ccf/hooks/lib/*.test.mjs' })
    const ran = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await ran.find({ type: 'Text', text: /node --test xanh rồi \(12 pass, 0 fail\)/ })).toBeDefined()
    await ran.unmount()

    await $.turn.complete({ answer: '', durationMs: 10, isAborted: false, turnId: 'turn-1', reason: 'answer' } as never)
    const done = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await done.find({ type: 'Text', text: /Rem cook task 007 xong: node --test xanh \(12 pass, 0 fail\)/ })).toBeDefined()
    await done.unmount()
  })

  test('đang chạy test thì Rem nói đang chạy test', async ($, on) => {
    let finish: (value: unknown) => void = () => {}
    let isRunning = false
    on('tool.call', () => new Promise(resolve => {
      isRunning = true
      finish = resolve
    }) as never)

    const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
    while (!isRunning) await new Promise(resolve => setTimeout(resolve, 1))
    const ui = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: /Rem đang chạy test \(npm test\)/ })).toBeDefined()
    await ui.unmount()
    finish({ result: { stdout: '1 pass', stderr: '', interrupted: false }, text: '1 pass' })
    await call
  })

  test('test đỏ thì cuối lượt Rem vẫn lo lắng và nói rõ số test hỏng', async ($, on) => {
    mock.clock(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('tool.call', () => ({ isError: true, result: { stdout: '', stderr: '', interrupted: false }, text: '9 pass\n3 fail' }))

    await $.turn.start({ turnId: 'turn-1' } as never)
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await $.turn.complete({ answer: '', durationMs: 10, isAborted: false, turnId: 'turn-1', reason: 'answer' } as never)

    const ui = await $.ui.mount({ surface: 'desktop', ...BAND })
    expect(await ui.find({ type: 'Text', text: /\(;・△・\) Rem: Xong rồi: npm test lỗi \(9 pass, 3 fail\)/ })).toBeDefined()
    await ui.unmount()
  })

  test('cook spawn agent cho task 012 thì Rem nói đang cook 012, agent xong thì báo task đó xong', async ($, on) => {
    on('agent.spawn', () => ({ model: 'sonnet', agentId: 'agent-012' }))
    on('turn.complete', ($, e) => ({ text: e.answer }))

    await $.agent.spawn({ prompt: 'Task: 012, task file `.claude/plan/task-012-login.md`. Branch: `worktree-ccf-it-012`.', description: 'task 012' } as never)
    const running = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await running.find({ type: 'Text', text: /Rem đang cook task 012\./ })).toBeDefined()
    await running.unmount()

    await $.turn.complete({ answer: '', durationMs: 10, isAborted: false, turnId: 'turn-2', reason: 'answer', agentId: 'agent-012' } as never)
    const done = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await done.find({ type: 'Text', text: /Task 012 xong rồi, cả wave đã báo về/ })).toBeDefined()
    await done.unmount()
  })

  test('dock hay pane inline đều là Rem nguyên người', async $ => {
    for (const placement of ['dock', 'inline'] as const) {
      const ui = await $.ui.mount({ surface: 'terminal', ...paneProps(placement) })
      expect((await ui.find({ type: 'Raster', key: 'rem' }))?.props.rows).toBe(SPRITE_ROWS)
      await ui.unmount()
    }
  })

  test('desktop hiện kaomoji thay cho pixel', async $ => {
    const ui = await $.ui.mount({ surface: 'desktop', ...BAND })
    expect(await ui.find({ type: 'Raster' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\(・ω・\) Rem/ })).toBeDefined()
    await ui.unmount()
  })

  test('fullscreen: /rem đưa Rem vào dock và band phía trên ô chat biến mất', async ($, on) => {
    const opened: number[] = []
    on('ui.open', ($, e) => {
      opened.push(e.columns ?? 0)
      return { value: { isPlaced: true } }
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    const ran = await $.command.run(runRem(true))
    expect(opened).toEqual([SPRITE_COLUMNS])
    expect(ran.text).toMatch(/ra đứng cạnh ô chat/)

    const band = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await band.find({ type: 'Raster' })).toBeUndefined()
    await band.unmount()
  })

  test('classic: /rem bật tắt Rem trên band, không mở pane', async ($, on) => {
    const opened: string[] = []
    on('ui.open', ($, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    expect((await $.command.run(runRem(false))).text).toMatch(/đi nghỉ/)
    const hidden = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await hidden.find({ type: 'Raster' })).toBeUndefined()
    await hidden.unmount()

    expect((await $.command.run(runRem(false))).text).toMatch(/quay lại/)
    const shown = await $.ui.mount({ surface: 'terminal', ...BAND })
    expect(await shown.find({ type: 'Raster', key: 'rem' })).toBeDefined()
    await shown.unmount()

    expect(opened).toEqual([])
  })

  test('AI: câu cố định hiện ngay, câu Haiku thay vào sau debounce', async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string; timeoutMs?: number }[] = []
    answerModel(on, asked, () => 'Yay, npm test 5 pass rồi, Rem vui quá!')
    greenRuns(on)

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    expect(await remSays($, /npm test xanh rồi \(5 pass\)! Rem mừng lắm\./)).toBe(true)
    expect(asked).toEqual([])

    await clock.advance(600)
    expect(asked.length).toBe(1)
    expect(asked[0]?.model).toBe('claude-haiku-4-5')
    expect(asked[0]?.timeoutMs).toBe(8000)
    expect(asked[0]?.prompt).toMatch(/npm test xanh rồi \(5 pass\)/)
    expect(await remSays($, /Yay, npm test 5 pass rồi, Rem vui quá!/)).toBe(true)
  })

  test('AI tắt bằng remAi: false thì không gọi model, giữ câu cố định', { options: { remAi: false } }, async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string }[] = []
    answerModel(on, asked, () => 'Yay, npm test 5 pass rồi!')
    greenRuns(on)

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(10_000)
    expect(asked).toEqual([])
    expect(await remSays($, /npm test xanh rồi \(5 pass\)! Rem mừng lắm\./)).toBe(true)
  })

  test('AI lỗi hoặc câu AI làm mất dữ kiện thì giữ câu cố định', async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string }[] = []
    answerModel(on, asked, prompt => (prompt.includes('7 pass') ? 'Test xanh hết rồi nè!' : null))
    const run = greenRuns(on)

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(600)
    expect(await remSays($, /npm test xanh rồi \(5 pass\)! Rem mừng lắm\./)).toBe(true)

    run.count = '7'
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(600)
    expect(asked.length).toBe(2)
    expect(await remSays($, /npm test xanh rồi \(7 pass\)! Rem mừng lắm\./)).toBe(true)
  })

  test('AI debounce: hai sự kiện liền nhau chỉ hỏi model một lần, cho câu sau', async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string }[] = []
    answerModel(on, asked, () => 'Rem thấy 7 pass rồi nha!')
    const run = greenRuns(on)

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    run.count = '7'
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(600)
    expect(asked.length).toBe(1)
    expect(asked[0]?.prompt).toMatch(/7 pass/)
    expect(await remSays($, /Rem thấy 7 pass rồi nha!/)).toBe(true)
  })

  test('AI cache: cùng sự kiện lần hai hiện câu AI ngay, không hỏi lại', async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string }[] = []
    answerModel(on, asked, () => 'Yay, npm test 5 pass rồi!')
    greenRuns(on)

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(600)
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    expect(await remSays($, /Yay, npm test 5 pass rồi!/)).toBe(true)
    await clock.advance(600)
    expect(asked.length).toBe(1)
  })

  test('AI: cook spawn agent cũng được Haiku nói lại', async ($, on) => {
    const clock = mock.clock(on)
    const asked: { model: string; prompt: string }[] = []
    answerModel(on, asked, () => 'Rem bắt tay cook task 012 đây!')
    on('agent.spawn', () => ({ model: 'sonnet', agentId: 'agent-012' }))

    await $.agent.spawn({ prompt: 'Task: 012, task file `.claude/plan/task-012-login.md`. Branch: `worktree-ccf-it-012`.', description: 'task 012' } as never)
    expect(await remSays($, /Rem đang cook task 012\./)).toBe(true)
    await clock.advance(600)
    expect(asked.length).toBe(1)
    expect(await remSays($, /Rem bắt tay cook task 012 đây!/)).toBe(true)
  })
})
