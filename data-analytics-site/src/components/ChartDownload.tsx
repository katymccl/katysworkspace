import { useState, type RefObject } from 'react'
import { Download, Loader2 } from 'lucide-react'

/** Marks parts of a chart (such as this button) to leave out of the downloaded image. */
const EXPORT_HIDE = { 'data-export-hide': '' }

/** A file name from a chart's title: `Total Books Read by Month` → `total-books-read-by-month.png`. */
function imageName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${slug || 'chart'}.png`
}

/** What drawn chart parts take from the page's stylesheet, which the image doesn't carry. */
const SVG_STYLES = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'font-family', 'font-weight'] as const

/**
 * Copies each drawn (SVG) part's colours and text sizes onto it, so the image matches the screen;
 * returns a function that puts the original styles back.
 */
function inlineSvgStyles(root: HTMLElement): () => void {
  const saved: [Element, string | null][] = []
  for (const el of root.querySelectorAll<SVGElement>('svg *')) {
    saved.push([el, el.getAttribute('style')])
    const computed = getComputedStyle(el)
    for (const prop of SVG_STYLES) el.style.setProperty(prop, computed.getPropertyValue(prop))
  }
  return () => {
    for (const [el, style] of saved) {
      if (style === null) el.removeAttribute('style')
      else el.setAttribute('style', style)
    }
  }
}

/**
 * "Download PNG": saves the chart as it looks on screen, at twice the size for sharpness, on white.
 * The image library loads only when asked for.
 */
export function ChartDownload({ target, title }: { target: RefObject<HTMLElement | null>; title: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const download = async () => {
    const node = target.current
    if (!node || busy) return
    setBusy(true)
    setFailed(false)
    const restore = inlineSvgStyles(node)
    try {
      const { toPng } = await import('html-to-image')
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (n) => !(n instanceof HTMLElement && n.dataset.exportHide !== undefined),
      })
      const link = document.createElement('a')
      link.href = url
      link.download = imageName(title)
      link.click()
    } catch {
      setFailed(true)
    } finally {
      restore()
      setBusy(false)
    }
  }

  return (
    <span {...EXPORT_HIDE} className="flex shrink-0 items-center gap-2">
      {failed && <span className="text-xs text-red-700">Couldn’t make the image.</span>}
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        aria-label={`Download “${title}” as a PNG image`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden />
        )}
        PNG
      </button>
    </span>
  )
}
