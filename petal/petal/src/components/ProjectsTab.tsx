'use client'

import { useState, useRef, useEffect } from 'react'
import { Project } from '@/types'

interface Props {
  projects: Project[]
  onAdd: (name: string, description: string) => void
  onRemove: (id: string) => void
  onEdit: (id: string, name: string, description: string) => void
  onAddStep: (projectId: string, text: string) => void
  onRemoveStep: (projectId: string, stepId: string) => void
  onToggleStep: (projectId: string, stepId: string) => void
  onEditStep: (projectId: string, stepId: string, text: string) => void
}

export default function ProjectsTab({
  projects,
  onAdd,
  onRemove,
  onEdit,
  onAddStep,
  onRemoveStep,
  onToggleStep,
  onEditStep,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [stepInput, setStepInput] = useState('')
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingStepText, setEditingStepText] = useState('')
  const [editingProject, setEditingProject] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const stepInputRef = useRef<HTMLInputElement>(null)

  const activeProject = projects.find(p => p.id === activeId)

  useEffect(() => {
    if (activeId && stepInputRef.current) stepInputRef.current.focus()
  }, [activeId])

  function submitNew() {
    if (!newName.trim()) return
    onAdd(newName, newDesc)
    setNewName('')
    setNewDesc('')
    setShowNew(false)
  }

  function submitStep() {
    if (!stepInput.trim() || !activeId) return
    onAddStep(activeId, stepInput)
    setStepInput('')
  }

  function startEditProject(p: Project) {
    setEditName(p.name)
    setEditDesc(p.description)
    setEditingProject(true)
  }

  function saveEditProject() {
    if (!activeId || !editName.trim()) return
    onEdit(activeId, editName, editDesc)
    setEditingProject(false)
  }

  function startEditStep(stepId: string, text: string) {
    setEditingStepId(stepId)
    setEditingStepText(text)
  }

  function saveEditStep() {
    if (!activeId || !editingStepId || !editingStepText.trim()) {
      setEditingStepId(null)
      return
    }
    onEditStep(activeId, editingStepId, editingStepText)
    setEditingStepId(null)
  }

  // ── PROJECT LIST VIEW ──
  if (!activeId) {
    return (
      <div>
        <p className="hint">big goals broken into little steps 🌸</p>

        {/* new project form */}
        {showNew ? (
          <div className="new-project-form">
            <input
              autoFocus
              className="form-input"
              placeholder="project name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNew()}
            />
            <input
              className="form-input"
              placeholder="short description (optional)..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNew()}
            />
            <div className="form-actions">
              <button className="btn-primary" onClick={submitNew}>create project</button>
              <button className="btn-ghost" onClick={() => { setShowNew(false); setNewName(''); setNewDesc('') }}>cancel</button>
            </div>
          </div>
        ) : (
          <button className="new-project-btn" onClick={() => setShowNew(true)}>
            + new project
          </button>
        )}

        {/* project cards */}
        {projects.length === 0 && !showNew && (
          <div className="empty">no projects yet — create one above 🌷</div>
        )}

        <div className="project-grid">
          {projects.map(p => {
            const done = p.steps.filter(s => s.done).length
            const total = p.steps.length
            const pct = total ? Math.round((done / total) * 100) : 0
            return (
              <div key={p.id} className="project-card" onClick={() => setActiveId(p.id)}>
                <div className="project-card-top">
                  <span className="project-emoji">{p.emoji}</span>
                  <button
                    className="project-del"
                    onClick={e => { e.stopPropagation(); onRemove(p.id) }}
                    aria-label="delete project"
                  >×</button>
                </div>
                <div className="project-name">{p.name}</div>
                {p.description && <div className="project-desc">{p.description}</div>}
                <div className="project-meta">{done}/{total} steps done</div>
                {total > 0 && (
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <style jsx>{`
          .hint { font-size: 13px; color: #ad1457; font-style: italic; text-align: center; margin-bottom: 16px; }
          .new-project-btn {
            display: block; width: 100%;
            padding: 12px;
            border-radius: 14px;
            border: 1.5px dashed rgba(244,143,177,0.5);
            background: rgba(255,255,255,0.5);
            color: #e91e8c; font-size: 14px; font-weight: 700;
            margin-bottom: 18px;
            transition: background 0.15s;
          }
          .new-project-btn:hover { background: rgba(255,255,255,0.75); }
          .new-project-form {
            background: rgba(255,255,255,0.75);
            border-radius: 16px; padding: 16px;
            border: 1.5px solid rgba(244,143,177,0.3);
            margin-bottom: 18px;
            display: flex; flex-direction: column; gap: 10px;
          }
          .form-input {
            height: 42px; border-radius: 12px;
            border: 1.5px solid rgba(244,143,177,0.4);
            background: rgba(255,255,255,0.9);
            padding: 0 14px; font-size: 14px; color: #880e4f;
          }
          .form-input::placeholder { color: #f48fb1; }
          .form-actions { display: flex; gap: 8px; }
          .btn-primary {
            padding: 8px 18px; border-radius: 10px; border: none;
            background: linear-gradient(135deg, #f48fb1, #e91e8c);
            color: #fff; font-size: 13px; font-weight: 700;
            box-shadow: 0 2px 8px rgba(233,30,140,0.25);
          }
          .btn-ghost {
            padding: 8px 14px; border-radius: 10px; border: none;
            background: rgba(244,143,177,0.15);
            color: #c2185b; font-size: 13px; font-weight: 600;
          }
          .empty { text-align: center; padding: 32px 0; color: #f48fb1; font-size: 13px; font-style: italic; }
          .project-grid { display: flex; flex-direction: column; gap: 10px; }
          .project-card {
            background: rgba(255,255,255,0.78);
            border-radius: 18px; padding: 16px 18px;
            border: 1.5px solid rgba(244,143,177,0.28);
            box-shadow: 0 2px 12px rgba(233,30,140,0.07);
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
            animation: fadeIn 0.2s ease both;
          }
          .project-card:hover { transform: translateY(-2px); box-shadow: 0 4px 18px rgba(233,30,140,0.12); }
          .project-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          .project-emoji { font-size: 28px; }
          .project-del {
            background: none; border: none;
            color: #f48fb1; font-size: 20px; line-height: 1;
            padding: 0 2px;
          }
          .project-del:hover { color: #e91e8c; }
          .project-name { font-size: 16px; font-weight: 700; color: #c2185b; margin-bottom: 3px; }
          .project-desc { font-size: 13px; color: #ad1457; opacity: 0.75; margin-bottom: 8px; font-style: italic; }
          .project-meta { font-size: 11px; color: #ad1457; opacity: 0.6; margin-bottom: 6px; }
          .progress-track {
            height: 5px; border-radius: 4px;
            background: rgba(244,143,177,0.22); overflow: hidden;
          }
          .progress-fill {
            height: 100%; border-radius: 4px;
            background: linear-gradient(90deg, #f48fb1, #e91e8c);
            transition: width 0.4s;
          }
        `}</style>
      </div>
    )
  }

  // ── PROJECT DETAIL VIEW ──
  if (!activeProject) { setActiveId(null); return null }

  const done = activeProject.steps.filter(s => s.done).length
  const total = activeProject.steps.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div>
      {/* back */}
      <button className="back-btn" onClick={() => { setActiveId(null); setEditingProject(false) }}>
        ← all projects
      </button>

      {/* project header */}
      {editingProject ? (
        <div className="edit-project-form">
          <input
            autoFocus
            className="form-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveEditProject()}
          />
          <input
            className="form-input"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveEditProject()}
            placeholder="description..."
          />
          <div className="form-actions">
            <button className="btn-primary" onClick={saveEditProject}>save</button>
            <button className="btn-ghost" onClick={() => setEditingProject(false)}>cancel</button>
          </div>
        </div>
      ) : (
        <div className="project-detail-header">
          <div className="detail-top">
            <span className="detail-emoji">{activeProject.emoji}</span>
            <button className="edit-btn" onClick={() => startEditProject(activeProject)}>edit</button>
          </div>
          <h2 className="detail-name">{activeProject.name}</h2>
          {activeProject.description && <p className="detail-desc">{activeProject.description}</p>}
          <p className="detail-meta">{done}/{total} steps done{total > 0 ? ` · ${pct}%` : ''}</p>
          {total > 0 && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* add step */}
      <div className="step-add-row">
        <input
          ref={stepInputRef}
          className="step-input"
          placeholder="add a step..."
          value={stepInput}
          onChange={e => setStepInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitStep()}
        />
        <button className="add-btn" onClick={submitStep}>+</button>
      </div>

      {/* steps list */}
      {activeProject.steps.length === 0 && (
        <div className="empty">add your first step above 🌸</div>
      )}

      <div className="steps-list">
        {activeProject.steps.map((step, i) => (
          <div key={step.id} className="step-card" style={{ animationDelay: `${i * 0.04}s` }}>
            <button
              className={`step-check ${step.done ? 'done' : ''}`}
              onClick={() => onToggleStep(activeProject.id, step.id)}
            />
            <div className="step-body">
              {editingStepId === step.id ? (
                <input
                  autoFocus
                  className="step-edit-input"
                  value={editingStepText}
                  onChange={e => setEditingStepText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditStep(); if (e.key === 'Escape') setEditingStepId(null) }}
                  onBlur={saveEditStep}
                />
              ) : (
                <span
                  className={`step-text ${step.done ? 'done' : ''}`}
                  onDoubleClick={() => startEditStep(step.id, step.text)}
                  title="double-click to edit"
                >
                  {step.emoji} {step.text}
                </span>
              )}
            </div>
            <button
              className="step-del"
              onClick={() => onRemoveStep(activeProject.id, step.id)}
            >×</button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .back-btn {
          background: none; border: none;
          color: #e91e8c; font-size: 13px; font-weight: 600;
          font-style: italic; padding: 0; margin-bottom: 14px;
        }
        .back-btn:hover { opacity: 0.7; }
        .edit-project-form {
          background: rgba(255,255,255,0.75);
          border-radius: 16px; padding: 14px;
          border: 1.5px solid rgba(244,143,177,0.3);
          margin-bottom: 16px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .form-input {
          height: 42px; border-radius: 12px;
          border: 1.5px solid rgba(244,143,177,0.4);
          background: rgba(255,255,255,0.9);
          padding: 0 14px; font-size: 14px; color: #880e4f;
        }
        .form-input::placeholder { color: #f48fb1; }
        .form-actions { display: flex; gap: 8px; }
        .btn-primary {
          padding: 7px 16px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff; font-size: 13px; font-weight: 700;
        }
        .btn-ghost {
          padding: 7px 14px; border-radius: 10px; border: none;
          background: rgba(244,143,177,0.15);
          color: #c2185b; font-size: 13px; font-weight: 600;
        }
        .project-detail-header {
          background: rgba(255,255,255,0.72);
          border-radius: 18px; padding: 16px 18px;
          border: 1.5px solid rgba(244,143,177,0.25);
          margin-bottom: 16px;
        }
        .detail-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .detail-emoji { font-size: 32px; }
        .edit-btn {
          background: rgba(244,143,177,0.18); border: none;
          border-radius: 8px; color: #e91e8c;
          font-size: 12px; font-weight: 700; padding: 3px 10px;
        }
        .detail-name { font-size: 20px; font-weight: 700; color: #c2185b; margin-bottom: 4px; }
        .detail-desc { font-size: 13px; color: #ad1457; font-style: italic; opacity: 0.8; margin-bottom: 8px; }
        .detail-meta { font-size: 12px; color: #ad1457; opacity: 0.65; margin-bottom: 8px; }
        .progress-track {
          height: 6px; border-radius: 4px;
          background: rgba(244,143,177,0.22); overflow: hidden;
        }
        .progress-fill {
          height: 100%; border-radius: 4px;
          background: linear-gradient(90deg, #f48fb1, #e91e8c);
          transition: width 0.4s;
        }
        .step-add-row {
          display: flex; gap: 8px; margin-bottom: 14px;
        }
        .step-input {
          flex: 1; height: 42px; border-radius: 12px;
          border: 1.5px solid rgba(244,143,177,0.4);
          background: rgba(255,255,255,0.85);
          padding: 0 14px; font-size: 14px; color: #880e4f;
          box-shadow: 0 1px 5px rgba(233,30,140,0.05);
        }
        .step-input::placeholder { color: #f48fb1; }
        .add-btn {
          width: 42px; height: 42px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff; font-size: 22px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(233,30,140,0.3);
          transition: transform 0.15s;
        }
        .add-btn:hover { transform: scale(1.08); }
        .empty { text-align: center; padding: 28px 0; color: #f48fb1; font-size: 13px; font-style: italic; }
        .steps-list { display: flex; flex-direction: column; gap: 8px; }
        .step-card {
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.78);
          border-radius: 14px; padding: 11px 14px;
          border: 1.5px solid rgba(244,143,177,0.22);
          box-shadow: 0 1px 6px rgba(233,30,140,0.06);
          animation: fadeIn 0.2s ease both;
        }
        .step-check {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid #f48fb1; background: transparent;
          flex-shrink: 0; position: relative;
          transition: background 0.18s;
        }
        .step-check.done {
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          border-color: transparent;
        }
        .step-check.done::after {
          content: '✓';
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 10px; font-weight: bold;
        }
        .step-body { flex: 1; min-width: 0; }
        .step-text {
          font-size: 14px; color: #880e4f; line-height: 1.45;
          word-break: break-word; cursor: text;
        }
        .step-text.done { text-decoration: line-through; opacity: 0.45; }
        .step-edit-input {
          width: 100%; border: 1.5px solid rgba(244,143,177,0.5);
          border-radius: 8px; background: rgba(255,255,255,0.95);
          padding: 3px 8px; font-size: 14px; color: #880e4f;
        }
        .step-del {
          background: none; border: none;
          color: #f48fb1; font-size: 18px; padding: 0 2px; line-height: 1;
          flex-shrink: 0;
        }
        .step-del:hover { color: #e91e8c; }
      `}</style>
    </div>
  )
}
