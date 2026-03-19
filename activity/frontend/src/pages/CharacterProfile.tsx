import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { nwnlCollectionApi, nwnlAcademyApi } from '../api/client'
import StatsRadar from '../components/nwnl/StatsRadar'
import AwakenDialog from '../components/nwnl/AwakenDialog'

interface CharacterData {
    waifu_id: number
    name: string
    series: string
    series_id: number
    image_url: string | null
    rarity: number
    archetype: string
    elements: string[]
    stats: {
        atk?: number
        mag?: number
        vit?: number
        spr?: number
        int?: number
        spd?: number
        lck?: number
    }
    current_star_level: number
    character_shards: number
    is_awakened: boolean
    obtained_at: string
    can_upgrade: boolean
    shards_needed_for_upgrade: number
    is_max_star: boolean
}

export default function CharacterProfile() {
    const { waifuId } = useParams<{ waifuId: string }>()
    const navigate = useNavigate()
    const [character, setCharacter] = useState<CharacterData | null>(null)
    const [daphineBalance, setDaphineBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAwakenDialog, setShowAwakenDialog] = useState(false)

    useEffect(() => {
        if (!waifuId) return
        loadCharacter()
        loadDaphineBalance()
    }, [waifuId])

    const loadCharacter = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await nwnlCollectionApi.getCharacterProfile(Number(waifuId))
            setCharacter(data)
        } catch (err: any) {
            console.error('Failed to load character:', err)
            setError(err?.response?.data?.detail || 'Failed to load character')
        } finally {
            setLoading(false)
        }
    }

    const loadDaphineBalance = async () => {
        try {
            const { data } = await nwnlAcademyApi.status()
            setDaphineBalance(data.daphine || 0)
        } catch (err) {
            console.error('Failed to load daphine balance:', err)
        }
    }

    const handleAwakened = () => {
        setShowAwakenDialog(false)
        loadCharacter()
        loadDaphineBalance()
    }

    if (loading) {
        return (
            <div className="container py-6">
                <div className="card p-6 animate-pulse">
                    <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
                    <div className="h-64 bg-white/10 rounded" />
                </div>
            </div>
        )
    }

    if (error || !character) {
        return (
            <div className="container py-6">
                <div className="card p-6">
                    <p className="text-red-400">{error || 'Character not found'}</p>
                    <button onClick={() => navigate('/collection')} className="btn btn-primary mt-4">
                        ← Back to Collection
                    </button>
                </div>
            </div>
        )
    }

    const stars = '⭐'.repeat(Math.min(character.current_star_level, 6))
    const rarityColors = {
        1: 'from-gray-600 to-gray-800',
        2: 'from-green-600 to-green-800',
        3: 'from-blue-600 to-blue-800',
        4: 'from-purple-600 to-purple-800',
    }
    const bgGradient = rarityColors[character.rarity as keyof typeof rarityColors] || rarityColors[1]

    return (
        <div className="container py-6 space-y-4">
            {/* Header */}
            <button onClick={() => navigate('/collection')} className="btn text-sm">
                ← Back to Collection
            </button>

            {/* Character Card */}
            <div className={`card overflow-hidden bg-gradient-to-br ${bgGradient}`}>
                <div className="p-6 space-y-4">
                    {/* Name & Stars */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                {character.name}
                                {character.is_awakened && <span className="text-3xl">🦋</span>}
                            </h1>
                            <p className="text-white/60 text-sm">{character.series}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl">{stars}</div>
                            <p className="text-xs text-white/60">Level {character.current_star_level}</p>
                        </div>
                    </div>

                    {/* Image */}
                    {character.image_url && (
                        <div className="flex justify-center">
                            <img
                                src={character.image_url}
                                alt={character.name}
                                className="max-h-64 rounded-lg border-2 border-white/20"
                            />
                        </div>
                    )}

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/20 rounded-lg p-3">
                            <p className="text-xs text-white/60 mb-1">Archetype</p>
                            <p className="text-sm font-semibold text-white">{character.archetype}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                            <p className="text-xs text-white/60 mb-1">Elements</p>
                            <p className="text-sm font-semibold text-white">{character.elements.join(', ')}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                            <p className="text-xs text-white/60 mb-1">Shards</p>
                            <p className="text-sm font-semibold text-white">
                                {character.character_shards}
                                {!character.is_max_star && (
                                    <span className="text-xs text-white/50 ml-1">
                                        / {character.shards_needed_for_upgrade + character.character_shards} to upgrade
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                            <p className="text-xs text-white/60 mb-1">Status</p>
                            <p className="text-sm font-semibold text-white">
                                {character.is_max_star ? '✨ Max Star' : character.can_upgrade ? '⬆️ Can Upgrade' : '🔒 Locked'}
                            </p>
                        </div>
                    </div>

                    {/* Awaken Button */}
                    {!character.is_awakened && (
                        <button
                            onClick={() => setShowAwakenDialog(true)}
                            disabled={daphineBalance < 1}
                            className="btn btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            🦋 Awaken (1 Daphine) {daphineBalance < 1 && '— Need more Daphine'}
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Radar */}
            <div className="card p-6">
                <h2 className="text-lg font-bold text-white mb-4">Stats</h2>
                <StatsRadar stats={character.stats} size={280} />
            </div>

            {/* Awaken Dialog */}
            {showAwakenDialog && (
                <AwakenDialog
                    waifuId={character.waifu_id}
                    waifuName={character.name}
                    daphineBalance={daphineBalance}
                    isAwakened={character.is_awakened}
                    onAwakened={handleAwakened}
                    onClose={() => setShowAwakenDialog(false)}
                />
            )}
        </div>
    )
}
