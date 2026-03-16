import { useState, useEffect, useCallback } from 'react'
import { nwnlAcademyApi } from '../api/client'
import CurrencyDisplay from '../components/nwnl/CurrencyDisplay'
import DailyClaimButton from '../components/nwnl/DailyClaimButton'
import MissionsPanel from '../components/nwnl/MissionsPanel'
import CollectionSearch from '../components/nwnl/CollectionSearch'

interface AcademyStatus {
    academy_name: string
    collector_rank: number
    sakura_crystals: number
    quartzs: number
    daphine: number
    pity_counter: number
    guaranteed_3star_in: number
    total_waifus: number
    unique_waifus: number
    collection_power: number
    last_daily_reset: number
    rarity_distribution: Record<string, number>
    rank_progress: {
        power: number
        power_required: number
        power_pct: number
        waifus: number
        waifus_required: number
        waifu_pct: number
        overall_pct: number
    }
}

export default function Academy() {
    const [status, setStatus] = useState<AcademyStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadStatus = useCallback(async () => {
        try {
            const { data } = await nwnlAcademyApi.status()
            setStatus(data)
            setError(null)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to load academy status')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadStatus() }, [loadStatus])

    // Called by child components after mutations (daily claim, mission claim, etc)
    const refreshStatus = useCallback(() => {
        loadStatus()
    }, [loadStatus])

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-4">
                <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
                <div className="grid grid-cols-5 gap-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
                </div>
                <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
            </div>
        )
    }

    if (error || !status) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="card p-8 text-center">
                    <span className="text-4xl block mb-3">😿</span>
                    <h2 className="text-xl font-bold text-red-400 mb-2">Oops!</h2>
                    <p className="text-white/60">{error || 'Unable to load academy'}</p>
                    <button onClick={() => { setError(null); setLoading(true); loadStatus() }} className="btn btn-primary mt-4">Retry</button>
                </div>
            </div>
        )
    }

    const rp = status.rank_progress

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        <span className="gradient-text from-purple-400 to-pink-400">🏫 {status.academy_name}</span>
                    </h1>
                    <p className="text-sm text-white/50">
                        Rank {status.collector_rank} • {status.total_waifus} Waifus • {status.collection_power.toLocaleString()} Power
                    </p>
                </div>
            </div>

            {/* Currencies */}
            <CurrencyDisplay
                sakuraCrystals={status.sakura_crystals}
                quartzs={status.quartzs}
                daphine={status.daphine}
                pityCounter={status.pity_counter}
                guaranteed3StarIn={status.guaranteed_3star_in}
            />

            {/* Daily + Rank Progress Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DailyClaimButton
                    lastDailyReset={status.last_daily_reset}
                    onClaimed={refreshStatus}
                />
                <div className="card p-4">
                    <h3 className="text-sm font-semibold text-white/70 mb-2">📈 Rank Progress → Rank {status.collector_rank + 1}</h3>
                    <div className="space-y-2">
                        <ProgressRow label="Power" current={rp.power} target={rp.power_required} pct={rp.power_pct} color="bg-purple-400" />
                        <ProgressRow label="Waifus" current={rp.waifus} target={rp.waifus_required} pct={rp.waifu_pct} color="bg-pink-400" />
                    </div>
                </div>
            </div>

            {/* Star Distribution */}
            {Object.keys(status.rarity_distribution).length > 0 && (
                <div className="card p-4">
                    <h3 className="text-sm font-semibold text-white/70 mb-3">🌟 Star Distribution</h3>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(status.rarity_distribution)
                            .sort(([a], [b]) => Number(b) - Number(a))
                            .map(([star, count]) => (
                                <div key={star} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                    <span className="text-sm">{'⭐'.repeat(Number(star))}</span>
                                    <span className="text-sm font-bold text-white/80">{count}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* Missions */}
            <MissionsPanel onMissionClaimed={refreshStatus} />

            {/* Collection Search */}
            <CollectionSearch />
        </div>
    )
}

function ProgressRow({ label, current, target, pct, color }: { label: string; current: number; target: number; pct: number; color: string }) {
    return (
        <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>{label}</span>
                <span>{current.toLocaleString()} / {target.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct * 100}%` }} />
            </div>
        </div>
    )
}
