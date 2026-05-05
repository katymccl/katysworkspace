'use client'

import { ArchivedTask, Bucket } from '@/types'

const BUCKET_LABEL: Record<Bucket, string> = {
  daily: 'today',
  thisWeek: 'this week',
  thisMonth: 'this month',
  future: 'future',
  backlog: 'brain dump',
}

const PRIORITY_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(233,30,140,0.13)', color: '#c2185b' },
  2: { bg: 'rgba(244,143,177,0.18)', color: '#e91e8c' },
  3: { bg: 'rgba(252,228,236,0.8)', color: '#f48fb1' },
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function daysLeft(archivedAt: number) {
  const elapsed = Date.now() - archivedAt
  const remaining = Math.ceil((10 * 24 * 60 * 60 * 1000 - elapsed) / (1000 * 60 * 60 * 24))
  return Math.max(0, remaining)
}

function groupByDay(items: ArchivedTask[]) {
  const groups = new Map<string, ArchivedTask[]>()
  for (const item of items) {
    const d = new Date(item.archivedAt)
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

interface Props {
  archive: ArchivedTask[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ArchiveView({ archive, onRestore, onDelete, onClose }: Props) {
  const groups = groupByDay(archive)

  return (
    <div className="archive-wrap">
      <div className="archive-header">
        <span className="archive-title">🗂 archive</span>
        <button className="close-btn" onClick={onClose}>× close</button>
      </div>

      {archive.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🌸</div>
          <p>nothing here yet — completed tasks will appear here</p>
        </div>
      ) : (
        <div className="archive-note">tasks are permanently deleted after 10 days</div>
      )}

      {[...groups.entries()].map(([day, tasks]) => (
        <div key={day} className="day-group">
          <div className="day-label">{day}</div>
          {tasks.map(task => {
            const p = task.priority
            const pStyle = p ? PRIORITY_COLORS[p] : null
            const left = daysLeft(task.archivedAt)
            return (
              <div key={task.id} className="archive-card">
                <div className="card-left">
                  <span className="check-done">✓</span>
                  <div className="card-body">
                    <span className="card-text">{task.emoji} {task.text}</span>
                    <div className="card-meta">
                      <span className="meta-bucket">{BUCKET_LABEL[task.bucket]}</span>
                      {task.category && <span className="meta-cat">{task.category}</span>}
                      {p && (
                        <span className="meta-pri" style={pStyle ? { background: pStyle.bg, color: pStyle.color } : undefined}>
                          p{p}
                        </span>
                      )}
                      <span className={`meta-expiry ${left <= 2 ? 'soon' : ''}`}>
                        {left === 0 ? 'deletes today' : `deletes in ${left}d`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-actions">
                  <button className="restore-btn" onClick={() => onRestore(task.id)} title="restore to brain dump">
                    ↩ restore
                  </button>
                  <button className="del-btn" onClick={() => onDelete(task.id)} title="delete now">×</button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <style jsx>{`
        .archive-wrap {
          margin-top: 4px;
          animation: fadeIn 0.2s ease both;
        }
        .archive-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .archive-title {
          font-size: 13px;
          font-weight: 700;
          color: #c2185b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 12px;
          font-weight: 700;
          color: #e91e8c;
          cursor: pointer;
        }
        .archive-note {
          font-size: 11px;
          color: #f4a8c4;
          font-style: italic;
          margin-bottom: 14px;
          text-align: center;
        }
        .empty {
          text-align: center;
          padding: 32px 16px;
          color: #f4a8c4;
          font-size: 13px;
          font-style: italic;
        }
        .empty-icon { font-size: 28px; margin-bottom: 8px; }
        .day-group { margin-bottom: 18px; }
        .day-label {
          font-size: 11px;
          font-weight: 700;
          color: #f4a8c4;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
          padding-left: 2px;
        }
        .archive-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: rgba(255,255,255,0.65);
          border-radius: 12px;
          padding: 9px 12px;
          margin-bottom: 6px;
          border: 1.5px solid rgba(244,143,177,0.18);
          opacity: 0.85;
        }
        .card-left {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .check-done {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff;
          font-size: 10px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .card-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .card-text {
          font-size: 13px;
          color: #ad1457;
          text-decoration: line-through;
          opacity: 0.65;
          word-break: break-word;
        }
        .card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .meta-bucket, .meta-cat {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          background: rgba(244,143,177,0.15);
          color: #e91e8c;
          padding: 1px 6px;
          border-radius: 5px;
        }
        .meta-pri {
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 5px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .meta-expiry {
          font-size: 9px;
          color: #f4a8c4;
          font-style: italic;
        }
        .meta-expiry.soon { color: #e91e8c; font-weight: 700; }
        .card-actions {
          display: flex;
          flex-direction: column;
          gap: 3px;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .restore-btn {
          background: rgba(244,143,177,0.18);
          border: none;
          border-radius: 7px;
          color: #e91e8c;
          font-size: 10px;
          padding: 2px 7px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }
        .restore-btn:hover { background: rgba(244,143,177,0.35); }
        .del-btn {
          background: none;
          border: none;
          color: #f48fb1;
          font-size: 16px;
          padding: 0 1px;
          line-height: 1;
          cursor: pointer;
        }
        .del-btn:hover { color: #e91e8c; }
      `}</style>
    </div>
  )
}
