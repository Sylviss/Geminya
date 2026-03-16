import { useState, useEffect, useRef } from 'react'
import { nwnlAcademyApi } from '../../api/client'

export default function DailyClaimButton() {
    const [state, setState] = useState<'loading' | 'available' | 'claimed' | 'cooldown'>('loading')
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [earned, setEarned] = useState(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        return `${h}h ${m}m`
    }

    const handleClaim = async () => {
        try {
            const { data } = await nwnlAcademyApi.claimDaily()
            if (data.claimed) {
                setState('claimed')
                setEarned(data.crystals_earned)
                setTimeout(() => {
                    setState('cooldown')
                    setSecondsLeft(24 * 3600)
                }, 3000)
            } else {
                setState('cooldown')
                setSecondsLeft(data.seconds_left)
            }
        } catch {
            setState('cooldown')
        }
    }

    useEffect(() => {
        // Mark as available on mount — actual claim check is server-side
        setState('available')
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    useEffect(() => {
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
            return () => { if (timerRef.current) clearInterval(timerRef.current) }
        }
    }, [state, secondsLeft])

    if (state === 'loading') {
        return (
            <div className="card p-4 animate-pulse">
                <div className="h-12 bg-white/10 rounded-lg" />
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
