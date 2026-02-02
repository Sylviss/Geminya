import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { anidleApi } from '../api/client'
import DifficultySelector from '../components/common/DifficultySelector'
import SearchInput from '../components/common/SearchInput'

interface Comparison {
    title: string
    year: string
    score: string
    episodes: string
    genres: string
    studio: string
    source: string
    format: string
    season: string
    themes?: string
}

interface GameState {
    gameId: string
    guesses: { anime: any; comparison: Comparison }[]
    guessesRemaining: number
    isComplete: boolean
    isWon: boolean
    difficulty: string
    target?: {
        title: string
        year: number
        score: number
        episodes: number
        genres: string[]
        studios: string[]
        source: string
        format: string
        season: string
        themes: string[]
        image: string
    }
    duration?: number
}

const difficultyInfo: Record<string, { emoji: string; label: string; desc: string }> = {
    easy: { emoji: '🟢', label: 'Easy', desc: 'Popular & Well-known Anime' },
    normal: { emoji: '🟡', label: 'Normal', desc: 'Mixed Selection' },
    hard: { emoji: '🟠', label: 'Hard', desc: 'Obscure & Lesser-known' },
    expert: { emoji: '🔴', label: 'Expert', desc: 'Ultra Obscure' },
    crazy: { emoji: '🟣', label: 'Crazy', desc: 'Extremely Challenging' },
    insanity: { emoji: '⚫', label: 'Insanity', desc: 'Impossible Challenge' },
}

