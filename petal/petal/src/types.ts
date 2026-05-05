export type Bucket = 'daily' | 'thisWeek' | 'thisMonth' | 'future' | 'backlog'
export type Priority = 1 | 2 | 3 | null

export interface Task {
  id: string
  text: string
  done: boolean
  emoji: string
  category: string | null
  bucket: Bucket
  priority: Priority
  createdAt: number
}

export interface ArchivedTask {
  id: string
  text: string
  emoji: string
  category: string | null
  bucket: Bucket
  priority: Priority
  archivedAt: number
  createdAt: number
}

export interface ProjectStep {
  id: string
  text: string
  done: boolean
  emoji: string
  createdAt: number
}

export interface Project {
  id: string
  name: string
  emoji: string
  description: string
  steps: ProjectStep[]
  createdAt: number
}

export interface AppState {
  tasks: Task[]
  categories: string[]
  projects: Project[]
  archive: ArchivedTask[]
}
