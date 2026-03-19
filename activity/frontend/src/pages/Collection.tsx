import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'

interface WaifuResult {
    waifu_id: number
    name: string
    series: string
    series_id: number
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

interface CollectionState {
    results: WaifuResult[]
    total: number
    page: number
    page_count: number
}

export default function Collection() {
    const navigate = useNavigate()
    const [data, setData] = useState<CollectionState>({ results: [], total: 0, page: 1, page_count: 1 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filters
    const [nameQuery, setNameQuery] = useState('')
    const [seriesQuery, setSeriesQuery] = useState('')
    const [genreQuery, setGenreQuery] = useState('')
    const [archetypeQuery, setArchetypeQuery] = useState('')
    const [elementQuery, setElementQuery] = useState('')

    useEffect(() => {
        loadCollection(1)
    }, [])

    const loadCollection = async (page = 1) => {
        setLoading(true)
        setError(null)
        try {
            const params: Record<string, any> = { page, page_size: 20 }
            if (nameQuery.trim()) params.name = nameQuery.trim()
            if (seriesQuery.trim()) params.series = seriesQuery.trim()
            if (genreQuery.trim()) params.genre = genreQuery.trim()
            if (archetypeQuery.trim()) params.archetype = archetypeQuery.trim()
            if (elementQuery.trim()) params.element = elementQuery.trim()

            const { data: res } = nameQuery || seriesQuery || genreQuery || archetypeQuery || elementQuery
                ? await nwnlCollectionApi.searchCollection(params)
                : await nwnlCollectionApi.getCollection(params)
            setData(res)
        } catch (err: any) {
            console.error('Failed to load collection:', err)
            setError(err?.response?.data?.detail || 'Failed to load collection')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = () => {
        loadCollection(1)
    }

    const clearFilters = () => {
        setNameQuery('')
        setSeriesQuery('')
        setGenreQuery('')
        setArchetypeQuery('')
        setElementQuery('')
        setTimeout(() => loadCollection(1), 0)
    }

    const hasFilters = nameQuery || seriesQuery || genreQuery || archetypeQuery || elementQuery

    return (
        <div className="container py-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Collection</h1>
                <p className="text-sm text-white/60">{data.total} characters</p>
            </div>

            {/* Search Filters */}
            <div className="card p-4 space-y-3">
                <h3 className="font-semibold text-white/90 text-sm">🔍 Search & Filter</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        className="input text-sm"
                        placeholder="Character name..."
                        value={nameQuery}
                        onChange={e => setNameQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <input
                        className="input text-sm"
                        placeholder="Series name..."
                        value={seriesQuery}
                        onChange={e => setSeriesQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <input
                        className="input text-sm"
                        placeholder="Genre..."
                        value={genreQuery}
                        onChange={e => setGenreQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <input
                        className="input text-sm"
                        placeholder="Archetype..."
                        value={archetypeQuery}
                        onChange={e => setArchetypeQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <input
                        className="input text-sm"
                        placeholder="Element..."
                        value={elementQuery}
                        onChange={e => setElementQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSearch} className="btn btn-primary flex-1 text-sm">
                            Search
                        </button>
                        {hasFilters && (
                            <button onClick={clearFilters} className="btn bg-white/10 hover:bg-white/20 text-sm px-3">
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card p-4 bg-red-500/10 border border-red-500/30">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Collection Grid */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-56 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : data.results.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {data.results.map(waifu => (
                            <div
                                key={waifu.waifu_id}
                                onClick={() => navigate(`/character/${waifu.waifu_id}`)}
                                className="cursor-pointer hover:scale-105 transition-transform"
                            >
                                <CharacterCard
                                    name={waifu.name}
                                    series={waifu.series}
                                    imageUrl={waifu.image_url}
                                    rarity={waifu.rarity}
                                    starLevel={waifu.current_star_level}
                                    isAwakened={waifu.is_awakened}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {data.page_count > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-4">
                            <button
                                onClick={() => loadCollection(data.page - 1)}
                                disabled={data.page <= 1}
                                className="btn bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed px-4"
                            >
                                ← Prev
                            </button>
                            <span className="text-white/60 text-sm">
                                Page {data.page} of {data.page_count}
                            </span>
                            <button
                                onClick={() => loadCollection(data.page + 1)}
                                disabled={data.page >= data.page_count}
                                className="btn bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed px-4"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="card p-8 text-center">
                    <p className="text-white/60">
                        {hasFilters ? 'No characters match your search filters' : 'Your collection is empty'}
                    </p>
                    {hasFilters && (
                        <button onClick={clearFilters} className="btn btn-primary mt-4">
                            Clear Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
