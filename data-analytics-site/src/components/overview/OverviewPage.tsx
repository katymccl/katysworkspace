import type { ReactNode } from 'react'
import {
  BookOpen,
  BrushCleaning,
  Check,
  ChartLine,
  LayoutDashboard,
  MessageSquare,
  Upload,
} from 'lucide-react'
import type { Dataset, View } from '../../lib/datasets'
import { primaryButton, quietButton } from '../understanding/styles'

interface OverviewPageProps {
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  /** AI suggestions about a dataset that haven't been accepted or edited yet. */
  pendingOf: (d: Dataset) => number
  /** Whether Claude has interpreted the dataset (its current version) yet. */
  interpretedOf: (d: Dataset) => boolean
  glossaryCount: number
  questionCount: number
  /** Whether "Explore your data" has been opened in this workspace. */
  explored: boolean
  dashboardCount: number
  onGo: (view: View) => void
}

interface Step {
  icon: ReactNode
  title: string
  body: string
  /** What's been done so far: `done` ticks the step; null when there's nothing to count. */
  status: { text: string; done: boolean } | null
  actions: ReactNode
}

/** Most datasets listed under "Prepare my data"; the rest are in the menu. */
const MAX_LISTED = 4

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Overview: the path from a file to answers, as steps that show how far the open workspace
 * has got, with the next one to do picked out and a way into each.
 */
