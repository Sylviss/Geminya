import { useState, useEffect, useRef } from 'react'
import { nwnlAcademyApi } from '../../api/client'

interface WaifuResult {
    waifu_id: number
    name: string
    series: string
    image_url: string | null
    rarity: number
    current_star_level: number
    character_shards: number
    can_upgrade: boolean
    shards_needed_for_upgrade: number
    is_max_star: boolean
    is_awakened: boolean
    elements: string
    archetype: string
    stats_power: number
}

interface SearchState {
    results: WaifuResult[]
    total: number
    page: number
    page_count: number
}

export default function CollectionSearch() {
    const [query, setQuery] = useState('')
    const [data, setData] = useState<SearchState>({ results: [], total: 0, page: 1, page_count: 1 })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searched, setSearched] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load full collection on mount
    useEffect(() => {
        search('', 1)
    }, [])

    const search = async (q: string, page = 1) => {
        setLoading(true)
        setError(null)
        try {
            const params: Record<string, any> = { page, page_size: 12 }
            // Search across both name and series with the same query
            if (q.trim()) {
                params.name = q.trim()
            }

            const { data: res } = await nwnlAcademyApi.searchCollection(params)
            setData(res)
            setSearched(true)
        } catch (err: any) {
            console.error('Search error:', err)
            setError(err?.response?.data?.detail || 'Search failed')
        } finally {
            setLoading(false)
        }
    }

    // Debounced search on query change
    const handleQueryChange = (value: string) => {
        setQuery(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            search(value, 1)
        }, 400)
    }

    const stars = (n: number) => '⭐'.repeat(Math.min(n, 6))

    return (
        <div className="card p-4">
            <h3 className="font-bold text-white/90 mb-3 flex items-center gap-2">
                <span>🔍</span>
                Collection
                {searched && !loading && (
                    <span className="text-xs font-normal text-white/40 ml-auto">{data.total} characters</span>
                )}
            </h3>

            {/* Search input */}
            <div className="relative mb-4">
                <input
                    className="input text-sm w-full pl-9"
                    placeholder="Search by name..."
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔎</span>
            </div>

            {/* Error display */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-28 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : data.results.length ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {data.results.map(w => (
                            <div key={w.waifu_id} className="bg-white/5 rounded-lg p-2.5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/15">
                                <div className="flex items-start justify-between mb-1">
                                    <p className="text-xs font-bold text-white/90 truncate flex-1">
                                        {w.name} {w.is_awakened && '🦋'}
                                    </p>
                                    <span className="text-[10px] ml-1 shrink-0">{stars(w.current_star_level)}</span>
                                </div>
                                <p className="text-[10px] text-white/40 truncate">{w.series}</p>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">{w.elements}</span>
                                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">{w.archetype}</span>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-[10px] text-white/40">{w.character_shards} shards</span>
                                    <span className="text-[10px] font-mono text-amber-300">{w.stats_power}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {data.page_count > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-3">
                            <button
                                onClick={() => search(query, data.page - 1)}
                                disabled={data.page <= 1}
                                className="btn text-xs px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                ← Prev
                            </button>
                            <span className="text-xs text-white/50">{data.page}/{data.page_count}</span>
                            <button
                                onClick={() => search(query, data.page + 1)}
                                disabled={data.page >= data.page_count}
                                className="btn text-xs px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            ) : searched ? (
                <p className="text-center text-white/40 text-sm py-6">
                    {query ? `No results for "${query}"` : 'Your collection is empty'}
                </p>
            ) : null}
        </div>
    )
}
