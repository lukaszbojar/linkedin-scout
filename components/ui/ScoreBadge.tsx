interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const colorClass =
    score >= 8
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800'
      : score >= 5
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800'

  const sizeClass =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : size === 'lg'
      ? 'text-base px-3 py-1'
      : 'text-sm px-2.5 py-0.5'

  return (
    <span className={`inline-flex items-center font-bold rounded-full border ${colorClass} ${sizeClass}`}>
      {score}/10
    </span>
  )
}
