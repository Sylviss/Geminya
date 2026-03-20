interface RarityBadgeProps {
    rarity: number
    className?: string
}

export default function RarityBadge({ rarity, className = '' }: RarityBadgeProps) {
    const rarityColors: Record<number, string> = {
        1: 'text-gray-400',
        2: 'text-blue-400',
        3: 'text-amber-400',
    }

    const stars = '★'.repeat(rarity)
    const color = rarityColors[rarity] || 'text-gray-400'

    return (
        <span className={`font-bold ${color} ${className}`}>
            {stars}
        </span>
    )
}