export default function Anidle() {
    const [difficulty, setDifficulty] = useState('normal')
    const [isLoading, setIsLoading] = useState(false)
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [searchValue, setSearchValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [showHowToPlay, setShowHowToPlay] = useState(false)
    const [expandedGuess, setExpandedGuess] = useState<number | null>(null)

    const startGame = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const userId = window.discordUser?.id || 'anonymous'
            const response = await anidleApi.start(userId, difficulty)
            setGameState({
                gameId: response.data.game_id,
                guesses: [],
                guessesRemaining: response.data.max_guesses,
                isComplete: false,
                isWon: false,
                difficulty: difficulty,
            })
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to start game')
        } finally {
            setIsLoading(false)
        }
    }

    const makeGuess = async () => {
        if (!gameState || !searchValue.trim()) return
        setIsLoading(true)
        setError(null)
        try {
            const response = await anidleApi.guess(gameState.gameId, searchValue)
            const data = response.data
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        guesses: [...prev.guesses, { anime: data.guess, comparison: data.comparison }],
                        guessesRemaining: data.guesses_remaining,
                        isComplete: data.is_complete,
                        isWon: data.is_won,
                        target: data.target,
                        duration: data.duration,
                    }
                    : null
            )
            setSearchValue('')
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to submit guess')
        } finally {
            setIsLoading(false)
        }
    }

    const giveUp = async () => {
        if (!gameState) return
        setIsLoading(true)
        try {
            const response = await anidleApi.giveUp(gameState.gameId)
            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        isComplete: true,
                        isWon: false,
                        target: response.data.target,
                        duration: response.data.duration,
                    }
                    : null
            )
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to give up')
        } finally {
            setIsLoading(false)
        }
    }

    const searchAnime = useCallback(async (query: string) => {
        if (!query || query.length < 2) return []
        try {
            const response = await anidleApi.search(query)
            return response.data.map((item: any) => ({ label: item.name, value: item.value }))
        } catch {
            return []
        }
    }, [])

    const getIndicatorClass = (value: string) => {
        if (value.includes('✅')) return 'indicator-correct'
        if (value.includes('⬆️') || value.includes('⬇️')) return 'indicator-partial'
        return 'indicator-wrong'
    }

    const extractText = (value: string) => value.replace(/[✅❌⬆️⬇️]/g, '').trim()

    const getIndicatorEmoji = (value: string) => {
        if (value.includes('✅')) return '✅'
        if (value.includes('⬆️')) return '⬆️'
        if (value.includes('⬇️')) return '⬇️'
        return '❌'
    }

    // Start screen
    if (!gameState) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">

                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        🎯 Anidle
                    </h1>
                    <p className="text-xl text-gray-300 mb-2">Guess the anime in 21 tries!</p>
                </div>

                <div className="card p-8 max-w-lg w-full animate-slide-up">
                    <h2 className="text-lg font-semibold mb-4 text-center">Select Difficulty</h2>
                    <DifficultySelector value={difficulty} onChange={setDifficulty} />

                    <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <span>ℹ️</span> How to Play
                        </h3>
                        <div className="text-sm text-gray-300 space-y-2">
                            <p>Guess the anime by comparing properties:</p>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-400">✅</span> Exact match
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-red-400">❌</span> No match
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-400">⬆️</span> Target is higher
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-400">⬇️</span> Target is lower
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={startGame}
                        disabled={isLoading}
                        className={`btn btn-primary w-full mt-6 text-lg ${isLoading ? 'btn-disabled' : ''}`}
                    >
                        {isLoading ? 'Starting...' : 'Start Game'}
                    </button>
                </div>
            </div>
        )
    }

    // Game complete screen
    if (gameState.isComplete) {
        const diff = difficultyInfo[gameState.difficulty] || difficultyInfo.normal
        const target = gameState.target

        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
                <div className="card p-6 sm:p-8 max-w-2xl w-full text-center animate-fade-in">
                    <div className="text-6xl sm:text-7xl mb-4">{gameState.isWon ? '🎉' : '💀'}</div>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                        {gameState.isWon ? 'Congratulations!' : 'Game Over!'}
                    </h1>
                    <p className="text-gray-400 mb-4">
                        {gameState.isWon
                            ? `You guessed it in ${gameState.guesses.length} tries!`
                            : 'Better luck next time!'}
                    </p>

                    <div className="inline-block px-4 py-2 bg-white/10 rounded-full text-sm mb-6">
                        {diff.emoji} {diff.label}
                    </div>

                    {target && (
                        <div className="text-left bg-white/5 rounded-lg p-4 sm:p-6 mb-6">
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                {target.image && (
                                    <img
                                        src={target.image}
                                        alt={target.title}
                                        className="w-32 sm:w-40 h-auto rounded-lg shadow-xl mx-auto sm:mx-0 flex-shrink-0"
                                    />
                                )}
                                <div className="flex-grow">
                                    <h2 className="text-xl sm:text-2xl font-bold text-anime-primary mb-3 text-center sm:text-left">
                                        {target.title}
                                    </h2>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-gray-400">Year:</span> {target.year || 'N/A'}</div>
                                        <div><span className="text-gray-400">Score:</span> {target.score}/10</div>
                                        <div><span className="text-gray-400">Episodes:</span> {target.episodes || 'N/A'}</div>
                                        <div><span className="text-gray-400">Format:</span> {target.format || 'N/A'}</div>
                                        <div><span className="text-gray-400">Source:</span> {target.source || 'N/A'}</div>
                                        <div><span className="text-gray-400">Season:</span> {target.season || 'N/A'}</div>
                                    </div>
                                    <div className="mt-3 text-sm">
                                        <span className="text-gray-400">Genres:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {target.genres?.map((g, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{g}</span>
                                            )) || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-sm">
                                        <span className="text-gray-400">Studios:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {target.studios?.map((s, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs">{s}</span>
                                            )) || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center gap-6 mb-6 p-4 bg-white/5 rounded-lg">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{gameState.guesses.length}</div>
                            <div className="text-xs text-gray-400">Guesses</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{gameState.duration || 0}s</div>
                            <div className="text-xs text-gray-400">Time</div>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setGameState(null)} className="btn btn-primary">
                            🔄 Play Again
                        </button>
                        <Link to="/" className="btn btn-secondary">
                            🏠 Home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Active game screen
    const diff = difficultyInfo[gameState.difficulty] || difficultyInfo.normal

    return (
        <div className="min-h-screen p-4 pb-8">
            {/* Header */}
            <div className="text-center pt-10 sm:pt-12 mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">🎯 Anidle</h1>
                <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
                    <span className="px-3 py-1 bg-white/10 rounded-full">
                        {diff.emoji} {diff.label}
                    </span>
                    <span className="text-gray-400">
                        Remaining:{' '}
                        <span className={`font-bold ${gameState.guessesRemaining <= 5 ? 'text-red-400' : 'text-white'}`}>
                            {gameState.guessesRemaining}
                        </span>
                    </span>
                </div>
            </div>

            {/* Legend Toggle */}
            <div className="max-w-4xl mx-auto mb-3">
                <button
                    onClick={() => setShowHowToPlay(!showHowToPlay)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                    {showHowToPlay ? '▼ Hide Legend' : '▶ Show Legend'}
                </button>
                {showHowToPlay && (
                    <div className="mt-2 p-3 bg-white/5 rounded-lg text-xs grid grid-cols-4 gap-2">
                        <span><span className="text-green-400">✅</span> Match</span>
                        <span><span className="text-red-400">❌</span> Wrong</span>
                        <span><span className="text-yellow-400">⬆️</span> Higher</span>
                        <span><span className="text-yellow-400">⬇️</span> Lower</span>
                    </div>
                )}
            </div>

            {/* Guess History - Card Layout */}
            <div className="max-w-4xl mx-auto space-y-2 mb-6">
                {gameState.guesses.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        <p className="text-lg">No guesses yet</p>
                        <p className="text-sm">Start typing an anime name below!</p>
                    </div>
                )}
                {gameState.guesses.map((guess, index) => (
                    <div
                        key={index}
                        className="card p-3 animate-slide-up cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => setExpandedGuess(expandedGuess === index ? null : index)}
                    >
                        {/* Compact view */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm flex-shrink-0">
                                #{index + 1}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getIndicatorClass(guess.comparison.title)}`}>
                                {extractText(guess.comparison.title)}
                            </span>
                            <div className="flex gap-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs ${getIndicatorClass(guess.comparison.year)}`}>
                                    {getIndicatorEmoji(guess.comparison.year)} {extractText(guess.comparison.year)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${getIndicatorClass(guess.comparison.score)}`}>
                                    {getIndicatorEmoji(guess.comparison.score)} {extractText(guess.comparison.score)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${getIndicatorClass(guess.comparison.episodes)}`}>
                                    {getIndicatorEmoji(guess.comparison.episodes)} {extractText(guess.comparison.episodes)} eps
                                </span>
                            </div>
                            <span className="text-gray-500 text-xs ml-auto">
                                {expandedGuess === index ? '▲' : '▼'}
                            </span>
                        </div>

                        {/* Expanded view */}
                        {expandedGuess === index && (
                            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                    <span className="text-gray-400 block mb-1">Format</span>
                                    <span className={`inline-block px-2 py-1 rounded ${getIndicatorClass(guess.comparison.format)}`}>
                                        {getIndicatorEmoji(guess.comparison.format)} {extractText(guess.comparison.format)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block mb-1">Source</span>
                                    <span className={`inline-block px-2 py-1 rounded ${getIndicatorClass(guess.comparison.source)}`}>
                                        {getIndicatorEmoji(guess.comparison.source)} {extractText(guess.comparison.source)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block mb-1">Season</span>
                                    <span className={`inline-block px-2 py-1 rounded ${getIndicatorClass(guess.comparison.season)}`}>
                                        {getIndicatorEmoji(guess.comparison.season)} {extractText(guess.comparison.season)}
                                    </span>
                                </div>
                                <div className="col-span-2 sm:col-span-3">
                                    <span className="text-gray-400 block mb-1">Genres</span>
                                    <div className="flex flex-wrap gap-1">
                                        {extractText(guess.comparison.genres).split(',').map((genre, i) => {
                                            const trimmed = genre.trim()
                                            return (
                                                <span key={i} className={`px-2 py-0.5 rounded ${trimmed.includes('✅') ? 'indicator-correct' : 'indicator-wrong'}`}>
                                                    {trimmed.replace('✅', '').replace('❌', '').trim()}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-3">
                                    <span className="text-gray-400 block mb-1">Studio</span>
                                    <span className={`inline-block px-2 py-1 rounded ${getIndicatorClass(guess.comparison.studio)}`}>
                                        {extractText(guess.comparison.studio)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Input Area - Part of page content */}
            <div className="max-w-2xl mx-auto mb-8">
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="card p-4">
                    <div className="flex gap-3">
                        <div className="flex-grow">
                            <SearchInput
                                value={searchValue}
                                onChange={setSearchValue}
                                onSearch={searchAnime}
                                placeholder="Type anime name..."
                                onSelect={(value) => setSearchValue(value)}
                                dropUp={false}
                            />
                        </div>
                        <button
                            onClick={makeGuess}
                            disabled={isLoading || !searchValue.trim()}
                            className={`btn btn-primary px-6 ${isLoading || !searchValue.trim() ? 'btn-disabled' : ''}`}
                        >
                            {isLoading ? '...' : 'Guess'}
                        </button>
                        <button onClick={giveUp} disabled={isLoading} className="btn btn-danger px-4">
                            Give Up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
