import type { Aggregate, FilterOp, PlanRef, QueryPlan } from './schema'

const FILTER_WORDS: Record<FilterOp, string> = {
  equals: 'is',
  not_equals: 'is not',
  greater_than: 'is more than',
  at_least: 'is at least',
  less_than: 'is less than',
  at_most: 'is at most',
  contains: 'contains',
  not_contains: "doesn't contain",
  one_of: 'is one of',
  is_missing: 'is blank',
  is_not_missing: 'is filled in',
}

const MEASURE_WORDS: Record<Aggregate, string> = {
  count: 'number of',
  count_distinct: 'number of different',
  sum: 'total',
  average: 'average',
  min: 'lowest or earliest',
  max: 'highest or latest',
}

/**
 * The plan as plain steps, so people can check how an answer was worked out without reading the
 * plan itself. `nameOf` turns dataset keys into display names. Pure.
 */
export function describePlan(plan: QueryPlan, nameOf: (key: string) => string): string[] {
  // Columns are named with their dataset only once several datasets are involved.
  const multi = plan.joins.length > 0
  const col = (r: PlanRef) => (multi ? `${nameOf(r.dataset)} → ${r.column}` : r.column)
  const quote = (v: string) => `“${v}”`

  const steps = [`Start from the rows of ${nameOf(plan.from)}.`]
  for (const j of plan.joins) {
    steps.push(`Match each row to ${nameOf(j.dataset)} where ${col(j.on)} equals its ${j.column}.`)
  }
  for (const f of plan.filters) {
    const values =
      f.op === 'one_of' ? f.values.map(quote).join(', ') : f.values[0] ? quote(f.values[0]) : ''
    steps.push(`Keep rows where ${col(f.column)} ${FILTER_WORDS[f.op]}${values && ` ${values}`}.`)
  }
  if (plan.groupBy.length > 0) {
    const groups = plan.groupBy.map((g) =>
      g.bucket === 'none' ? col(g.column) : `${col(g.column)} (by ${g.bucket})`,
    )
    steps.push(`Group the rows by ${groups.join(', then ')}.`)
  }
  if (plan.measures.length > 0) {
    const measures = plan.measures.map((m) =>
      m.column ? `the ${MEASURE_WORDS[m.fn]} ${col(m.column)}` : 'the number of rows',
    )
    steps.push(
      `${plan.groupBy.length > 0 ? 'For each group, work out' : 'Work out'} ${measures.join(', ')}.`,
    )
  }
  if (plan.select.length > 0) {
    steps.push(`Show ${plan.select.map((s) => col(s.column)).join(', ')}.`)
  }
  for (const s of plan.sort) {
    steps.push(
      `Order by ${s.label}, ${s.direction === 'descending' ? 'highest or latest first' : 'lowest or earliest first'}.`,
    )
  }
  steps.push(`Show up to ${plan.limit.toLocaleString('en-US')} rows.`)
  return steps
}
