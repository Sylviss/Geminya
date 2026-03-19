import { useMemo } from 'react'

interface StatsRadarProps {
    stats: {
        atk?: number
        mag?: number
        vit?: number
        spr?: number
        int?: number
        spd?: number
        lck?: number
    }
    size?: number
}

export default function StatsRadar({ stats, size = 200 }: StatsRadarProps) {
    const statNames = ['ATK', 'MAG', 'VIT', 'SPR', 'INT', 'SPD', 'LCK']
    const statKeys = ['atk', 'mag', 'vit', 'spr', 'int', 'spd', 'lck'] as const
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fd79a8', '#a29bfe']

    const maxStat = 100
    const center = size / 2
    const radius = size / 2 - 30

    // Calculate polygon points for the stat values
    const points = useMemo(() => {
        return statKeys.map((key, i) => {
            const angle = (Math.PI * 2 * i) / statKeys.length - Math.PI / 2
            const value = stats[key] || 0
            const distance = (value / maxStat) * radius
            const x = center + Math.cos(angle) * distance
            const y = center + Math.sin(angle) * distance
            return `${x},${y}`
        }).join(' ')
    }, [stats, center, radius])

    // Calculate axis lines (from center to max value)
    const axes = useMemo(() => {
        return statKeys.map((_, i) => {
            const angle = (Math.PI * 2 * i) / statKeys.length - Math.PI / 2
            const x2 = center + Math.cos(angle) * radius
            const y2 = center + Math.sin(angle) * radius
            return { x1: center, y1: center, x2, y2 }
        })
    }, [center, radius])

    // Calculate label positions (slightly outside the axes)
    const labels = useMemo(() => {
        return statNames.map((name, i) => {
            const angle = (Math.PI * 2 * i) / statNames.length - Math.PI / 2
            const labelRadius = radius + 20
            const x = center + Math.cos(angle) * labelRadius
            const y = center + Math.sin(angle) * labelRadius
            const value = stats[statKeys[i]] || 0
            return { name, value, x, y, color: colors[i] }
        })
    }, [stats, center, radius])

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} className="drop-shadow-lg">
                {/* Grid circles */}
                {[0.25, 0.5, 0.75, 1].map((fraction) => (
                    <circle
                        key={fraction}
                        cx={center}
                        cy={center}
                        r={radius * fraction}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="1"
                    />
                ))}

                {/* Axes */}
                {axes.map((axis, i) => (
                    <line
                        key={i}
                        x1={axis.x1}
                        y1={axis.y1}
                        x2={axis.x2}
                        y2={axis.y2}
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="1"
                    />
                ))}

                {/* Stat polygon */}
                <polygon
                    points={points}
                    fill="rgba(147, 51, 234, 0.3)"
                    stroke="rgba(147, 51, 234, 0.8)"
                    strokeWidth="2"
                />

                {/* Stat points */}
                {statKeys.map((key, i) => {
                    const angle = (Math.PI * 2 * i) / statKeys.length - Math.PI / 2
                    const value = stats[key] || 0
                    const distance = (value / maxStat) * radius
                    const x = center + Math.cos(angle) * distance
                    const y = center + Math.sin(angle) * distance
                    return (
                        <circle
                            key={key}
                            cx={x}
                            cy={y}
                            r="4"
                            fill={colors[i]}
                            stroke="white"
                            strokeWidth="1.5"
                        />
                    )
                })}

                {/* Labels */}
                {labels.map((label, i) => (
                    <text
                        key={i}
                        x={label.x}
                        y={label.y}
                        fill="white"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="select-none"
                    >
                        {label.name}
                    </text>
                ))}
            </svg>

            {/* Stat values legend */}
            <div className="grid grid-cols-4 gap-x-4 gap-y-1 mt-3 text-xs">
                {labels.map((label, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: label.color }}
                        />
                        <span className="text-white/60">{label.name}</span>
                        <span className="text-white/90 font-semibold ml-auto">{label.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
