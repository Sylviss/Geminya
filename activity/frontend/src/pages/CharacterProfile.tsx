import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { nwnlAcademyApi, nwnlCollectionApi } from '../api/client'
import CharacterCard from '../components/nwnl/CharacterCard'
import AwakenDialog from '../components/nwnl/AwakenDialog'
import StatsRadar from '../components/nwnl/StatsRadar'

interface CharacterProfileData {
    waifu_id: number
    name: string
    series: string
    image_url?: string | null
    rarity: number
    current_star_level: number
    character_shards: number
    shards_needed_for_upgrade: number
    can_upgrade: boolean
    is_max_star: boolean
    is_awakened: boolean
    elements: string
    archetype: string
    stats_power: number
    stats: Record<string, number>
    next_star_level: number | null
}

export default function CharacterProfile() {
    const { waifuId } = useParams()
    const parsedId = Number(waifuId)

    const [profile, setProfile] = useState<CharacterProfileData | null>(null)
    const [daphine, setDaphine] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAwaken, setShowAwaken] = useState(false)

    const load = useCallback(async () => {
        if (!parsedId) return
        setLoading(true)
        try {
            const [pRes, aRes] = await Promise.all([
                nwnlCollectionApi.getWaifu(parsedId),
                nwnlAcademyApi.status(),
            ])
            setProfile(pRes.data)
            setDaphine(aRes.data?.daphine ?? 0)
            setError(null)
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to load character profile')
        } finally {
            setLoading(false)
        }
    }, [parsedId])

    useEffect(() => { load() }, [load])

    if (loading) {
        return <div className="p-6 max-w-5xl mx-auto"><div className="h-48 bg-white/5 rounded-xl animate-pulse" /></div>
    }

    if (error || !profile) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="card p-6 text-center">
                    <p className="text-red-300">{error || 'Character not found'}</p>
                    <Link to="/collection" className="btn btn-primary mt-4 inline-flex">Back to Collection</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
                <Link to="/collection" className="btn text-xs bg-white/10 hover:bg-white/20">← Back</Link>
                <h1 className="text-xl sm:text-2xl font-bold gradient-text from-cyan-300 to-blue-400">Character Profile</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                    <CharacterCard
                        name={profile.name}
                        series={profile.series}
                        rarity={profile.rarity}
                        currentStarLevel={profile.current_star_level}
                        imageUrl={profile.image_url}
                        isAwakened={profile.is_awakened}
                    />
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="card p-4">
                        <h2 className="font-bold text-white mb-2">Overview</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <Info label="Series" value={profile.series} />
                            <Info label="Element" value={profile.elements} />
                            <Info label="Archetype" value={profile.archetype} />
                            <Info label="Power" value={String(profile.stats_power)} />
                            <Info label="Shards" value={`${profile.character_shards}`} />
                            <Info label="Next Upgrade" value={profile.is_max_star ? 'Maxed' : `${profile.shards_needed_for_upgrade} needed`} />
                        </div>
                    </div>

                    <StatsRadar stats={profile.stats || {}} />

                    <div className="card p-4 flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowAwaken(true)}
                            disabled={profile.is_awakened || daphine < 1}
                            className="btn btn-primary text-sm disabled:opacity-40"
                        >
                            🦋 Awaken (1 Daphine)
                        </button>
                        <div className="text-xs text-white/60 self-center">Daphine balance: <span className="text-amber-300">{daphine}</span></div>
                    </div>
                </div>
            </div>

            {showAwaken && (
                <AwakenDialog
                    waifuId={profile.waifu_id}
                    waifuName={profile.name}
                    daphineBalance={daphine}
                    isAwakened={profile.is_awakened}
                    onAwakened={() => {
                        setShowAwaken(false)
                        load()
                    }}
                    onClose={() => setShowAwaken(false)}
                />
            )}
        </div>
    )
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white/5 rounded p-2">
            <p className="text-white/40">{label}</p>
            <p className="text-white font-semibold">{value}</p>
        </div>
    )
}
