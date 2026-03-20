import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'

interface Series {
    series_id: number
    name: string
    image_url: string | null
    description: string
    genres: string[]
}

interface Character {
    waifu_id: number
    name: string
    series: string
    rarity: number
    image_url: string | null
    archetype: string
    elemental_type: string | string[]
}

export default function SeriesDetail() {
    const { seriesId } = useParams<{ seriesId: string }>()
    const navigate = useNavigate()
    const [series, setSeries] = useState<Series | null>(null)
    const [characters, setCharacters] = useState<Character[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadSeries()
    }, [seriesId])

    const loadSeries = async () => {
        if (!seriesId) return
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.getSeries(parseInt(seriesId))
            setSeries(data.series)
            setCharacters(data.characters)
        } catch (err: any) {
            console.error('Failed to load series:', err)
            setError(err?.response?.data?.detail || 'Failed to load series')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="container py-8">
                <div className="text-center text-white/70">Loading series...</div>
            </div>
        )
    }

    if (error || !series) {
        return (
            <div className="container py-8">
                <div className="text-center space-y-4">
                    <div className="text-red-400">{error || 'Series not found'}</div>
                    <button onClick={() => navigate('/nwnl/database')} className="btn btn-secondary">
                        Back to Database
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="container py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/nwnl/database')} className="btn btn-secondary">
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-white">Series Detail</h1>
            </div>

            {/* Series Info */}
            <div className="card p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-6">
                    {series.image_url && (
                        <img
                            src={series.image_url}
                            alt={series.name}
                            className="w-full md:w-48 h-64 object-cover rounded-lg"
                        />
                    )}
                    <div className="flex-1 space-y-3">
                        <h2 className="text-3xl font-bold text-white">{series.name}</h2>
                        {series.description && (
                            <p className="text-white/70">{series.description}</p>
                        )}
                        {series.genres && series.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {series.genres.map((genre) => (
                                    <span
                                        key={genre}
                                        className="px-3 py-1 bg-blue-600/20 border border-blue-600/40 rounded-full text-sm text-blue-400"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="text-sm text-white/60">
                            {characters.length} character{characters.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Characters */}
            {characters.length === 0 ? (
                <div className="text-center text-white/70 py-12">No characters available.</div>
            ) : (
                <>
                    <h3 className="text-xl font-semibold text-white">Characters</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {characters.map((char) => (
                            <div
                                key={char.waifu_id}
                                onClick={() => navigate(`/nwnl/collection/${char.waifu_id}`)}
                                className="cursor-pointer"
                            >
                                <CharacterCard
                                    name={char.name}
                                    series={char.series}
                                    imageUrl={char.image_url}
                                    rarity={char.rarity}
                                    currentStarLevel={char.rarity}
                                    isNew={false}
                                    isAwakened={false}
                                />
                                <div className="mt-2 text-xs text-white/60 text-center">
                                    {char.archetype}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
