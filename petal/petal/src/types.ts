export type Bucket = 'daily' | 'thisMonth' | 'future' | 'backlog'

export interface Task {
  id: string
  text: string
  done: boolean
  emoji: string
  category: string | null
  bucket: Bucket
  createdAt: number
}

export interface AppState {
  tasks: Task[]
  categories: string[]
}
