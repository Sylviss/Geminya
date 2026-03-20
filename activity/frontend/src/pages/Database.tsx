import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nwnlCollectionApi } from '../api/client'
import PaginationControls from '../components/nwnl/PaginationControls'

interface Series {
    series_id: number
    name: string
    image_url: string | null
    description: string
    character_count: number
}

export default function Database() {
    const navigate = useNavigate()
    const [series, setSeries] = useState<Series[]>([])
    const [page, setPage] = useState(1)
    const [pageCount, setPageCount] = useState(1)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any>(null)
    const [searching, setSearching] = useState(false)

    useEffect(() => {
        if (!searchQuery.trim()) {
            loadSeries()
        }
    }, [page, searchQuery])

    const loadSeries = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.browseSeries({ page, page_size: 20 })
            setSeries(data.series)
            setPage(data.page)
            setPageCount(data.page_count)
            setTotal(data.total)
        } catch (err: any) {
            console.error('Database load error:', err)
            setError(err?.response?.data?.detail || 'Failed to load database')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null)
            setPage(1)
            return
        }

        setSearching(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.searchDatabase(searchQuery.trim(), { page: 1, page_size: 20 })
            setSearchResults(data)
        } catch (err: any) {
            console.error('Search error:', err)
            setError(err?.response?.data?.detail || 'Search failed')
        } finally {
            setSearching(false)
        }
    }

    const handleClearSearch = () => {
        setSearchQuery('')
        setSearchResults(null)
        setPage(1)
        loadSeries()
    }

    const displayData = searchResults ? searchResults.series : series
    const isSearchView = searchResults !== null

    return (
        <div className="container py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">Database Browser</h1>
                <button onClick={() => navigate('/nwnl/collection')} className="btn btn-secondary">
                    ← My Collection
                </button>
            </div>

            {/* Search */}
            <div className="card p-4">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search series or characters..."
                        className="input flex-1"
                    />
                    <button onClick={handleSearch} disabled={searching} className="btn btn-primary">
                        {searching ? 'Searching...' : 'Search'}
                    </button>
                    {isSearchView && (
                        <button onClick={handleClearSearch} className="btn btn-secondary">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Search Results - Characters */}
            {isSearchView && searchResults.characters && searchResults.characters.length > 0 && (
                <div className="card p-4">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Characters ({searchResults.total_characters})
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {searchResults.characters.map((char: any) => (
                            <button
                                key={char.waifu_id}
                                onClick={() => navigate(`/nwnl/collection/${char.waifu_id}`)}
                                className="card p-3 hover:border-blue-500/50 transition-colors text-left"
                            >
                                {char.image_url && (
                                    <img
                                        src={char.image_url}
                                        alt={char.name}
                                        className="w-full h-32 object-cover rounded mb-2"
                                    />
                                )}
                                <div className="text-sm font-semibold text-white truncate">{char.name}</div>
                                <div className="text-xs text-white/50 truncate">{char.series}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Series List */}
            {loading ? (
                <div className="text-center text-white/70 py-12">Loading series...</div>
            ) : error ? (
                <div className="text-center text-red-400 py-12">{error}</div>
            ) : displayData.length === 0 ? (
                <div className="text-center text-white/70 py-12">
                    {isSearchView ? 'No series found matching your search.' : 'No series available.'}
                </div>
            ) : (
                <>
                    {isSearchView && (
                        <h2 className="text-lg font-semibold text-white">
                            Series ({searchResults.total_series})
                        </h2>
                    )}

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayData.map((s: Series) => (
                            <button
                                key={s.series_id}
                                onClick={() => navigate(`/nwnl/database/series/${s.series_id}`)}
                                className="card p-4 hover:border-blue-500/50 transition-colors text-left"
                            >
                                {s.image_url && (
                                    <img
                                        src={s.image_url}
                                        alt={s.name}
                                        className="w-full h-48 object-cover rounded-lg mb-3"
                                    />
                                )}
                                <h3 className="text-lg font-semibold text-white mb-1">{s.name}</h3>
                                <p className="text-sm text-white/60 mb-2 line-clamp-2">
                                    {s.description || 'No description available.'}
                                </p>
                                <div className="text-sm text-blue-400">
                                    {s.character_count} character{s.character_count !== 1 ? 's' : ''}
                                </div>
                            </button>
                        ))}
                    </div>

                    {!isSearchView && (
                        <PaginationControls
                            page={page}
                            pageCount={pageCount}
                            total={total}
                            onPageChange={setPage}
                            className="mt-6"
                        />
                    )}
                </>
            )}
        </div>
    )
}
