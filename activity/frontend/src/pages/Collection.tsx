import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'

interface CollectionItem {
    waifu_id: number
    name: string
    series: string
    image_url?: string | null
    rarity: number
    current_star_level: number
    character_shards: number
    is_awakened: boolean
    elements: string
    archetype: string
    stats_power: number
}

interface CollectionResponse {
    results: CollectionItem[]
    total: number
    page: number
    page_count: number
}

export default function Collection() {
    const [data, setData] = useState<CollectionResponse>({ results: [], total: 0, page: 1, page_count: 1 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [series, setSeries] = useState('')
    const [element, setElement] = useState('')
    const [archetype, setArchetype] = useState('')
    const [rarity, setRarity] = useState<number | ''>('')
    const [sortBy, setSortBy] = useState<'power' | 'star' | 'name'>('power')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const navigate = useNavigate()

    const load = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const { data: res } = await nwnlCollectionApi.list({
                page,
                page_size: 18,
                name: name.trim() || undefined,
                series: series.trim() || undefined,
                element: element.trim() || undefined,
                archetype: archetype.trim() || undefined,
                rarity: rarity === '' ? undefined : Number(rarity),
                sort_by: sortBy,
                sort_order: 'desc',
            })
            setData(res)
            setError(null)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to load collection')
        } finally {
            setLoading(false)
        }
    }, [name, series, element, archetype, rarity, sortBy])

    useEffect(() => { load(1) }, [load])

    const headerText = useMemo(() => `${data.total.toLocaleString()} waifus`, [data.total])

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold gradient-text from-cyan-300 to-blue-400">📚 Collection</h1>
                <span className="text-xs text-white/50">{headerText}</span>
            </div>

            <div className="card p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                <input className="input text-sm col-span-2 sm:col-span-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input text-sm col-span-2 sm:col-span-1" placeholder="Series" value={series} onChange={(e) => setSeries(e.target.value)} />
                <input className="input text-sm" placeholder="Element" value={element} onChange={(e) => setElement(e.target.value)} />
                <input className="input text-sm" placeholder="Archetype" value={archetype} onChange={(e) => setArchetype(e.target.value)} />
                <select className="input text-sm" value={rarity} onChange={(e) => setRarity(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Any rarity</option>
                    <option value="1">1★</option>
                    <option value="2">2★</option>
                    <option value="3">3★</option>
                </select>
                <select className="input text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'power' | 'star' | 'name')}>
                    <option value="power">Sort: Power</option>
                    <option value="star">Sort: Star</option>
                    <option value="name">Sort: Name</option>
                </select>
                <div className="flex gap-2">
                    <button className={`btn text-xs px-3 py-2 ${viewMode === 'grid' ? 'btn-primary' : 'bg-white/10 hover:bg-white/20'}`} onClick={() => setViewMode('grid')}>Grid</button>
                    <button className={`btn text-xs px-3 py-2 ${viewMode === 'list' ? 'btn-primary' : 'bg-white/10 hover:bg-white/20'}`} onClick={() => setViewMode('list')}>List</button>
                </div>
            </div>

            {error && <div className="card p-3 text-red-300 text-sm">{error}</div>}

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />)}
                </div>
            ) : data.results.length === 0 ? (
                <div className="card p-8 text-center text-white/50">No waifus matched your filters.</div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.results.map((w) => (
                        <button
                            key={w.waifu_id}
                            className="text-left"
                            onClick={() => navigate(`/collection/${w.waifu_id}`)}
                        >
                            <CharacterCard
                                name={w.name}
                                series={w.series}
                                rarity={w.rarity}
                                currentStarLevel={w.current_star_level}
                                imageUrl={w.image_url}
                                isAwakened={w.is_awakened}
                                compact
                            />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="card p-2 divide-y divide-white/10">
                    {data.results.map((w) => (
                        <button
                            key={w.waifu_id}
                            className="w-full p-3 flex items-center justify-between hover:bg-white/5 text-left"
                            onClick={() => navigate(`/collection/${w.waifu_id}`)}
                        >
                            <div>
                                <p className="font-semibold text-white">{w.name} {w.is_awakened ? '🦋' : ''}</p>
                                <p className="text-xs text-white/50">{w.series} • {w.elements} • {w.archetype}</p>
                            </div>
                            <div className="text-right text-xs text-white/60">
                                <p>{'⭐'.repeat(w.current_star_level)}</p>
                                <p>{w.character_shards} shards</p>
                                <p className="text-cyan-300">{w.stats_power}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {data.page_count > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button className="btn text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>Prev</button>
                    <span className="text-xs text-white/50">{data.page} / {data.page_count}</span>
                    <button className="btn text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={data.page >= data.page_count} onClick={() => load(data.page + 1)}>Next</button>
                </div>
            )}
        </div>
    )
}
