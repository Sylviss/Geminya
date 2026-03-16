import { useState } from 'react'
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
    loading: boolean
}

export default function CollectionSearch() {
    const [genre, setGenre] = useState('')
    const [archetype, setArchetype] = useState('')
    const [element, setElement] = useState('')
    const [data, setData] = useState<SearchState>({ results: [], total: 0, page: 1, page_count: 1, loading: false })

    const search = async (page = 1) => {
        setData(prev => ({ ...prev, loading: true }))
        try {
            const params: Record<string, any> = { page, page_size: 12 }
            if (genre) params.genre = genre
            if (archetype) params.archetype = archetype
            if (element) params.element = element

            const { data: res } = await nwnlAcademyApi.searchCollection(params)
            setData({ ...res, loading: false })
        } catch {
            setData(prev => ({ ...prev, loading: false }))
        }
    }

    const stars = (n: number) => '⭐'.repeat(n)

    return (
        <div className="card p-4">
            <h3 className="font-bold text-white/90 mb-3 flex items-center gap-2">
                <span>🔍</span> Collection Search
            </h3>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <input className="input text-sm" placeholder="Genre..." value={genre} onChange={e => setGenre(e.target.value)} />
                <input className="input text-sm" placeholder="Archetype..." value={archetype} onChange={e => setArchetype(e.target.value)} />
                <input className="input text-sm" placeholder="Element..." value={element} onChange={e => setElement(e.target.value)} />
            </div>
            <button onClick={() => search(1)} className="btn btn-primary w-full text-sm mb-4">Search</button>

            {data.loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-32 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : data.results.length ? (
                <>
                    <p className="text-xs text-white/40 mb-2">{data.total} characters found — Page {data.page}/{data.page_count}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {data.results.map(w => (
                            <div key={w.waifu_id} className="bg-white/5 rounded-lg p-2.5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/15">
                                <div className="flex items-start justify-between mb-1">
                                    <p className="text-xs font-bold text-white/90 truncate flex-1">{w.name} {w.is_awakened && '🦋'}</p>
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
                    {data.page_count > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-3">
                            <button onClick={() => search(data.page - 1)} disabled={data.page <= 1} className="btn text-xs px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed">← Prev</button>
                            <span className="text-xs text-white/50">{data.page}/{data.page_count}</span>
                            <button onClick={() => search(data.page + 1)} disabled={data.page >= data.page_count} className="btn text-xs px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-center text-white/40 text-sm py-6">Search your collection above</p>
            )}
        </div>
    )
}
