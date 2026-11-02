import { describe, expect, it } from 'vitest'
import { ASK_LIMITS, reconcilePlan, type AskAnswer, type AskRequest } from './schema'

const dataset = (key: string, columns: string[]) => ({
  key,
  name: key,
  fileName: `${key}.csv`,
  rowCount: 3,
  columns: columns.map((name) => ({
    name,
    type: 'string' as const,
    distinctCount: 3,
    examples: [],
  })),
})
const request: AskRequest = {
  question: 'q',
  datasets: [dataset('a', ['id', 'x']), dataset('b', ['id', 'y']), dataset('c', ['z'])],
  links: [],
}
const ref = (dataset: string, column: string) => ({ dataset, column })

const answer = (
  plan: Partial<AskAnswer['plan']>,
  chart: AskAnswer['chart'] = { type: 'none', x: '', y: '', by: '' },
): AskAnswer => ({
  answerable: true,
  message: ' Shows things. ',
  plan: {
    from: 'a',
    joins: [],
    filters: [],
    groupBy: [],
    measures: [],
    select: [],
    sort: [],
    limit: 0,
    ...plan,
  },
  chart,
})

describe('reconcilePlan', () => {
  it('keeps a valid plan, trimming text and applying the default limit', () => {
    const out = reconcilePlan(
      answer({ measures: [{ fn: 'count', column: null, label: 'Rows' }] }),
      request,
    )
    expect(out.message).toBe('Shows things.')
    expect(out.plan.limit).toBe(ASK_LIMITS.defaultResultRows)
    expect(out.plan.measures).toHaveLength(1)
  })

  it('only allows columns of datasets brought in by a join', () => {
    const out = reconcilePlan(
      answer({
        joins: [
          { dataset: 'b', on: ref('a', 'id'), column: 'id' },
          // c can't be matched on a column it doesn't have.
          { dataset: 'c', on: ref('b', 'y'), column: 'missing' },
        ],
        select: [
          { column: ref('b', 'y'), label: 'Y' },
          { column: ref('c', 'z'), label: 'Z' },
        ],
      }),
      request,
    )
    expect(out.plan.joins.map((j) => j.dataset)).toEqual(['b'])
    expect(out.plan.select.map((s) => s.label)).toEqual(['Y'])
  })

  it('makes labels unique, drops sorts on unknown headings and clears unknown chart headings', () => {
    const out = reconcilePlan(
      answer(
        {
          groupBy: [{ column: ref('a', 'x'), bucket: 'none', label: 'X' }],
          measures: [
            { fn: 'count', column: null, label: 'X' },
            { fn: 'sum', column: null, label: 'Needs a column' },
          ],
          select: [{ column: ref('a', 'id'), label: 'ignored when totalling' }],
          sort: [
            { label: 'X (2)', direction: 'descending' },
            { label: 'Nope', direction: 'ascending' },
          ],
          limit: 5000,
        },
        { type: 'bar', x: 'X', y: 'Missing', by: 'Nope' },
      ),
      request,
    )
    expect(out.plan.measures.map((m) => m.label)).toEqual(['X (2)'])
    expect(out.plan.select).toEqual([])
    expect(out.plan.sort).toEqual([{ label: 'X (2)', direction: 'descending' }])
    expect(out.plan.limit).toBe(ASK_LIMITS.maxResultRows)
    // The chart is kept; a heading that isn't in the result is cleared for the browser to fill.
    expect(out.chart).toEqual({ type: 'bar', x: 'X', y: '', by: '' })
  })

  it('keeps one value per filter except one_of, and drops filters with no value', () => {
    const out = reconcilePlan(
      answer({
        filters: [
          { column: ref('a', 'x'), op: 'equals', values: ['1', '2'] },
          { column: ref('a', 'x'), op: 'one_of', values: ['1', '2'] },
          { column: ref('a', 'x'), op: 'contains', values: [] },
          { column: ref('a', 'x'), op: 'is_missing', values: [] },
        ],
        select: [{ column: ref('a', 'x'), label: 'X' }],
      }),
      request,
    )
    expect(out.plan.filters.map((f) => [f.op, f.values])).toEqual([
      ['equals', ['1']],
      ['one_of', ['1', '2']],
      ['is_missing', []],
    ])
  })

  it('turns plans with nothing to run, or about unknown datasets, into unanswerable ones', () => {
    expect(reconcilePlan(answer({}), request).answerable).toBe(false)
    expect(
      reconcilePlan(
        answer({ from: 'zzz', select: [{ column: ref('zzz', 'x'), label: 'X' }] }),
        request,
      ),
    ).toMatchObject({
      answerable: false,
      message: 'Shows things.',
      plan: { from: 'a', select: [] },
    })
    const declined = reconcilePlan({ ...answer({}), answerable: false, message: '' }, request)
    expect(declined.message).toBe("These datasets can't answer that question.")
  })
})
