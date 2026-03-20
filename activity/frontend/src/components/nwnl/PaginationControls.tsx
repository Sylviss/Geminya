interface PaginationControlsProps {
    page: number
    pageCount: number
    total: number
    onPageChange: (page: number) => void
    className?: string
}

export default function PaginationControls({
    page,
    pageCount,
    total,
    onPageChange,
    className = '',
}: PaginationControlsProps) {
    if (pageCount <= 1) return null

    return (
        <div className={`flex items-center justify-between gap-4 ${className}`}>
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                ← Previous
            </button>

            <div className="text-sm text-white/70">
                Page <span className="text-white font-semibold">{page}</span> of{' '}
                <span className="text-white font-semibold">{pageCount}</span>
                {total > 0 && (
                    <span className="ml-2 text-white/50">({total} total)</span>
                )}
            </div>

            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next →
            </button>
        </div>
    )
}
