import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ChartLine } from 'lucide-react'
import type { Dataset } from '../../lib/datasets'
import {
  CALCULATIONS,
  QUESTIONS,
  TIME_STEP_LABELS,
  MAX_SCATTER_POINTS,
  DEFAULT_CONFIG,
  answerTitle,
  isEmptyAnswer,
  exploreColumns,
  runExplore,
  type Calculation,
  type ExploreAnswer,
  type ExploreConfig,
  type ExploreQuestion,
  type TimeStep,
} from '../../lib/explore/explore'
import type { NewItem } from '../../lib/dashboards'
import { SaveToDashboard } from '../dashboards/SaveToDashboard'
import { ExploreAnswerBody } from './ExploreCharts'

interface ExplorePageProps {
  datasets: readonly Dataset[]
  nameOf: (d: Dataset) => string
  /** Called once the page has a dataset to explore, so Overview can tick its step. */
  onVisit?: () => void
}

/**
 * "Explore your data": a template question about one dataset (pick what to investigate, then the
 * columns), answered with a chart from every row, in the browser. No AI involved.
 */
export function ExplorePage({ datasets, nameOf, onVisit }: ExplorePageProps) {
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [config, setConfig] = useState<ExploreConfig>(DEFAULT_CONFIG)
  const set = (change: Partial<ExploreConfig>) => setConfig((c) => ({ ...c, ...change }))

  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0]
  const canExplore = dataset !== undefined
  useEffect(() => {
    if (canExplore) onVisit?.()
  }, [canExplore, onVisit])
  const columns = useMemo(
    () => (dataset ? exploreColumns(dataset.rows, dataset.profile) : null),
    [dataset],
  )

  if (!dataset || !columns) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
        <ChartLine className="h-10 w-10 text-slate-400" />
        <p>Upload a dataset to start exploring it.</p>
      </div>
    )
  }

  const { effective, answer, missing } = runExplore(dataset.rows, columns, config)
  const { question, calc: calculation } = effective
  const timeColumn = columns.time.find((t) => t.name === effective.time)
  const timeStep = effective.step
  const groupColumn = effective.group
  const measureColumn = effective.measure
  const secondColumn = effective.second
  const hasMeasures = columns.measures.length > 0
  const secondOptions = columns.measures.filter((m) => m !== measureColumn)
  const setTime = (time: string) => set({ time })
  const setStep = (step: TimeStep) => set({ step })
  const setGroup = (group: string) => set({ group })
  const setCalc = (calc: Calculation) => set({ calc })
  const setMeasure = (measure: string) => set({ measure })
  const setSecond = (second: string) => set({ second })
  const setQuestion = (q: ExploreQuestion) => set({ question: q })

  const measureSelect = (label: string) => (
    <Field label={label}>
      {(id) => (
        <select id={id} value={measureColumn ?? ''} onChange={(e) => setMeasure(e.target.value)} className={field}>
          {columns.measures.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      )}
    </Field>
  )
  const calcFields = (
    <>
      <Field label="Calculate">
        {(id) => (
          <select
            id={id}
            value={calculation}
            onChange={(e) => setCalc(e.target.value as Calculation)}
            disabled={!hasMeasures}
            className={field}
          >
            {CALCULATIONS.filter((c) => hasMeasures || c.value === 'count').map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {calculation !== 'count' && measureSelect(question === 'compare' ? 'Compare which number?' : 'Which number?')}
    </>
  )

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-medium text-slate-900">Explore your own question</h2>
          <p className="text-sm text-slate-600">
            Choose what you want to investigate, and a chart is made from every row of the dataset.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.length > 1 && (
            <Field label="Dataset">
              {(id) => (
                <select id={id} value={dataset.id} onChange={(e) => setDatasetId(e.target.value)} className={field}>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {nameOf(d)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="I want to…">
            {(id) => (
              <select
                id={id}
                value={question}
                onChange={(e) => setQuestion(e.target.value as ExploreQuestion)}
                className={field}
              >
                {QUESTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {!missing && (
          <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {question === 'over-time' && timeColumn && (
              <>
                <Field label="Time column">
                  {(id) => (
                    <select id={id} value={timeColumn.name} onChange={(e) => setTime(e.target.value)} className={field}>
                      {columns.time.map((t) => (
                        <option key={t.name}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Show by">
                  {(id) => (
                    <select
                      id={id}
                      value={timeStep ?? ''}
                      onChange={(e) => setStep(e.target.value as TimeStep)}
                      disabled={timeColumn.steps.length === 1}
                      className={field}
                    >
                      {timeColumn.steps.map((s) => (
                        <option key={s} value={s}>
                          {TIME_STEP_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {calcFields}
              </>
            )}
            {question === 'compare' && (
              <>
                <Field label="Group by">
                  {(id) => (
                    <select id={id} value={groupColumn ?? ''} onChange={(e) => setGroup(e.target.value)} className={field}>
                      {columns.groups.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  )}
                </Field>
                {calcFields}
              </>
            )}
            {question === 'distribution' && measureSelect('Which number?')}
            {question === 'related' && (
              <>
                {measureSelect('First measure')}
                <Field label="Second measure">
                  {(id) => (
                    <select id={id} value={secondColumn ?? ''} onChange={(e) => setSecond(e.target.value)} className={field}>
                      {secondOptions.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </>
            )}
          </div>
        )}
        {question === 'related' && !missing && (
          <p className="text-xs text-slate-500">
            Two measures moving together on a chart doesn’t mean one causes the other. Scatterplots show at
            most {MAX_SCATTER_POINTS.toLocaleString('en-US')} rows.
          </p>
        )}
      </section>

      {missing ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          {missing}
        </p>
      ) : (
        answer && (
          <AnswerView
            answer={answer}
            save={() => ({
              kind: 'explore',
              title: answerTitle(answer),
              datasetId: dataset.id,
              datasetName: nameOf(dataset),
              config: effective,
            })}
          />
        )
      )}
    </div>
  )
}

function AnswerView({ answer, save }: { answer: ExploreAnswer; save: () => NewItem }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-live="polite">
      <ExploreAnswerBody answer={answer} />
      {!isEmptyAnswer(answer) && (
        <div className="flex justify-end">
          <SaveToDashboard item={save} />
        </div>
      )}
    </section>
  )
}

const field =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children(id)}
    </div>
  )
}
