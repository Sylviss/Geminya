import { useState, useEffect, useRef, useCallback } from 'react'
import { nwnlAcademyApi } from '../../api/client'

interface DailyClaimButtonProps {
    /** last_daily_reset timestamp from the user's status, used to determine initial state */
    lastDailyReset: number
    /** Called after a successful claim so the parent can refresh */
    onClaimed?: () => void
}

const UTC7_OFFSET = 7 * 3600 // seconds

function getSecondsUntilNextReset(lastResetTs: number): number {
    const nowSec = Math.floor(Date.now() / 1000)
    if (lastResetTs <= 0) return 0

    // Convert last reset to UTC+7 day boundary
    const lastResetUtc7 = lastResetTs + UTC7_OFFSET
    const dayStartUtc7 = lastResetUtc7 - (lastResetUtc7 % 86400)
    const nextResetUtc7 = dayStartUtc7 + 86400
    const nextResetUtc = nextResetUtc7 - UTC7_OFFSET

    const diff = nextResetUtc - nowSec
    return diff > 0 ? diff : 0
}

export default function DailyClaimButton({ lastDailyReset, onClaimed }: DailyClaimButtonProps) {
    const [state, setState] = useState<'available' | 'claiming' | 'claimed' | 'cooldown'>('cooldown')
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [earned, setEarned] = useState(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = s % 60
        if (h > 0) return `${h}h ${m}m`
        return `${m}m ${sec}s`
    }

    // Determine initial state from the lastDailyReset prop
    useEffect(() => {
        const remaining = getSecondsUntilNextReset(lastDailyReset)
        if (remaining > 0) {
            setState('cooldown')
            setSecondsLeft(remaining)
        } else {
            setState('available')
        }
    }, [lastDailyReset])

    // Countdown timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)

        if (state === 'cooldown' && secondsLeft > 0) {
            timerRef.current = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        setState('available')
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [state, secondsLeft > 0])

    const handleClaim = useCallback(async () => {
        if (state !== 'available') return
        setState('claiming')

        try {
            const { data } = await nwnlAcademyApi.claimDaily()
            if (data.claimed) {
                setState('claimed')
                setEarned(data.crystals_earned)
                // After a brief celebration, switch to cooldown with real time
                setTimeout(() => {
                    // Re-calculate from "now" since we just claimed
                    const nowSec = Math.floor(Date.now() / 1000)
                    const remaining = getSecondsUntilNextReset(nowSec)
                    setState('cooldown')
                    setSecondsLeft(remaining)
                    onClaimed?.()
                }, 2500)
            } else {
                // Server says already claimed
                setState('cooldown')
                setSecondsLeft(data.seconds_left || 0)
            }
        } catch {
            // On error, try to show cooldown
            setState('cooldown')
            const remaining = getSecondsUntilNextReset(Math.floor(Date.now() / 1000))
            setSecondsLeft(remaining > 0 ? remaining : 3600)
        }
    }, [state, onClaimed])

    if (state === 'claiming') {
        return (
            <div className="card p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30">
                <div className="flex items-center gap-3">
                    <div className="spinner" />
                    <p className="font-semibold text-amber-200">Claiming...</p>
                </div>
            </div>
        )
    }

    if (state === 'claimed') {
        return (
            <div className="card p-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30 animate-bounce-in">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                        <p className="font-bold text-emerald-300">Daily Claimed!</p>
                        <p className="text-sm text-white/70">+{earned} 💎 Sakura Crystals</p>
                    </div>
                </div>
            </div>
        )
    }

    if (state === 'cooldown') {
        return (
            <div className="card p-4 bg-white/5 border-white/10 opacity-75">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl opacity-50">🎁</span>
                        <div>
                            <p className="font-semibold text-white/60">Daily Reward</p>
                            <p className="text-xs text-white/40">Already claimed today</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-white/50">Next in</p>
                        <p className="font-mono font-bold text-amber-300">{formatTime(secondsLeft)}</p>
                    </div>
                </div>
            </div>
        )
    }

    // state === 'available'
    return (
        <button
            onClick={handleClaim}
            className="w-full card p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-3xl animate-pulse-glow">🎁</span>
                    <div className="text-left">
                        <p className="font-bold text-amber-200">Claim Daily Reward</p>
                        <p className="text-sm text-white/60">+500 💎 Sakura Crystals</p>
                    </div>
                </div>
                <span className="text-sm font-semibold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full">Claim</span>
            </div>
        </button>
    )
}
