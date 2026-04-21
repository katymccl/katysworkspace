'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Task, Bucket } from '@/types'
import TaskCard from './TaskCard'

interface Props {
  bucket: Bucket
  tasks: Task[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onEdit: (id: string, text: string) => void
  onMove: (id: string, bucket: Bucket) => void
  showCategory?: boolean
  moveTargets?: Bucket[]
  emptyText?: string
}

export default function DroppableBucket({
  bucket,
  tasks,
  onToggle,
  onRemove,
  onEdit,
  onMove,
  showCategory = false,
  moveTargets = [],
  emptyText = 'drop tasks here',
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket })

  return (
    <div
      ref={setNodeRef}
      className={`drop-zone ${isOver ? 'over' : ''}`}
    >
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.length === 0 ? (
          <div className="empty-drop">{emptyText}</div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onRemove={() => onRemove(task.id)}
              onEdit={(text) => onEdit(task.id, text)}
              onMove={(b) => onMove(task.id, b)}
              showCategory={showCategory}
              moveTargets={moveTargets}
            />
          ))
        )}
      </SortableContext>

      <style jsx>{`
        .drop-zone {
          min-height: 56px;
          border-radius: 14px;
          transition: background 0.15s, box-shadow 0.15s;
          padding: 2px;
        }
        .drop-zone.over {
          background: rgba(244,143,177,0.12);
          box-shadow: inset 0 0 0 2px rgba(244,143,177,0.5);
        }
        .empty-drop {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          border-radius: 12px;
          border: 1.5px dashed rgba(244,143,177,0.35);
          color: #f48fb1;
          font-size: 13px;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
