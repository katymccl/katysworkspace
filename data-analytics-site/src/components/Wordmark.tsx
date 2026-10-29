interface WordmarkProps {
  className?: string
}

/** The "sema." wordmark: lowercase in brand ink with a violet dot. Size it with text-* classes. */
export function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`font-display font-medium tracking-tight text-ink ${className}`}>
      sema<span className="text-violet-500">.</span>
    </span>
  )
}
