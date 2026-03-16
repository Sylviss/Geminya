import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { nwnlBannerApi, nwnlSummonApi, nwnlAcademyApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'
import SummonResults from '../components/nwnl/SummonResults'
import { proxyMediaUrl } from '../utils/mediaProxy'

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
    quartzs_remaining: number
    daphine_gained: number
}

interface MultiResult {
    pulls: SingleResult[]
    count: number
    currency_type: string
    total_cost: number
    currency_remaining: number
    crystals_remaining: number
    quartzs_remaining: number
    daphine_gained: number
}

interface BannerRates {
    banner_id: number
    banner_name: string
    banner_type: string
    base_rates: Record<string, number>
    pity_at: number
    rate_up_characters: Array<{
        waifu_id: number
        name: string
        series: string
        rarity: number
        image_url?: string | null
        is_rate_up: boolean
    }>
    featured_rate_per_char: number | null
    standard_rate_per_3star: number | null
}

const CURRENCY_EMOJI: Record<string, string> = {
    sakura_crystals: '💎',
    quartzs: '💠',
    daphine: '🦋',
}

const BANNER_TYPE_LABEL: Record<string, string> = {
    'rate-up': '📈 Rate-Up',
    limited: '⏳ Limited',
    premium: '💠 Premium',
    standard: '🎴 Standard',
}

// ─── Banner Info Modal ─────────────────────────────────────────────

