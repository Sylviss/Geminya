import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { nwnlCollectionApi, nwnlAcademyApi } from '../api/client'
import StatsRadar from '../components/nwnl/StatsRadar'
import RarityBadge from '../components/nwnl/RarityBadge'
import AwakenDialog from '../components/nwnl/AwakenDialog'

interface WaifuDetail {
    waifu_id: number
    name: string
    series: string
    series_id: number
    series_description?: string
    rarity: number
    image_url: string | null
    archetype: string
    elemental_type: string | string[]
    stats: {
        atk: number
        mag: number
        vit: number
        spr: number
        int: number
        spd: number
        lck: number
    }
    genres: string[]
    owned: boolean
    current_star_level?: number
    character_shards?: number
    is_awakened?: boolean
}

export default function CharacterProfile() {
    const { waifuId } = useParams<{ waifuId: string }>()
    const navigate = useNavigate()
    const [waifu, setWaifu] = useState<WaifuDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAwakenDialog, setShowAwakenDialog] = useState(false)
    const [daphineBalance, setDaphineBalance] = useState(0)

    useEffect(() => {
        loadCharacter()
        loadUserStatus()
    }, [waifuId])

    const loadCharacter = async () => {
        if (!waifuId) return
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.getCharacter(parseInt(waifuId))
            setWaifu(data)
        } catch (err: any) {
            console.error('Failed to load character:', err)
            setError(err?.response?.data?.detail || 'Failed to load character')
        } finally {
            setLoading(false)
        }
    }

    const loadUserStatus = async () => {
        try {
            const { data } = await nwnlAcademyApi.status()
            setDaphineBalance(data.daphine || 0)
        } catch (err) {
            console.error('Failed to load user status:', err)
        }
    }

    const handleAwakened = () => {
        setShowAwakenDialog(false)
        loadCharacter()
        loadUserStatus()
    }

    if (loading) {
        return (
            <div className="container py-8">
                <div className="text-center text-white/70">Loading character...</div>
            </div>
        )
    }

    if (error || !waifu) {
        return (
            <div className="container py-8">
                <div className="text-center space-y-4">
                    <div className="text-red-400">{error || 'Character not found'}</div>
                    <button onClick={() => navigate('/nwnl/collection')} className="btn btn-secondary">
                        Back to Collection
                    </button>
                </div>
            </div>
        )
    }

    const elements = Array.isArray(waifu.elemental_type)
        ? waifu.elemental_type.join(', ')
        : waifu.elemental_type

    const upgradeProgress = waifu.owned && waifu.current_star_level
        ? `${waifu.current_star_level}★`
        : ''

    return (
        <div className="container py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="btn btn-secondary">
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-white">Character Profile</h1>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Column - Image & Basic Info */}
                <div className="space-y-4">
                    <div className="card p-4">
                        {waifu.image_url && (
                            <img
                                src={waifu.image_url}
                                alt={waifu.name}
                                className="w-full rounded-lg mb-4"
                                style={{ maxHeight: '400px', objectFit: 'contain' }}
                            />
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white">{waifu.name}</h2>
                                <RarityBadge rarity={waifu.rarity} className="text-2xl" />
                            </div>

                            {waifu.is_awakened && (
                                <div className="flex items-center gap-2 text-amber-300">
                                    <span className="text-2xl">🦋</span>
                                    <span className="font-semibold">Awakened</span>
                                </div>
                            )}

                            {waifu.owned && (
                                <div className="bg-green-600/20 border border-green-600/40 rounded-lg p-3 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400 font-semibold">✓ Owned</span>
                                        {upgradeProgress && (
                                            <span className="text-white/70">{upgradeProgress}</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-white/70">
                                        Shards: <span className="text-white">{waifu.character_shards || 0}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-white/60">Series:</span>
                                    <button
                                        onClick={() => navigate(`/nwnl/database/series/${waifu.series_id}`)}
                                        className="text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                        {waifu.series}
                                    </button>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Archetype:</span>
                                    <span className="text-white">{waifu.archetype}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Elements:</span>
                                    <span className="text-white">{elements}</span>
                                </div>
                                {waifu.genres && waifu.genres.length > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Genres:</span>
                                        <span className="text-white">{waifu.genres.join(', ')}</span>
                                    </div>
                                )}
                            </div>

                            {waifu.owned && !waifu.is_awakened && (
                                <button
                                    onClick={() => setShowAwakenDialog(true)}
                                    className="btn btn-primary w-full"
                                    disabled={daphineBalance < 1}
                                >
                                    🦋 Awaken ({daphineBalance} Daphine)
                                </button>
                            )}
                        </div>
                    </div>

                    {waifu.series_description && (
                        <div className="card p-4">
                            <h3 className="text-lg font-semibold text-white mb-2">About {waifu.series}</h3>
                            <p className="text-sm text-white/70">{waifu.series_description}</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Stats Radar */}
                <div className="space-y-4">
                    <div className="card p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Stats</h3>
                        <StatsRadar stats={waifu.stats} size={350} />

                        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/60">ATK:</span>
                                <span className="text-white font-semibold">{waifu.stats.atk}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">MAG:</span>
                                <span className="text-white font-semibold">{waifu.stats.mag}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">VIT:</span>
                                <span className="text-white font-semibold">{waifu.stats.vit}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">SPR:</span>
                                <span className="text-white font-semibold">{waifu.stats.spr}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">INT:</span>
                                <span className="text-white font-semibold">{waifu.stats.int}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">SPD:</span>
                                <span className="text-white font-semibold">{waifu.stats.spd}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">LCK:</span>
                                <span className="text-white font-semibold">{waifu.stats.lck}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Awaken Dialog */}
            {showAwakenDialog && waifu.owned && (
                <AwakenDialog
                    waifuId={waifu.waifu_id}
                    waifuName={waifu.name}
                    daphineBalance={daphineBalance}
                    isAwakened={waifu.is_awakened || false}
                    onAwakened={handleAwakened}
                    onClose={() => setShowAwakenDialog(false)}
                />
            )}
        </div>
    )
}
