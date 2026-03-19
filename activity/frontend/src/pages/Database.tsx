import { useState, useEffect } from 'react'
import { nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'

interface Series {
    series_id: number
    name: string
    image_url?: string | null
    genres?: string
}

interface Character {
    waifu_id: number
    name: string
    series: string
    image_url: string | null
    rarity: number
    archetype?: string
}

export default function Database() {
    const [view, setView] = useState<'series' | 'search'>('series')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchType, setSearchType] = useState<'all' | 'series' | 'characters'>('all')

    // Series list state
    const [seriesList, setSeriesList] = useState<Series[]>([])
    const [seriesPage, setSeriesPage] = useState(1)
    const [seriesPageCount, setSeriesPageCount] = useState(1)
    const [seriesTotal, setSeriesTotal] = useState(0)

    // Selected series detail state
    const [selectedSeries, setSelectedSeries] = useState<Series | null>(null)
    const [seriesCharacters, setSeriesCharacters] = useState<Character[]>([])

    // Search results state
    const [searchResults, setSearchResults] = useState<{ series: Series[]; characters: Character[] }>({
        series: [],
        characters: [],
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadSeriesList(1)
    }, [])

    const loadSeriesList = async (page: number) => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.getAllSeries({ page, page_size: 50 })
            setSeriesList(data.results)
            setSeriesPage(data.page)
            setSeriesPageCount(data.page_count)
            setSeriesTotal(data.total)
        } catch (err: any) {
            console.error('Failed to load series:', err)
            setError(err?.response?.data?.detail || 'Failed to load series')
        } finally {
            setLoading(false)
        }
    }

    const loadSeriesDetail = async (seriesId: number) => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.getSeriesDetail(seriesId)
            setSelectedSeries(data.series)
            setSeriesCharacters(data.characters)
        } catch (err: any) {
            console.error('Failed to load series detail:', err)
            setError(err?.response?.data?.detail || 'Failed to load series detail')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return
        setView('search')
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.searchDatabase({
                query: searchQuery.trim(),
                type: searchType,
                limit: 100,
            })
            setSearchResults(data)
        } catch (err: any) {
            console.error('Search failed:', err)
            setError(err?.response?.data?.detail || 'Search failed')
        } finally {
            setLoading(false)
        }
    }

    const handleSeriesClick = (series: Series) => {
        loadSeriesDetail(series.series_id)
    }

    const handleBackToSeries = () => {
        setSelectedSeries(null)
        setSeriesCharacters([])
    }

    return (
        <div className="container py-6 space-y-4">
            {/* Header */}
            <h1 className="text-2xl font-bold text-white">Database</h1>

            {/* Search Bar */}
            <div className="card p-4 space-y-3">
                <h3 className="font-semibold text-white/90 text-sm">🔍 Search Database</h3>
                <div className="flex gap-2">
                    <input
                        className="input text-sm flex-1"
                        placeholder="Search series or characters..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <select
                        className="input text-sm w-32"
                        value={searchType}
                        onChange={e => setSearchType(e.target.value as any)}
                    >
                        <option value="all">All</option>
                        <option value="series">Series</option>
                        <option value="characters">Characters</option>
                    </select>
                    <button onClick={handleSearch} className="btn btn-primary text-sm px-6">
                        Search
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card p-4 bg-red-500/10 border border-red-500/30">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Main Content */}
            {view === 'search' && searchQuery ? (
                <>
                    <button onClick={() => setView('series')} className="btn text-sm">
                        ← Back to Series List
                    </button>

                    {/* Search Results */}
                    {loading ? (
                        <div className="card p-6 text-center text-white/60">Loading...</div>
                    ) : (
                        <div className="space-y-4">
                            {searchResults.series.length > 0 && (
                                <div className="card p-4 space-y-3">
                                    <h3 className="font-semibold text-white">Series ({searchResults.series.length})</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {searchResults.series.map(series => (
                                            <div
                                                key={series.series_id}
                                                onClick={() => handleSeriesClick(series)}
                                                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <p className="font-semibold text-white text-sm">{series.name}</p>
                                                {series.genres && (
                                                    <p className="text-xs text-white/40 mt-1">{series.genres}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchResults.characters.length > 0 && (
                                <div className="card p-4 space-y-3">
                                    <h3 className="font-semibold text-white">
                                        Characters ({searchResults.characters.length})
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {searchResults.characters.map(char => (
                                            <CharacterCard
                                                key={char.waifu_id}
                                                name={char.name}
                                                series={char.series}
                                                imageUrl={char.image_url}
                                                rarity={char.rarity}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchResults.series.length === 0 && searchResults.characters.length === 0 && (
                                <div className="card p-8 text-center text-white/60">
                                    No results found for "{searchQuery}"
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : selectedSeries ? (
                <>
                    <button onClick={handleBackToSeries} className="btn text-sm">
                        ← Back to Series List
                    </button>

                    {/* Series Detail */}
                    <div className="card p-6 space-y-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">{selectedSeries.name}</h2>
                            {selectedSeries.genres && (
                                <p className="text-sm text-white/60 mt-1">{selectedSeries.genres}</p>
                            )}
                        </div>

                        <div>
                            <h3 className="font-semibold text-white/90 mb-3">
                                Characters ({seriesCharacters.length})
                            </h3>
                            {loading ? (
                                <div className="text-center text-white/60 py-6">Loading...</div>
                            ) : seriesCharacters.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {seriesCharacters.map(char => (
                                        <CharacterCard
                                            key={char.waifu_id}
                                            name={char.name}
                                            series={char.series}
                                            imageUrl={char.image_url}
                                            rarity={char.rarity}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-white/60 py-6">No characters in this series</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Series List */}
                    <div className="card p-4 space-y-3">
                        <h3 className="font-semibold text-white/90">All Series ({seriesTotal})</h3>
                        {loading ? (
                            <div className="text-center text-white/60 py-6">Loading...</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {seriesList.map(series => (
                                        <div
                                            key={series.series_id}
                                            onClick={() => handleSeriesClick(series)}
                                            className="p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <p className="font-semibold text-white text-sm">{series.name}</p>
                                            {series.genres && (
                                                <p className="text-xs text-white/40 mt-1">{series.genres}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {seriesPageCount > 1 && (
                                    <div className="flex items-center justify-center gap-3 pt-4">
                                        <button
                                            onClick={() => loadSeriesList(seriesPage - 1)}
                                            disabled={seriesPage <= 1}
                                            className="btn bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed px-4"
                                        >
                                            ← Prev
                                        </button>
                                        <span className="text-white/60 text-sm">
                                            Page {seriesPage} of {seriesPageCount}
                                        </span>
                                        <button
                                            onClick={() => loadSeriesList(seriesPage + 1)}
                                            disabled={seriesPage >= seriesPageCount}
                                            className="btn bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed px-4"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
