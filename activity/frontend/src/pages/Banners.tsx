import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { nwnlBannerApi } from '../api/client'

interface Banner {
    id: number
    name: string
    type: string
    description: string
    is_active: boolean
    cost: number
    currency_type: string
    currency_name: string
    currency_emoji: string
    cost_display: string
    series_ids: number[]
    start_time: string
    end_time: string
}

const BANNER_TYPE_STYLE: Record<string, { badge: string; gradient: string; icon: string }> = {
    'rate-up': {
        badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
        gradient: 'from-purple-900/40 to-pink-900/30',
        icon: '📈',
    },
    limited: {
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        gradient: 'from-amber-900/40 to-orange-900/30',
        icon: '⏳',
    },
    premium: {
        badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
        gradient: 'from-cyan-900/40 to-blue-900/30',
        icon: '💠',
    },
    standard: {
        badge: 'bg-gray-500/20 text-gray-300 border border-gray-500/40',
        gradient: 'from-gray-900/40 to-slate-900/30',
        icon: '🎴',
    },
}

export default function Banners() {
    const [banners, setBanners] = useState<Banner[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        nwnlBannerApi.list()
            .then(r => setBanners(r.data))
            .catch(err => setError(err?.response?.data?.detail || 'Failed to load banners'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-4">
                <div className="h-8 w-40 bg-white/10 rounded animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="card p-8 text-center">
                    <span className="text-4xl block mb-3">😿</span>
                    <p className="text-red-400">{error}</p>
                    <button onClick={() => window.location.reload()} className="btn btn-primary mt-4">Retry</button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    <span className="gradient-text from-purple-400 to-pink-400">🎴 Active Banners</span>
                </h1>
                <button
                    onClick={() => navigate('/summon')}
                    className="btn btn-primary text-sm"
                >
                    ✨ Go Summon
                </button>
            </div>

            {banners.length === 0 ? (
                <div className="card p-10 text-center">
                    <span className="text-4xl block mb-3">🎴</span>
                    <p className="text-white/40">No active banners right now. Check back soon!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {banners.map(banner => {
                        const style = BANNER_TYPE_STYLE[banner.type] ?? BANNER_TYPE_STYLE['standard']
                        return (
                            <div
                                key={banner.id}
                                className={`card p-5 bg-gradient-to-br ${style.gradient} hover:scale-[1.02] transition-transform cursor-pointer border border-white/10 hover:border-white/20`}
                                onClick={() => navigate(`/summon?banner=${banner.id}`)}
                            >
                                {/* Title row */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{style.icon}</span>
                                        <h3 className="font-bold text-white text-base leading-tight">{banner.name}</h3>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-semibold ${style.badge}`}>
                                        {banner.type}
                                    </span>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-white/60 mb-3 line-clamp-2">{banner.description}</p>

                                {/* Cost */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-white/70">{banner.cost_display}</span>
                                    <span className="btn btn-primary text-xs py-1 px-3 pointer-events-none">
                                        Summon →
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
