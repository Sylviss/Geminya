import { useCallback, useEffect, useState } from 'react'
import { nwnlDatabaseApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'

interface SeriesItem {
    series_id: number
    name: string
    english_name?: string | null
    image_link?: string | null
    genres_list?: string[]
    members?: number | null
    score?: number | null
}

interface CharacterItem {
    waifu_id: number
    name: string
    series: string
    image_url?: string | null
    rarity: number
}

interface SeriesPage {
    items: SeriesItem[]
    total: number
    page: number
    page_count: number
}

export default function Database() {
    const [seriesPage, setSeriesPage] = useState<SeriesPage>({ items: [], total: 0, page: 1, page_count: 1 })
    const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null)
    const [selectedCharacters, setSelectedCharacters] = useState<CharacterItem[]>([])
    const [search, setSearch] = useState('')
    const [searchSeries, setSearchSeries] = useState<SeriesItem[]>([])
    const [searchCharacters, setSearchCharacters] = useState<CharacterItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadPage = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const { data } = await nwnlDatabaseApi.list({ page, page_size: 16 })
            setSeriesPage(data)
            setError(null)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to load database')
        } finally {
            setLoading(false)
        }
    }, [])

    const loadSeriesDetail = useCallback(async (seriesId: number) => {
        try {
            const { data } = await nwnlDatabaseApi.series(seriesId)
            setSelectedSeries(data.series)
            setSelectedCharacters(data.characters)
        } catch {
            setSelectedSeries(null)
            setSelectedCharacters([])
        }
    }, [])

    const runSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchSeries([])
            setSearchCharacters([])
            return
        }
        try {
            const { data } = await nwnlDatabaseApi.search(query.trim(), 20)
            setSearchSeries(data.series ?? [])
            setSearchCharacters(data.characters ?? [])
        } catch {
            setSearchSeries([])
            setSearchCharacters([])
        }
    }, [])

    useEffect(() => { loadPage(1) }, [loadPage])

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold gradient-text from-emerald-300 to-teal-400">🗂️ NWNL Database</h1>
                <span className="text-xs text-white/50">{seriesPage.total.toLocaleString()} series</span>
            </div>

            <div className="card p-3">
                <input
                    className="input text-sm"
                    placeholder="Search series or character name..."
                    value={search}
                    onChange={(e) => {
                        const value = e.target.value
                        setSearch(value)
                        void runSearch(value)
                    }}
                />
            </div>

            {error && <div className="card p-3 text-red-300 text-sm">{error}</div>}

            {(searchSeries.length > 0 || searchCharacters.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="card p-3">
                        <p className="text-sm font-semibold text-white/70 mb-2">Series Results</p>
                        <div className="space-y-2 max-h-80 overflow-auto">
                            {searchSeries.map((s) => (
                                <button
                                    key={s.series_id}
                                    className="w-full text-left p-2 rounded bg-white/5 hover:bg-white/10"
                                    onClick={() => void loadSeriesDetail(s.series_id)}
                                >
                                    <p className="font-semibold text-white">{s.name}</p>
                                    <p className="text-xs text-white/50">#{s.series_id}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="card p-3">
                        <p className="text-sm font-semibold text-white/70 mb-2">Character Results</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-auto">
                            {searchCharacters.map((c) => (
                                <CharacterCard
                                    key={c.waifu_id}
                                    name={c.name}
                                    series={c.series}
                                    rarity={c.rarity}
                                    currentStarLevel={c.rarity}
                                    imageUrl={c.image_url}
                                    compact
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card p-3">
                    <p className="text-sm font-semibold text-white/70 mb-2">All Series</p>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />)}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2 max-h-[520px] overflow-auto">
                                {seriesPage.items.map((s) => (
                                    <button
                                        key={s.series_id}
                                        className="w-full text-left p-2 rounded bg-white/5 hover:bg-white/10"
                                        onClick={() => void loadSeriesDetail(s.series_id)}
                                    >
                                        <p className="font-semibold text-white">{s.name}</p>
                                        <p className="text-xs text-white/50">
                                            #{s.series_id} • Score: {s.score ?? '-'} • Members: {(s.members ?? 0).toLocaleString()}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            {seriesPage.page_count > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <button className="btn text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={seriesPage.page <= 1} onClick={() => void loadPage(seriesPage.page - 1)}>Prev</button>
                                    <span className="text-xs text-white/50">{seriesPage.page} / {seriesPage.page_count}</span>
                                    <button className="btn text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={seriesPage.page >= seriesPage.page_count} onClick={() => void loadPage(seriesPage.page + 1)}>Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="card p-3">
                    {selectedSeries ? (
                        <>
                            <h2 className="font-bold text-white text-lg">{selectedSeries.name}</h2>
                            <p className="text-xs text-white/50 mb-2">#{selectedSeries.series_id}</p>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {(selectedSeries.genres_list ?? []).map((g) => (
                                    <span key={g} className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">{g}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-auto">
                                {selectedCharacters.map((c) => (
                                    <CharacterCard
                                        key={c.waifu_id}
                                        name={c.name}
                                        series={c.series}
                                        rarity={c.rarity}
                                        currentStarLevel={c.rarity}
                                        imageUrl={c.image_url}
                                        compact
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-white/50 text-sm">
                            Select a series to view its characters.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
