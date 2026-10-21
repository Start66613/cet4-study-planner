export type Tone = 'blue' | 'mint' | 'lilac' | 'peach'
export type Mode = 30 | 45 | 60 | 90 | 120
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly'
export interface Plan { id: string; title: string; tone: Tone }
export interface Task { id: string; title: string; planId: string; minutes: number; start: string; repeat: Repeat; note: string; end?: string }
export interface Item { id: string; sourceId?: string; title: string; planId: string; minutes: number; note: string; done: boolean; actual: number; context: 'self' | 'class'; cet?: string; removed?: boolean }
export interface Day { date: string; mode: Mode; items: Item[]; note: string }
export interface Course { id: string; day: number; s: string; name: string; weeks: number[]; type: 'theory' | 'digital' | 'lab' | 'activity' | 'practice'; note: string }
export interface Progress { id: string; name: string; chapter: string; completed: number; total: number; next: string; note: string }
export interface Score { id: string; date: string; paper: string; listening: number; reading: number; writing: boolean; translation: boolean; note: string }
export interface Settings { semesterStart: string; examDate: string; theme: 'system' | 'light' | 'dark'; cetEnabled: boolean }
export interface WeekPlan { week: number; start: string; end: string; name: string; desc: string }
export interface State { schemaVersion: 2; settings: Settings; plans: Plan[]; tasks: Task[]; days: Record<string, Day>; courses: Course[]; uncertainNotes: string[]; weekPlan: WeekPlan[]; progress: Progress[]; scores: Score[] }
export interface Backup { app: 'studyflow'; schemaVersion: 2; exportedAt: string; data: State }
