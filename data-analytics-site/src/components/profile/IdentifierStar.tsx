import { Star } from 'lucide-react'

interface IdentifierStarProps {
  className?: string
  /** Read out and shown on hover; defaults to "Potential identifier". */
  label?: string
}

export function IdentifierStar({
  className = 'h-3.5 w-3.5',
  label = 'Potential identifier',
}: IdentifierStarProps) {
  return (
    <Star
      className={`shrink-0 fill-violet-500 text-violet-500 ${className}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
    </Star>
  )
}
