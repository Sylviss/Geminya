import CharacterCard from './CharacterCard'

interface PullResult {
    waifu: {
        waifu_id: number
        name: string
        series: string
        rarity: number
        image_url?: string | null
        is_awakened?: boolean
    }
    rarity: number
    is_new: boolean
    is_duplicate: boolean
    current_star_level: number
    shards_gained: number
    quartz_gained: number
    upgrades_performed: { from_star: number; to_star: number }[]
}

interface SummonResultsProps {
    pulls: PullResult[]
    currencyType: string
    totalCost: number
    currencyRemaining: number
    daphineGained: number
    onClose: () => void
}

const CURRENCY_EMOJI: Record<string, string> = {
    sakura_crystals: '💎',
    quartzs: '💠',
    daphine: '🦋',
}

export default function SummonResults({
    pulls,
    currencyType,
    totalCost,
    currencyRemaining,
    daphineGained,
    onClose,
}: SummonResultsProps) {
    const threeStars = pulls.filter(p => p.rarity >= 3)
    const twoStars = pulls.filter(p => p.rarity === 2)
    const newChars = pulls.filter(p => p.is_new)
    const emoji = CURRENCY_EMOJI[currencyType] ?? '💰'

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 bg-white/5 rounded-xl p-3 text-xs">
                <span className="font-semibold text-white/70">10x Results</span>
                {threeStars.length > 0 && (
                    <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-1 rounded-full">
                        {threeStars.length}× 3★
                    </span>
                )}
                {twoStars.length > 0 && (
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded-full">
                        {twoStars.length}× 2★
                    </span>
                )}
                {newChars.length > 0 && (
                    <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-1 rounded-full">
                        {newChars.length} NEW
                    </span>
                )}
                <span className="ml-auto text-white/40">
                    {emoji} −{totalCost} → {currencyRemaining.toLocaleString()} left
                </span>
                {daphineGained > 0 && (
                    <span className="text-amber-300">+{daphineGained} 🦋</span>
                )}
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-5 gap-2">
                {pulls.map((pull, i) => (
                    <CharacterCard
                        key={i}
                        name={pull.waifu.name}
                        series={pull.waifu.series}
                        rarity={pull.rarity}
                        currentStarLevel={pull.current_star_level}
                        imageUrl={pull.waifu.image_url}
                        isNew={pull.is_new}
                        isDuplicate={pull.is_duplicate}
                        shardsGained={pull.shards_gained}
                        quartzGained={pull.quartz_gained}
                        upgradesPerformed={pull.upgrades_performed}
                        isAwakened={pull.waifu.is_awakened}
                        compact
                    />
                ))}
            </div>

            {/* Close button */}
            <div className="flex justify-center">
                <button onClick={onClose} className="btn btn-primary px-8">
                    Close
                </button>
            </div>
        </div>
    )
}
