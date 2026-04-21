'use client'

import { useState } from 'react'
import { Bucket } from '@/types'

interface Props {
  bucket: Bucket
  categories?: string[]
  onAdd: (text: string, category?: string | null) => void
  placeholder?: string
  showCategoryPicker?: boolean
  disabled?: boolean
  disabledMsg?: string
}

export default function AddTaskRow({
  bucket,
  categories = [],
  onAdd,
  placeholder = 'add a task...',
  showCategoryPicker = false,
  disabled = false,
  disabledMsg,
}: Props) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState('')

  const submit = () => {
    if (!text.trim() || disabled) return
    onAdd(text.trim(), showCategoryPicker ? (cat || null) : undefined)
    setText('')
  }

  return (
    <div className="add-row">
      {showCategoryPicker && categories.length > 0 && (
        <select
          className="cat-select"
          value={cat}
          onChange={e => setCat(e.target.value)}
        >
          <option value="">no cat</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
      <input
        className="add-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={disabled ? (disabledMsg ?? placeholder) : placeholder}
        disabled={disabled}
      />
      <button className="add-btn" onClick={submit} disabled={disabled}>+</button>

      <style jsx>{`
        .add-row {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
          align-items: center;
        }
        .cat-select {
          height: 42px;
          border-radius: 12px;
          border: 1.5px solid rgba(244,143,177,0.4);
          background: rgba(255,255,255,0.85);
          padding: 0 8px;
          font-size: 13px;
          color: #880e4f;
          flex-shrink: 0;
          max-width: 110px;
        }
        .add-input {
          flex: 1;
          height: 42px;
          border-radius: 12px;
          border: 1.5px solid rgba(244,143,177,0.4);
          background: rgba(255,255,255,0.85);
          padding: 0 14px;
          font-size: 14px;
          color: #880e4f;
          box-shadow: 0 1px 5px rgba(233,30,140,0.05);
        }
        .add-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .add-btn {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #f48fb1, #e91e8c);
          color: #fff;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(233,30,140,0.3);
          transition: transform 0.15s;
        }
        .add-btn:hover:not(:disabled) { transform: scale(1.08); }
        .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
