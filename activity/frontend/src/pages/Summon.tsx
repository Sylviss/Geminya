import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { nwnlBannerApi, nwnlSummonApi, nwnlAcademyApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'
import SummonResults from '../components/nwnl/SummonResults'

interface Banner {
    id: number
    name: string
    type: string
    description: string
    cost: number
    currency_type: string
    currency_name: string
    currency_emoji: string
    cost_display: string
    series_ids: number[]
}

interface SingleResult {
    waifu: {
        waifu_id: number
        name: string
        series: string
        rarity: number
        image_url?: string | null
    }
    rarity: number
    is_new: boolean
    is_duplicate: boolean
    current_star_level: number
    shards_gained: number
    quartz_gained: number
    upgrades_performed: { from_star: number; to_star: number }[]
    currency_type: string
    cost: number
    currency_remaining: number
    crystals_remaining: number
    daphine_gained: number
}

interface MultiResult {
    pulls: SingleResult[]
    count: number
    currency_type: string
    total_cost: number
    currency_remaining: number
    crystals_remaining: number
    daphine_gained: number
}

const CURRENCY_EMOJI: Record<string, string> = {
    sakura_crystals: '💎',
    quartzs: '💠',
    daphine: '🦋',
}

export default function Summon() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const bannerIdParam = searchParams.get('banner')

    const [banners, setBanners] = useState<Banner[]>([])
    const [selectedBannerId, setSelectedBannerId] = useState<number | null>(
        bannerIdParam ? parseInt(bannerIdParam) : null
    )
    const [crystals, setCrystals] = useState<number>(0)
    const [quartzs, setQuartzs] = useState<number>(0)
    const [daphine, setDaphine] = useState<number>(0)
    const [pityCounter, setPityCounter] = useState<number>(0)

    const [pulling, setPulling] = useState(false)
    const [lastSingle, setLastSingle] = useState<SingleResult | null>(null)
    const [multiResult, setMultiResult] = useState<MultiResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Load banners and user status
    const loadData = useCallback(async () => {
        try {
            const [bRes, sRes] = await Promise.all([
                nwnlBannerApi.list(),
                nwnlAcademyApi.status(),
            ])
            setBanners(bRes.data)
            const s = sRes.data
            setCrystals(s.sakura_crystals ?? 0)
            setQuartzs(s.quartzs ?? 0)
            setDaphine(s.daphine ?? 0)
            setPityCounter(s.pity_counter ?? 0)
        } catch (_) {}
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const selectedBanner = banners.find(b => b.id === selectedBannerId) ?? null

    const handleSingle = async () => {
        setPulling(true)
        setError(null)
        setLastSingle(null)
        setMultiResult(null)
        try {
            const { data } = await nwnlSummonApi.single(selectedBannerId ?? undefined)
            setLastSingle(data)
            // Update local currency
            setCrystals(data.crystals_remaining ?? 0)
            if (data.currency_type === 'quartzs') setQuartzs(data.currency_remaining ?? 0)
            if (data.currency_type === 'daphine') setDaphine(data.currency_remaining ?? 0)
            if (data.daphine_gained) setDaphine(prev => prev + data.daphine_gained)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Summon failed')
        } finally {
            setPulling(false)
        }
    }

    const handleMulti = async () => {
        setPulling(true)
        setError(null)
        setLastSingle(null)
        setMultiResult(null)
        try {
            const { data } = await nwnlSummonApi.multi(selectedBannerId ?? undefined)
            setMultiResult(data)
            setCrystals(data.crystals_remaining ?? 0)
            if (data.currency_type === 'quartzs') setQuartzs(data.currency_remaining ?? 0)
            if (data.currency_type === 'daphine') setDaphine(data.currency_remaining ?? 0)
            if (data.daphine_gained) setDaphine(prev => prev + data.daphine_gained)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Multi summon failed')
        } finally {
            setPulling(false)
        }
    }

    const cost = selectedBanner?.cost ?? 10
    const currencyType = selectedBanner?.currency_type ?? 'sakura_crystals'
    const currencyEmoji = CURRENCY_EMOJI[currencyType] ?? '💰'
    const balance = currencyType === 'quartzs' ? quartzs : currencyType === 'daphine' ? daphine : crystals
    const canAffordSingle = balance >= cost
    const canAffordMulti = balance >= cost * 10

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    <span className="gradient-text from-purple-400 to-pink-400">✨ Summon</span>
                </h1>
                <button onClick={() => navigate('/banners')} className="btn text-xs bg-white/10 hover:bg-white/20">
                    🎴 All Banners
                </button>
            </div>

            {/* Currency bar */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <CurrencyPill icon="💎" label="Crystals" value={crystals} active={currencyType === 'sakura_crystals'} />
                <CurrencyPill icon="💠" label="Quartzs" value={quartzs} active={currencyType === 'quartzs'} />
                <CurrencyPill icon="🦋" label="Daphine" value={daphine} active={currencyType === 'daphine'} />
                <CurrencyPill icon="🎰" label="Pity" value={`${pityCounter}/50`} active={false} />
            </div>

            {/* Banner selector */}
            {banners.length > 0 && (
                <div className="card p-3">
                    <p className="text-xs text-white/50 mb-2">Select Banner</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedBannerId(null)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedBannerId === null ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                            🎴 Standard
                        </button>
                        {banners.map(b => (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBannerId(b.id)}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedBannerId === b.id ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                {b.name}
                            </button>
                        ))}
                    </div>
                    {selectedBanner && (
                        <p className="text-xs text-white/40 mt-2 italic">{selectedBanner.description}</p>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {/* Multi result */}
            {multiResult && (
                <div className="card p-4">
                    <SummonResults
                        pulls={multiResult.pulls as any}
                        currencyType={multiResult.currency_type}
                        totalCost={multiResult.total_cost}
                        currencyRemaining={multiResult.currency_remaining}
                        daphineGained={multiResult.daphine_gained}
                        onClose={() => setMultiResult(null)}
                    />
                </div>
            )}

            {/* Single result */}
            {lastSingle && !multiResult && (
                <div className="card p-4">
                    <div className="max-w-xs mx-auto">
                        <CharacterCard
                            name={lastSingle.waifu.name}
                            series={lastSingle.waifu.series}
                            rarity={lastSingle.rarity}
                            currentStarLevel={lastSingle.current_star_level}
                            imageUrl={lastSingle.waifu.image_url}
                            isNew={lastSingle.is_new}
                            isDuplicate={lastSingle.is_duplicate}
                            shardsGained={lastSingle.shards_gained}
                            quartzGained={lastSingle.quartz_gained}
                            upgradesPerformed={lastSingle.upgrades_performed}
                        />
                    </div>
                    {lastSingle.daphine_gained > 0 && (
                        <p className="text-center text-sm text-amber-300 mt-2">+{lastSingle.daphine_gained} 🦋 Daphine bonus!</p>
                    )}
                </div>
            )}

            {/* Pull buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={handleSingle}
                    disabled={pulling || !canAffordSingle}
                    className="btn btn-primary py-4 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {pulling ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">✨</span> Pulling...
                        </span>
                    ) : (
                        <>
                            ✨ 1x Pull
                            <br />
                            <span className="text-xs font-normal opacity-80">{currencyEmoji} {cost}</span>
                        </>
                    )}
                </button>
                <button
                    onClick={handleMulti}
                    disabled={pulling || !canAffordMulti}
                    className="btn py-4 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {pulling ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">✨</span> Pulling...
                        </span>
                    ) : (
                        <>
                            🌟 10x Pull
                            <br />
                            <span className="text-xs font-normal opacity-80">{currencyEmoji} {cost * 10}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Rates info */}
            <div className="card p-3">
                <p className="text-xs font-semibold text-white/60 mb-2">📊 Rates</p>
                <div className="flex flex-wrap gap-3 text-xs text-white/50">
                    {selectedBanner?.type === 'premium' ? (
                        <>
                            <span>3★ — 5%</span>
                            <span>2★ — 95%</span>
                        </>
                    ) : (
                        <>
                            <span>3★ — 5%</span>
                            <span>2★ — 20%</span>
                            <span>1★ — 75%</span>
                        </>
                    )}
                    {(!selectedBanner || currencyType === 'sakura_crystals') && (
                        <span className="text-amber-300">Pity: 3★ guaranteed at 50 pulls ({pityCounter}/50)</span>
                    )}
                </div>
            </div>
        </div>
    )
}

function CurrencyPill({ icon, label, value, active }: { icon: string; label: string; value: string | number; active: boolean }) {
    return (
        <div className={`card p-2 flex items-center gap-2 text-xs transition-all ${active ? 'border border-purple-500/60 bg-purple-500/10' : ''}`}>
            <span>{icon}</span>
            <div className="min-w-0">
                <p className="text-white/40 text-[10px] truncate">{label}</p>
                <p className="font-bold text-white truncate">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
            </div>
        </div>
    )
}
