interface CurrencyDisplayProps {
    sakuraCrystals: number
    quartzs: number
    daphine: number
    pityCounter: number
    guaranteed3StarIn: number
}

export default function CurrencyDisplay({ sakuraCrystals, quartzs, daphine, pityCounter, guaranteed3StarIn }: CurrencyDisplayProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <CurrencyCard icon="💎" label="Sakura Crystals" value={sakuraCrystals.toLocaleString()} color="from-purple-500/20 to-pink-500/20" />
            <CurrencyCard icon="💠" label="Quartzs" value={quartzs.toLocaleString()} color="from-cyan-500/20 to-blue-500/20" />
            <CurrencyCard icon="🦋" label="Daphine" value={daphine.toString()} color="from-amber-500/20 to-orange-500/20" />
            <CurrencyCard icon="🎰" label="Pity Counter" value={`${pityCounter}/50`} color="from-emerald-500/20 to-teal-500/20" />
            <CurrencyCard icon="⭐" label="Next 3★ in" value={`${guaranteed3StarIn} pulls`} color="from-yellow-500/20 to-amber-500/20" />
        </div>
    )
}

function CurrencyCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
    return (
        <div className={`card p-3 bg-gradient-to-br ${color} flex items-center gap-3 transition-transform hover:scale-105`}>
            <span className="text-2xl">{icon}</span>
            <div className="min-w-0">
                <p className="text-[11px] text-white/60 truncate">{label}</p>
                <p className="text-sm font-bold text-white truncate">{value}</p>
            </div>
        </div>
    )
}
