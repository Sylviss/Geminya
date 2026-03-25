interface StatsRadarProps {
    stats: Record<string, number>
    size?: number
}

const AXES: Array<{ key: string; label: string }> = [
    { key: 'atk', label: 'ATK' },
    { key: 'mag', label: 'MAG' },
    { key: 'vit', label: 'VIT' },
    { key: 'spr', label: 'SPR' },
    { key: 'int', label: 'INT' },
    { key: 'spd', label: 'SPD' },
    { key: 'lck', label: 'LCK' },
]

export default function StatsRadar({ stats, size = 260 }: StatsRadarProps) {
    const center = size / 2
    const radius = size * 0.34
    const values = AXES.map((axis) => Number(stats[axis.key] ?? 0))
    const maxValue = Math.max(1, ...values)

    const pointFor = (index: number, valueRatio: number) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2) / AXES.length
        const r = radius * valueRatio
        return {
            x: center + Math.cos(angle) * r,
            y: center + Math.sin(angle) * r,
        }
    }

    const polygonPoints = values
        .map((value, i) => {
            const p = pointFor(i, value / maxValue)
            return `${p.x},${p.y}`
        })
        .join(' ')

    const rings = [0.25, 0.5, 0.75, 1]

    return (
        <div className="card p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Stat Radar</h3>
            <svg width={size} height={size} className="mx-auto" viewBox={`0 0 ${size} ${size}`}>
                {rings.map((ring) => {
                    const points = AXES.map((_, i) => {
                        const p = pointFor(i, ring)
                        return `${p.x},${p.y}`
                    }).join(' ')
                    return (
                        <polygon
                            key={ring}
                            points={points}
                            fill="none"
                            stroke="rgba(255,255,255,0.14)"
                            strokeWidth="1"
                        />
                    )
                })}

                {AXES.map((axis, i) => {
                    const p = pointFor(i, 1)
                    return (
                        <line
                            key={axis.key}
                            x1={center}
                            y1={center}
                            x2={p.x}
                            y2={p.y}
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth="1"
                        />
                    )
                })}

                <polygon
                    points={polygonPoints}
                    fill="rgba(56, 189, 248, 0.28)"
                    stroke="rgba(125, 211, 252, 0.95)"
                    strokeWidth="2"
                />

                {AXES.map((axis, i) => {
                    const p = pointFor(i, 1.16)
                    return (
                        <g key={axis.key}>
                            <text
                                x={p.x}
                                y={p.y}
                                fill="rgba(255,255,255,0.75)"
                                fontSize="10"
                                textAnchor="middle"
                                dominantBaseline="middle"
                            >
                                {axis.label}
                            </text>
                        </g>
                    )
                })}
            </svg>
            <div className="grid grid-cols-4 gap-2 mt-3 text-[11px] text-white/70">
                {AXES.map((axis) => (
                    <div key={axis.key} className="bg-white/5 rounded px-2 py-1 text-center">
                        <span className="text-white/40">{axis.label}</span> {Number(stats[axis.key] ?? 0)}
                    </div>
                ))}
            </div>
        </div>
    )
}
