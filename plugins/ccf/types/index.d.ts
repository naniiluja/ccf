export type Mood = 'idle' | 'thinking' | 'happy' | 'worried' | 'sleepy' | 'surprised'

export type Feeling = { mood: Mood; line: string }

export type CcfColumn = 'todo' | 'in-progress' | 'in-review' | 'done'

export type CcfTask = { id: string; title: string; status: string; column: CcfColumn }

export type CcfSnapshot = { ok: true; active: CcfTask | null; tasks: CcfTask[]; openRisks: number; specStale: boolean }

export type CcfBudget = { bytes: number; lines: number; total: number; isOver: boolean; maxBytes: number; maxLines: number }

export type CcfWaveTask = { id: string; title: string; taskFile: string | null; worktree: string | null; branch: string | null }

export type CcfAgent = { agentId: string; taskId: string; isDone: boolean }

export type CcfWavesSource = { dir: string; tasks: string | null }

declare module 'claude-code' {
  interface PluginState {
    ccf: {
      feeling: Feeling
      isDismissed: boolean
      isDocked: boolean
      snapshot: CcfSnapshot | null
      budget: CcfBudget | null
      statusLine: string | null
      waves: CcfWaveTask[][]
      agents: CcfAgent[]
      wavesSource: CcfWavesSource | null
      hasNoticedWavesOff: boolean
      wavesOffset: number
    }
  }
}
