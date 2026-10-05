import { describe, expect, test } from 'claude-code/testing'

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
})
