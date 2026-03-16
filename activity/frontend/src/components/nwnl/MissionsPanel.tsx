import { useState, useEffect } from 'react'
import { nwnlAcademyApi } from '../../api/client'

interface Mission {
    id: number
    name: string
    description: string
    target_count: number
    current_progress: number
    completed: boolean
    claimed: boolean
    reward_type: string
    reward_amount: number
}

export default function MissionsPanel({ onMissionClaimed }: { onMissionClaimed?: () => void }) {
    const [missions, setMissions] = useState<Mission[]>([])
    const [loading, setLoading] = useState(true)
    const [claimingId, setClaimingId] = useState<number | null>(null)

    useEffect(() => { loadMissions() }, [])

    const loadMissions = async () => {
        try {
            const { data } = await nwnlAcademyApi.getMissions()
            setMissions(data.missions)
        } catch (err) {
            console.error('Failed to load missions:', err)
        } finally {
            setLoading(false)
        }
    }

    const claimMission = async (missionId: number) => {
        setClaimingId(missionId)
        try {
            await nwnlAcademyApi.claimMission(missionId)
            setMissions(prev =>
                prev.map(m => m.id === missionId ? { ...m, claimed: true } : m)
            )
            onMissionClaimed?.()
        } catch (err) {
            console.error('Failed to claim mission:', err)
        } finally {
            setClaimingId(null)
        }
    }

    if (loading) {
        return (
            <div className="card p-4 space-y-3">
                <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                ))}
            </div>
        )
    }

    if (!missions.length) {
        return (
            <div className="card p-6 text-center">
                <span className="text-3xl mb-2 block">📋</span>
                <p className="text-white/50">No active daily missions</p>
            </div>
        )
    }

    return (
        <div className="card p-4">
            <h3 className="font-bold text-white/90 mb-3 flex items-center gap-2">
                <span>📅</span> Daily Missions
            </h3>
            <div className="space-y-2">
                {missions.map(m => (
                    <MissionRow
                        key={m.id}
                        mission={m}
                        claiming={claimingId === m.id}
                        onClaim={() => claimMission(m.id)}
                    />
                ))}
            </div>
        </div>
    )
}

function MissionRow({ mission, claiming, onClaim }: { mission: Mission; claiming: boolean; onClaim: () => void }) {
    const pct = Math.min((mission.current_progress / mission.target_count) * 100, 100)
    const statusBadge = mission.claimed
        ? { text: '✅ Claimed', cls: 'text-emerald-300 bg-emerald-500/20' }
        : mission.completed
          ? { text: '🎁 Claim', cls: 'text-amber-300 bg-amber-500/20 cursor-pointer hover:bg-amber-500/30' }
          : { text: `${mission.current_progress}/${mission.target_count}`, cls: 'text-white/50 bg-white/10' }

    return (
        <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3 transition-colors hover:bg-white/[0.08]">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/90 truncate">{mission.name}</p>
                <p className="text-xs text-white/50 truncate">{mission.description}</p>
                <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${mission.completed ? 'bg-emerald-400' : 'bg-purple-400'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-white/40">{mission.reward_amount} {mission.reward_type}</span>
                <button
                    onClick={mission.completed && !mission.claimed ? onClaim : undefined}
                    disabled={!mission.completed || mission.claimed || claiming}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${statusBadge.cls} ${claiming ? 'animate-pulse' : ''}`}
                >
                    {claiming ? '...' : statusBadge.text}
                </button>
            </div>
        </div>
    )
}