function BannerInfoModal({
    banner,
    onClose,
}: {
    banner: Banner
    onClose: () => void
}) {
    const [rates, setRates] = useState<BannerRates | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        nwnlBannerApi.rates(banner.id)
            .then(r => setRates(r.data))
            .catch(() => setRates(null))
            .finally(() => setLoading(false))
    }, [banner.id])

    const isPremium = banner.type === 'premium'

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="card max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold gradient-text from-purple-400 to-pink-400">
                            {banner.name}
                        </h2>
                        <span className="text-xs text-white/50">{BANNER_TYPE_LABEL[banner.type] ?? banner.type}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white text-xl leading-none"
                    >
                        ✕
                    </button>
                </div>

                {banner.description && (
                    <p className="text-sm text-white/60 italic">{banner.description}</p>
                )}

                {/* Pull cost */}
                <div className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                    <span>{banner.currency_emoji}</span>
                    <span className="text-white/70">Cost per pull:</span>
                    <span className="font-bold text-white">{banner.cost} {banner.currency_name}</span>
                </div>

                {/* Rates breakdown */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">📊 Rates</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                            <p className="text-yellow-300 font-bold text-base">
                                5%
                            </p>
                            <p className="text-white/50">3★</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                            <p className="text-blue-300 font-bold text-base">
                                {isPremium ? '95%' : '20%'}
                            </p>
                            <p className="text-white/50">2★</p>
                        </div>
                        {!isPremium && (
                            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-2">
                                <p className="text-gray-300 font-bold text-base">75%</p>
                                <p className="text-white/50">1★</p>
                            </div>
                        )}
                    </div>
                    {banner.currency_type === 'sakura_crystals' && (
                        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                            🎰 Pity: Guaranteed 3★ every 50 pulls (Sakura Crystals only)
                        </p>
                    )}
                    <p className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
                        ✨ 10x pull guarantee: At least one 2★ per 10-pull
                    </p>
                </div>

                {/* Rate-up characters */}
                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
                    </div>
                ) : rates && rates.rate_up_characters.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                            📈 Featured / Rate-Up Characters
                        </p>
                        {rates.featured_rate_per_char != null && (
                            <p className="text-xs text-purple-300">
                                Each featured 3★ character: ~{rates.featured_rate_per_char}% per pull
                            </p>
                        )}
                        {rates.standard_rate_per_3star != null && (
                            <p className="text-xs text-white/40">
                                Other 3★ characters: ~{rates.standard_rate_per_3star}% per pull
                            </p>
                        )}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {rates.rate_up_characters.map(char => (
                                <div
                                    key={char.waifu_id}
                                    className="relative rounded-xl border border-yellow-400/60 bg-gradient-to-br from-yellow-500/15 to-amber-400/10 overflow-hidden"
                                >
                                    {char.image_url ? (
                                        <img
                                            src={proxyMediaUrl(char.image_url)}
                                            alt={char.name}
                                            className="w-full aspect-[3/4] object-cover object-top"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full aspect-[3/4] flex items-center justify-center bg-white/5 text-3xl">
                                            ⭐⭐⭐
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-1.5 py-1">
                                        <p className="text-[10px] font-bold text-white truncate">{char.name}</p>
                                        <p className="text-[9px] text-white/50 truncate">{char.series}</p>
                                    </div>
                                    <div className="absolute top-1 right-1 bg-yellow-500/90 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                        UP
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : rates ? (
                    <p className="text-xs text-white/40 text-center py-2">
                        Standard pool — all characters have equal rates within each rarity tier.
                    </p>
                ) : null}

                <button onClick={onClose} className="btn btn-primary w-full">Close</button>
            </div>
        </div>
    )
}

// ─── Main Summon Page ─────────────────────────────────────────────

export default function Summon() {
    const [searchParams] = useSearchParams()
    const bannerIdParam = searchParams.get('banner')

    const [banners, setBanners] = useState<Banner[]>([])
    const [selectedBannerId, setSelectedBannerId] = useState<number | null>(
        bannerIdParam ? parseInt(bannerIdParam) : null
    )
    const [crystals, setCrystals] = useState<number>(0)
    const [quartzs, setQuartzs] = useState<number>(0)
    const [daphine, setDaphine] = useState<number>(0)
    const [pityCounter, setPityCounter] = useState<number>(0)

    const [loading, setLoading] = useState(true)
    const [pulling, setPulling] = useState(false)
    const [lastSingle, setLastSingle] = useState<SingleResult | null>(null)
    const [multiResult, setMultiResult] = useState<MultiResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showBannerInfo, setShowBannerInfo] = useState(false)

    // Load banners and user status
    const loadData = useCallback(async () => {
        setLoading(true)
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
        } catch (err) {
            console.error('Failed to load summon data:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const selectedBanner = banners.find(b => b.id === selectedBannerId) ?? null

    const updateCurrencyFromResult = (data: SingleResult | MultiResult) => {
        setCrystals(data.crystals_remaining ?? 0)
        if (data.quartzs_remaining != null) setQuartzs(data.quartzs_remaining)
        if (data.currency_type === 'daphine') setDaphine(data.currency_remaining ?? 0)
        const dGained = 'daphine_gained' in data ? data.daphine_gained : 0
        if (dGained) setDaphine(prev => prev + dGained)
    }

    const handleSingle = async () => {
        setPulling(true)
        setError(null)
        setLastSingle(null)
        setMultiResult(null)
        try {
            const { data } = await nwnlSummonApi.single(selectedBannerId ?? undefined)
            setLastSingle(data)
            updateCurrencyFromResult(data)
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
            updateCurrencyFromResult(data)
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

    // Full-page loading overlay
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto" />
                    <p className="text-white/60 text-sm">Loading Summon...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Banner Info Modal */}
            {showBannerInfo && selectedBanner && (
                <BannerInfoModal
                    banner={selectedBanner}
                    onClose={() => setShowBannerInfo(false)}
                />
            )}

            {/* Pull overlay while summon is in progress */}
            {pulling && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center space-y-3">
                        <div className="animate-spin text-5xl">✨</div>
                        <p className="text-white/80 text-sm font-semibold">Summoning...</p>
                    </div>
                </div>
            )}

            <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        <span className="gradient-text from-purple-400 to-pink-400">✨ Summon</span>
                    </h1>
                    {selectedBanner && (
                        <button
                            onClick={() => setShowBannerInfo(true)}
                            className="btn text-xs bg-white/10 hover:bg-white/20"
                        >
                            ℹ️ Banner Info
                        </button>
                    )}
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
                                onClick={() => { setSelectedBannerId(null); setShowBannerInfo(false) }}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selectedBannerId === null ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                🎴 Standard
                            </button>
                            {banners.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => { setSelectedBannerId(b.id); setShowBannerInfo(false) }}
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
                        <>
                            ✨ 1x Pull
                            <br />
                            <span className="text-xs font-normal opacity-80">{currencyEmoji} {cost}</span>
                        </>
                    </button>
                    <button
                        onClick={handleMulti}
                        disabled={pulling || !canAffordMulti}
                        className="btn py-4 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <>
                            🌟 10x Pull
                            <br />
                            <span className="text-xs font-normal opacity-80">{currencyEmoji} {cost * 10}</span>
                        </>
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
                        <span className="text-cyan-300">10x: At least one 2★ guaranteed</span>
                    </div>
                </div>
            </div>
        </>
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
