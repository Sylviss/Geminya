interface CharacterCardProps {
    name: string
    series: string
    rarity: number
    currentStarLevel: number
    imageUrl?: string | null
    isNew?: boolean
    isDuplicate?: boolean
    shardsGained?: number
    quartzGained?: number
    upgradesPerformed?: { from_star: number; to_star: number }[]
    isAwakened?: boolean
    compact?: boolean
}

const RARITY_STYLES: Record<number, { border: string; glow: string; bg: string; label: string }> = {
    1: { border: 'border-gray-400/40', glow: '', bg: 'from-gray-500/10 to-gray-400/5', label: '1★' },
    2: { border: 'border-blue-400/60', glow: 'shadow-blue-500/20', bg: 'from-blue-500/15 to-cyan-500/10', label: '2★' },
    3: { border: 'border-yellow-400/80', glow: 'shadow-yellow-500/30', bg: 'from-yellow-500/20 to-amber-400/10', label: '3★' },
}

export default function CharacterCard({
    name,
    series,
    rarity,
    currentStarLevel,
    imageUrl,
    isNew,
    isDuplicate,
    shardsGained,
    quartzGained,
    upgradesPerformed,
    isAwakened,
    compact = false,
}: CharacterCardProps) {
    const style = RARITY_STYLES[rarity] ?? RARITY_STYLES[1]
    const stars = '⭐'.repeat(Math.min(currentStarLevel, 6))

    if (compact) {
        return (
            <div
                className={`relative rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} shadow-md ${style.glow} overflow-hidden`}
            >
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="w-full aspect-[3/4] object-cover object-top"
                        loading="lazy"
                    />
                )}
                {!imageUrl && (
                    <div className="w-full aspect-[3/4] flex items-center justify-center bg-white/5 text-4xl">
                        {'⭐'.repeat(rarity)}
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1.5">
                    <p className="text-xs font-bold text-white truncate">{name} {isAwakened && '🦋'}</p>
                    <p className="text-[10px] text-white/50 truncate">{series}</p>
                    <p className="text-[10px] text-yellow-300">{stars}</p>
                </div>
                {/* NEW badge */}
                {isNew && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        NEW
                    </div>
                )}
                {/* Rarity badge */}
                <div className={`absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rarity === 3 ? 'bg-yellow-500/90 text-black' : rarity === 2 ? 'bg-blue-500/90 text-white' : 'bg-gray-500/80 text-white'}`}>
                    {style.label}
                </div>
                {/* Upgrade flash */}
                {upgradesPerformed && upgradesPerformed.length > 0 && (
                    <div className="absolute inset-0 border-2 border-yellow-400/80 rounded-xl pointer-events-none animate-pulse" />
                )}
            </div>
        )
    }

    return (
        <div
            className={`rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} shadow-lg ${style.glow} p-3 space-y-2`}
        >
            {/* Image */}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-36 object-cover object-top rounded-lg"
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-36 flex items-center justify-center bg-white/5 rounded-lg text-5xl">
                    {'⭐'.repeat(rarity)}
                </div>
            )}

            {/* Name row */}
            <div className="flex items-start justify-between gap-1">
                <p className="font-bold text-sm text-white leading-tight">
                    {name} {isAwakened && <span className="text-amber-300">🦋</span>}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${rarity === 3 ? 'bg-yellow-500/90 text-black' : rarity === 2 ? 'bg-blue-500/90 text-white' : 'bg-gray-500/80 text-white'}`}>
                    {style.label}
                </span>
            </div>

            <p className="text-[11px] text-white/50 truncate">{series}</p>
            <p className="text-xs text-yellow-300">{stars}</p>

            {/* Result tags */}
            <div className="flex flex-wrap gap-1">
                {isNew && (
                    <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-1.5 py-0.5 rounded-full font-semibold">
                        ✨ NEW
                    </span>
                )}
                {isDuplicate && shardsGained !== undefined && shardsGained > 0 && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                        +{shardsGained} shards
                    </span>
                )}
                {isDuplicate && quartzGained !== undefined && quartzGained > 0 && (
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-full">
                        +{quartzGained} 💠
                    </span>
                )}
                {upgradesPerformed && upgradesPerformed.length > 0 && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                        ⬆ {upgradesPerformed[upgradesPerformed.length - 1].to_star}★
                    </span>
                )}
            </div>
        </div>
    )
}