export function OverviewPage({
  datasets,
  nameOf,
  pendingOf,
  interpretedOf,
  glossaryCount,
  questionCount,
  explored,
  dashboardCount,
  onGo,
}: OverviewPageProps) {
  const has = datasets.length > 0
  const pending = datasets.map((d) => ({ d, n: pendingOf(d), interpreted: interpretedOf(d) }))
  const pendingTotal = pending.reduce((sum, p) => sum + p.n, 0)
  const uninterpreted = pending.filter((p) => !p.interpreted).length
  // Datasets still to interpret come first, then those with the most suggestions to review.
  const listed = [...pending]
    .sort((a, b) => Number(a.interpreted) - Number(b.interpreted) || b.n - a.n)
    .slice(0, MAX_LISTED)

  const go = (label: string, view: View, primary = false, disabled = false) => (
    <button
      onClick={() => onGo(view)}
      disabled={disabled}
      className={`${primary ? primaryButton : `${quietButton} border border-slate-200`} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  )

  const steps: Step[] = [
    {
      icon: <Upload className="h-5 w-5" />,
      title: 'Upload a dataset',
      body: 'Add one or more CSV files. Each file becomes a dataset, and Claude suggests what it and its columns mean. No data yet? Generate a realistic sample to try things out.',
      status: has
        ? { text: `${plural(datasets.length, 'dataset')} in this workspace`, done: true }
        : { text: 'No datasets yet', done: false },
      actions: go('Upload datasets', { kind: 'upload' }, !has),
    },
    {
      icon: <BrushCleaning className="h-5 w-5" />,
      title: 'Prepare my data',
      body: 'Open each dataset. Use “Prepare my data” to fix missing values, duplicate rows and values that don’t fit, then “Interpret with AI” to have Claude suggest what the dataset and its columns mean. Accept its suggestions, or edit them in your own words.',
      // Done only once Claude has interpreted every dataset and each suggestion has been reviewed.
      status: !has
        ? null
        : uninterpreted === datasets.length
          ? { text: 'Prepare your data with AI suggestions', done: false }
          : uninterpreted > 0
            ? { text: `${plural(uninterpreted, 'dataset')} not interpreted yet`, done: false }
            : pendingTotal > 0
              ? { text: `${plural(pendingTotal, 'AI suggestion')} to review`, done: false }
              : { text: 'Every suggestion reviewed', done: true },
      actions: has ? (
        <>
          {listed.map(({ d, n, interpreted }) => (
            <button
              key={d.id}
              onClick={() => onGo({ kind: 'dataset', id: d.id })}
              className={`${quietButton} inline-flex max-w-full items-center gap-1.5 border border-slate-200`}
              title={nameOf(d)}
            >
              <span className="max-w-48 truncate">{nameOf(d)}</span>
              {!interpreted ? (
                <span className="shrink-0 text-xs text-amber-700">not interpreted</span>
              ) : (
                n > 0 && <span className="shrink-0 text-xs text-amber-700">{n} to review</span>
              )}
            </button>
          ))}
          {datasets.length > MAX_LISTED && (
            <span className="self-center text-xs text-slate-500">
              and {datasets.length - MAX_LISTED} more in the menu
            </span>
          )}
        </>
      ) : null,
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: 'Add to the glossary',
      body: 'Drag the columns that matter onto “Glossary” to define their meaning once for the whole workspace, with their possible values. Matching columns in other datasets take the same meaning, and Claude uses it too.',
      status: !has
        ? null
        : glossaryCount > 0
          ? { text: `${plural(glossaryCount, 'term')} defined`, done: true }
          : { text: 'No terms yet', done: false },
      actions: go('Open the glossary', { kind: 'glossary' }),
    },
    {
      icon: <ChartLine className="h-5 w-5" />,
      title: 'Explore your data',
      body: 'Pick a question (a trend over time, a comparison between groups, how values spread, or whether two measures move together) and the columns to answer it with. Charts are worked out in your browser; nothing is sent to Claude.',
      status: !has
        ? null
        : explored
          ? { text: 'Explored', done: true }
          : { text: 'Not explored yet', done: false },
      actions: go('Explore your data', { kind: 'explore' }, false, !has),
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: 'Ask with AI',
      body: 'Ask anything in plain English, across all of this workspace’s datasets. Claude works out the answer and shows how, with a table and a chart.',
      status: !has
        ? null
        : questionCount > 0
          ? { text: `${plural(questionCount, 'question')} asked`, done: true }
          : { text: 'No questions yet', done: false },
      actions: go('Ask Claude', { kind: 'ask' }, false, !has),
    },
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      title: 'Save to a dashboard',
      body: 'Keep the charts worth coming back to: use “Save to dashboard” under any chart. A dashboard can mix charts from different datasets, and explored charts stay up to date with the data.',
      status: !has
        ? null
        : dashboardCount > 0
          ? { text: `${plural(dashboardCount, 'dashboard')}`, done: true }
          : { text: 'No dashboards yet', done: false },
      actions: go('Open dashboards', { kind: 'dashboards' }),
    },
  ]
  const next = steps.findIndex((s) => s.status?.done === false)

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const isNext = i === next
        const done = step.status?.done === true
        return (
          <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
            {/* The line joining each step to the next. */}
            {i < steps.length - 1 && (
              <span className="absolute top-11 bottom-0 left-5 w-px bg-slate-200" aria-hidden />
            )}
            <span
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : isNext
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
              aria-hidden
            >
              {done ? <Check className="h-5 w-5" /> : i + 1}
            </span>
            <section
              aria-label={`Step ${i + 1}: ${step.title}`}
              className={`min-w-0 flex-1 space-y-3 rounded-xl border bg-white p-5 ${
                isNext ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-violet-600" aria-hidden>
                  {step.icon}
                </span>
                <h2 className="font-semibold text-slate-900">{step.title}</h2>
                {isNext && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                    Next step
                  </span>
                )}
                {step.status && (
                  <span
                    className={`ml-auto flex items-center gap-1 text-xs ${done ? 'text-emerald-700' : 'text-slate-500'}`}
                  >
                    {done && <Check className="h-3.5 w-3.5" aria-hidden />}
                    {step.status.text}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600">{step.body}</p>
              {step.actions && <div className="flex flex-wrap gap-2">{step.actions}</div>}
            </section>
          </li>
        )
      })}
    </ol>
  )
}
