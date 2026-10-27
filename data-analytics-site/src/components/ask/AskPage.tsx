import { useId, useState, type FormEvent } from 'react'
import { ArrowUp, Loader2, MessageSquare } from 'lucide-react'
import type { useAsk } from '../../hooks/useAsk'
import type { Dataset } from '../../lib/datasets'
import { ASK_LIMITS } from '../../lib/ask/schema'
import { suggestQuestions } from '../../lib/ask/suggest'
import { quietButton } from '../understanding/styles'
import { AnswerCard } from './AnswerCard'

interface AskPageProps {
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  ask: ReturnType<typeof useAsk>
}

/** "Ask your data": plain-English questions, answered from the open datasets. */
export function AskPage({ datasets, nameOf, ask }: AskPageProps) {
  const inputId = useId()
  const [question, setQuestion] = useState('')

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
        <MessageSquare className="h-10 w-10 text-slate-400" />
        <p>Upload a dataset to start asking questions about it.</p>
      </div>
    )
  }

  const submit = (text: string) => {
    const q = text.trim()
    if (!q) return
    ask.ask(q)
    setQuestion('')
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(question)
  }
  const suggestions =
    ask.entries.length === 0
      ? suggestQuestions(datasets.map((d) => ({ name: nameOf(d), profile: d.profile })))
      : []

  return (
    <div className="space-y-5">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
      >
        <label htmlFor={inputId} className="font-medium text-slate-900">
          What would you like to know?
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={inputId}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(question)
              }
            }}
            maxLength={ASK_LIMITS.maxQuestionLength}
            rows={2}
            placeholder="e.g. Which 5 customers spent the most last year?"
            className="min-h-11 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            aria-label="Ask"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {ask.busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">
          Asking sends your question, dataset names, descriptions, column details and a few example
          values to Claude, which plans how to answer. The answer is worked out in your browser; the
          files themselves never leave it.
        </p>
      </form>

      {ask.entries.length > 0 && (
        <section className="space-y-4" aria-label="Answers">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Answers, newest first</h3>
            <button onClick={ask.clear} className={`${quietButton} text-xs`}>
              Clear
            </button>
          </div>
          {[...ask.entries].reverse().map((entry) => (
            <AnswerCard key={entry.id} entry={entry} onRetry={() => ask.retry(entry.id)} />
          ))}
        </section>
      )}
    </div>
  )
}
