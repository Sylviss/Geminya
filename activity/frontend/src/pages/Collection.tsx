import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'
import PaginationControls from '../components/nwnl/PaginationControls'

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

export default function Collection() {
    const navigate = useNavigate()
    const [results, setResults] = useState<WaifuResult[]>([])
    const [page, setPage] = useState(1)
    const [pageCount, setPageCount] = useState(1)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Filters
    const [nameFilter, setNameFilter] = useState('')
    const [seriesFilter, setSeriesFilter] = useState('')
    const [rarityFilter, setRarityFilter] = useState<number | null>(null)
    const [elementFilter, setElementFilter] = useState('')
    const [archetypeFilter, setArchetypeFilter] = useState('')

    useEffect(() => {
        loadCollection()
    }, [page, rarityFilter])

    const loadCollection = async () => {
        setLoading(true)
        setError(null)
        try {
            const params: any = { page, page_size: 24 }
            if (nameFilter.trim()) params.name = nameFilter.trim()
            if (seriesFilter.trim()) params.series = seriesFilter.trim()
            if (rarityFilter) params.rarity = rarityFilter
            if (elementFilter.trim()) params.element = elementFilter.trim()
            if (archetypeFilter.trim()) params.archetype = archetypeFilter.trim()

            const { data } = await nwnlCollectionApi.search(params)
            setResults(data.results)
            setPage(data.page)
            setPageCount(data.page_count)
            setTotal(data.total)
        } catch (err: any) {
            console.error('Collection load error:', err)
            setError(err?.response?.data?.detail || 'Failed to load collection')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = () => {
        setPage(1)
        loadCollection()
    }

    const handleClearFilters = () => {
        setNameFilter('')
        setSeriesFilter('')
        setRarityFilter(null)
        setElementFilter('')
        setArchetypeFilter('')
        setPage(1)
        setTimeout(() => loadCollection(), 0)
    }

    const hasFilters = nameFilter || seriesFilter || rarityFilter || elementFilter || archetypeFilter

    return (
        <div className="container py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">My Collection</h1>
                <button onClick={() => navigate('/nwnl/database')} className="btn btn-secondary">
                    Browse Database →
                </button>
            </div>

            {/* Filters */}
            <div className="card p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Filters</h2>
                    {hasFilters && (
                        <button onClick={handleClearFilters} className="text-sm text-blue-400 hover:text-blue-300">
                            Clear All
                        </button>
                    )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Name Search */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Name</label>
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search by name..."
                            className="input w-full"
                        />
                    </div>

                    {/* Series Search */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Series</label>
                        <input
                            type="text"
                            value={seriesFilter}
                            onChange={(e) => setSeriesFilter(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search by series..."
                            className="input w-full"
                        />
                    </div>

                    {/* Rarity Filter */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Rarity</label>
                        <select
                            value={rarityFilter || ''}
                            onChange={(e) => setRarityFilter(e.target.value ? parseInt(e.target.value) : null)}
                            className="input w-full"
                        >
                            <option value="">All Rarities</option>
                            <option value="1">★ 1-Star</option>
                            <option value="2">★★ 2-Star</option>
                            <option value="3">★★★ 3-Star</option>
                        </select>
                    </div>

                    {/* Element Filter */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Element</label>
                        <input
                            type="text"
                            value={elementFilter}
                            onChange={(e) => setElementFilter(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Fire, Water, Earth..."
                            className="input w-full"
                        />
                    </div>

                    {/* Archetype Filter */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Archetype</label>
                        <input
                            type="text"
                            value={archetypeFilter}
                            onChange={(e) => setArchetypeFilter(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Warrior, Mage..."
                            className="input w-full"
                        />
                    </div>
                </div>

                <button onClick={handleSearch} className="btn btn-primary w-full md:w-auto">
                    Apply Filters
                </button>
            </div>

            {/* Results */}
            {loading ? (
                <div className="text-center text-white/70 py-12">Loading collection...</div>
            ) : error ? (
                <div className="text-center text-red-400 py-12">{error}</div>
            ) : results.length === 0 ? (
                <div className="text-center text-white/70 py-12">
                    {hasFilters ? 'No characters match your filters.' : 'Your collection is empty.'}
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between text-sm text-white/70">
                        <span>{total} character{total !== 1 ? 's' : ''} found</span>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {results.map((waifu) => (
                            <div
                                key={waifu.waifu_id}
                                onClick={() => navigate(`/nwnl/collection/${waifu.waifu_id}`)}
                                className="cursor-pointer"
                            >
                                <CharacterCard
                                    name={waifu.name}
                                    series={waifu.series}
                                    imageUrl={waifu.image_url}
                                    rarity={waifu.rarity}
                                    currentStarLevel={waifu.current_star_level}
                                    isNew={false}
                                    isAwakened={waifu.is_awakened}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <PaginationControls
                        page={page}
                        pageCount={pageCount}
                        total={total}
                        onPageChange={setPage}
                        className="mt-6"
                    />
                </>
            )}
        </div>
    )
}
