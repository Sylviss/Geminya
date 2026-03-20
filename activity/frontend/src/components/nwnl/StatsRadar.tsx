import { useEffect, useRef } from 'react'

interface Stats {
    atk: number
    mag: number
    vit: number
    spr: number
    int: number
    spd: number
    lck: number
}

interface StatsRadarProps {
    stats: Stats
    className?: string
    size?: number
}

export default function StatsRadar({ stats, className = '', size = 300 }: StatsRadarProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const radius = Math.min(centerX, centerY) - 40

        // 7 stat axes (ATK, MAG, VIT, SPR, INT, SPD, LCK)
        const axes = [
            { label: 'ATK', value: stats.atk, angle: 0 },
            { label: 'MAG', value: stats.mag, angle: Math.PI * 2 / 7 },
            { label: 'VIT', value: stats.vit, angle: Math.PI * 4 / 7 },
            { label: 'SPR', value: stats.spr, angle: Math.PI * 6 / 7 },
            { label: 'INT', value: stats.int, angle: Math.PI * 8 / 7 },
            { label: 'SPD', value: stats.spd, angle: Math.PI * 10 / 7 },
            { label: 'LCK', value: stats.lck, angle: Math.PI * 12 / 7 },
        ]

        // Find max value for normalization
        const maxStat = Math.max(...Object.values(stats))
        const normalize = (value: number) => (value / maxStat) * radius

        // Draw background grid circles (20%, 40%, 60%, 80%, 100%)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 1
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath()
            ctx.arc(centerX, centerY, (radius / 5) * i, 0, Math.PI * 2)
            ctx.stroke()
        }

        // Draw axes lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 1
        axes.forEach(axis => {
            ctx.beginPath()
            ctx.moveTo(centerX, centerY)
            const x = centerX + Math.cos(axis.angle - Math.PI / 2) * radius
            const y = centerY + Math.sin(axis.angle - Math.PI / 2) * radius
            ctx.lineTo(x, y)
            ctx.stroke()
        })

        // Draw stat polygon
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)' // blue-500 with opacity
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()

        axes.forEach((axis, index) => {
            const r = normalize(axis.value)
            const x = centerX + Math.cos(axis.angle - Math.PI / 2) * r
            const y = centerY + Math.sin(axis.angle - Math.PI / 2) * r

            if (index === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })

        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Draw stat points
        ctx.fillStyle = 'rgba(59, 130, 246, 1)' // blue-500
        axes.forEach(axis => {
            const r = normalize(axis.value)
            const x = centerX + Math.cos(axis.angle - Math.PI / 2) * r
            const y = centerY + Math.sin(axis.angle - Math.PI / 2) * r

            ctx.beginPath()
            ctx.arc(x, y, 4, 0, Math.PI * 2)
            ctx.fill()
        })

        // Draw labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        axes.forEach(axis => {
            const labelRadius = radius + 25
            const x = centerX + Math.cos(axis.angle - Math.PI / 2) * labelRadius
            const y = centerY + Math.sin(axis.angle - Math.PI / 2) * labelRadius

            // Draw label
            ctx.fillText(axis.label, x, y)

            // Draw value below label
            ctx.font = '10px sans-serif'
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
            ctx.fillText(String(axis.value), x, y + 14)
            ctx.font = 'bold 12px sans-serif'
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        })
    }, [stats, size])

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="max-w-full"
            />
        </div>
    )
}
