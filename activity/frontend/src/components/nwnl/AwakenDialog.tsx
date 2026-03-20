import { useState } from 'react'
import { nwnlCollectionApi } from '../../api/client'

interface AwakenDialogProps {
    waifuId: number
    waifuName: string
    daphineBalance: number
    isAwakened: boolean
    onAwakened: () => void
    onClose: () => void
}

export default function AwakenDialog({
    waifuId,
    waifuName,
    daphineBalance,
    isAwakened,
    onAwakened,
    onClose,
}: AwakenDialogProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const handleAwaken = async () => {
        setLoading(true)
        setError(null)
        try {
            await nwnlCollectionApi.awaken(waifuId)
            setDone(true)
            onAwakened()
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Awaken failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="card p-6 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
                {done ? (
                    <>
                        <div className="text-center space-y-2">
                            <span className="text-5xl block">🦋</span>
                            <h2 className="text-xl font-bold text-amber-300">{waifuName} Awakened!</h2>
                            <p className="text-sm text-white/60">
                                She has reached her true potential.
                            </p>
                        </div>
                        <button onClick={onClose} className="btn btn-primary w-full">
                            Close
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-center space-y-1">
                            <span className="text-4xl block">🦋</span>
                            <h2 className="text-lg font-bold text-white">Awaken {waifuName}?</h2>
                            <p className="text-sm text-white/60">
                                Awakening costs <span className="text-amber-300 font-semibold">1 Daphine 🦋</span> and permanently unlocks her awakened form.
                            </p>
                            <p className="text-xs text-white/40">
                                Your balance: <span className="text-amber-300">{daphineBalance} 🦋</span>
                            </p>
                        </div>

                        {isAwakened && (
                            <p className="text-center text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                                Already awakened!
                            </p>
                        )}

                        {error && (
                            <p className="text-center text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                                {error}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="btn flex-1 bg-white/10 hover:bg-white/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAwaken}
                                disabled={loading || isAwakened || daphineBalance < 1}
                                className="btn btn-primary flex-1 disabled:opacity-40"
                            >
                                {loading ? '✨ Awakening...' : '🦋 Awaken'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
