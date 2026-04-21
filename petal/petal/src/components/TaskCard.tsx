'use client'

import { useState, useRef, useEffect } from 'react'
import { Task, Bucket } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const BUCKET_LABELS: Record<Bucket, string> = {
  daily: "today's 3",
  backlog: 'brain dump',
  thisMonth: 'this month',
  future: 'future',
}

interface Props {
  task: Task
  onToggle: () => void
  onRemove: () => void
  onEdit: (text: string) => void
  onMove?: (bucket: Bucket) => void
  showCategory?: boolean
  moveTargets?: Bucket[]
  isDragOverlay?: boolean
}

export default function TaskCard({
  task,
  onToggle,
  onRemove,
  onEdit,
  onMove,
  showCategory = false,
  moveTargets = [],
  isDragOverlay = false,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(task.text)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragOverlay })

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = () => {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== task.text) onEdit(trimmed)
    setEditing(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragOverlay ? 'drag-overlay' : ''}`}
    >
      {/* drag handle */}
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        title="drag to move"
      >
        ⠿
      </button>

      {/* checkbox */}
      <button
        className={`check-btn ${task.done ? 'done' : ''}`}
        onClick={onToggle}
        aria-label="toggle done"
      />

      {/* text */}
      <div className="task-body">
        {editing ? (
          <input
            ref={inputRef}
            className="edit-input"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') { setEditVal(task.text); setEditing(false) }
            }}
            onBlur={commitEdit}
          />
        ) : (
          <span
            className={`task-text ${task.done ? 'done' : ''}`}
            onDoubleClick={() => { setEditVal(task.text); setEditing(true) }}
            title="double-click to edit"
          >
            {task.emoji} {task.text}
          </span>
        )}
        {showCategory && task.category && (
          <span className="cat-label">{task.category}</span>
        )}
      </div>

      {/* actions */}
      <div className="task-actions">
        {moveTargets.map(b => (
          <button
            key={b}
            className="move-btn"
            onClick={() => onMove?.(b)}
          >
            → {b === 'daily' ? 'today' : b === 'thisMonth' ? 'this month' : b === 'future' ? 'future' : 'dump'}
          </button>
        ))}
        <button className="remove-btn" onClick={onRemove} aria-label="remove">×</button>
      </div>

      <style jsx>{`
        .task-card {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: rgba(255,255,255,0.82);
          border-radius: 14px;
          padding: 10px 12px;
          margin-bottom: 8px;
          box-shadow: 0 2px 10px rgba(233,30,140,0.07);
          border: 1.5px solid rgba(244,143,177,0.25);
          animation: fadeIn 0.2s ease both;
          user-select: none;
        }
        .drag-overlay {
          box-shadow: 0 8px 24px rgba(233,30,140,0.22);
          border-color: rgba(244,143,177,0.6);
          transform: rotate(1.5deg);
          opacity: 1 !important;
        }
        .drag-handle {
          color: #f48fb1;
          background: none;
          border: none;
          font-size: 14px;
          padding: 2px 2px 0;
          cursor: grab;
          flex-shrink: 0;
          touch-action: none;
          margin-top: 1px;
          opacity: 0.5;
          transition: opacity 0.15s;
        }
        .drag-handle:hover { opacity: 1; }
        .check-btn {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid #f48fb1;
          background: transparent;
          flex-shrink: 0;
          margin-top: 2px;
          transition: background 0.18s;
          position: relative;
        }
        .check-btn.done {
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          border-color: transparent;
        }
        .check-btn.done::after {
          content: '✓';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 10px;
          font-weight: bold;
        }
        .task-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .task-text {
          font-size: 14px;
          color: #880e4f;
          line-height: 1.45;
          word-break: break-word;
          cursor: text;
        }
        .task-text.done {
          text-decoration: line-through;
          opacity: 0.45;
        }
        .edit-input {
          width: 100%;
          border: 1.5px solid rgba(244,143,177,0.5);
          border-radius: 8px;
          background: rgba(255,255,255,0.95);
          padding: 3px 8px;
          font-size: 14px;
          color: #880e4f;
        }
        .cat-label {
          font-size: 10px;
          font-weight: 700;
          color: #e91e8c;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: rgba(244,143,177,0.15);
          padding: 1px 7px;
          border-radius: 6px;
          align-self: flex-start;
        }
        .task-actions {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex-shrink: 0;
          align-items: flex-end;
        }
        .move-btn {
          background: rgba(244,143,177,0.18);
          border: none;
          border-radius: 7px;
          color: #e91e8c;
          font-size: 10px;
          padding: 2px 7px;
          font-weight: 700;
          white-space: nowrap;
        }
        .move-btn:hover { background: rgba(244,143,177,0.35); }
        .remove-btn {
          background: none;
          border: none;
          color: #f48fb1;
          font-size: 17px;
          padding: 0 1px;
          line-height: 1;
        }
        .remove-btn:hover { color: #e91e8c; }
      `}</style>
    </div>
  )
}
