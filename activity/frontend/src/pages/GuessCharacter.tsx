import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { guessCharacterApi } from '../api/client'
import DifficultySelector from '../components/common/DifficultySelector'
import SearchInput from '../components/common/SearchInput'

interface GameState {
    gameId: string
    characterImage: string
    isComplete: boolean
    isWon: boolean
    difficulty: string
    result?: {
        characterCorrect: boolean
        animeCorrect: boolean
    }
    target?: {
        characterName: string
        characterImage: string
        animeTitle: string
        animeYear: number
    }
    duration?: number
}

const difficultyInfo = {
    easy: { emoji: '🟢', label: 'Easy', desc: 'Popular Characters' },
    normal: { emoji: '🟡', label: 'Normal', desc: 'Mixed Selection' },
    hard: { emoji: '🟠', label: 'Hard', desc: 'Obscure Characters' },
    expert: { emoji: '🔴', label: 'Expert', desc: 'Very Obscure' },
    crazy: { emoji: '🟣', label: 'Crazy', desc: 'Extremely Obscure' },
    insanity: { emoji: '⚫', label: 'Insanity', desc: 'Impossible' },
}

export default function GuessCharacter() {
    const [difficulty, setDifficulty] = useState('normal')
    const [isLoading, setIsLoading] = useState(false)
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [characterName, setCharacterName] = useState('')
    const [animeName, setAnimeName] = useState('')
    const [error, setError] = useState<string | null>(null)

    const startGame = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const userId = window.discordUser?.id || 'anonymous'
            const response = await guessCharacterApi.start(userId, difficulty)
            setGameState({
                gameId: response.data.game_id,
                characterImage: response.data.character_image,
                isComplete: false,
                isWon: false,
                difficulty: difficulty,
            })
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to start game. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const makeGuess = async () => {
        if (!gameState || !characterName.trim() || !animeName.trim()) return

        setIsLoading(true)
        setError(null)
        try {
            const response = await guessCharacterApi.guess(gameState.gameId, characterName, animeName)
            const data = response.data

            setGameState((prev) =>
                prev
                    ? {
                        ...prev,
                        isComplete: data.is_complete,
                        isWon: data.is_won,
                        result: {
                            characterCorrect: data.character_correct,
                            animeCorrect: data.anime_correct,
                        },
                        target: data.target,
                        duration: data.duration,
                    }
                    : null
            )
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
            const response = await guessCharacterApi.giveUp(gameState.gameId)
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

    const searchCharacter = useCallback(async (query: string) => {
        if (!query || query.length < 2) return []
        try {
            const response = await guessCharacterApi.searchCharacter(query)
            return response.data.map((item: any) => ({
                label: item.name,
                value: item.value,
            }))
        } catch {
            return []
        }
    }, [])

    const searchAnime = useCallback(async (query: string) => {
        if (!query || query.length < 2) return []
        try {
            const response = await guessCharacterApi.searchAnime(query)
            return response.data.map((item: any) => ({
                label: item.name,
                value: item.value,
            }))
        } catch {
            return []
        }
    }, [])

    // Start screen
    if (!gameState) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                        🎭 Guess Character
                    </h1>
                    <p className="text-xl text-gray-300 mb-2">Name the character AND their anime!</p>
                    <p className="text-gray-400">One chance. Both answers must be correct.</p>
                </div>

                <div className="card p-8 max-w-lg w-full animate-slide-up">
                    <h2 className="text-lg font-semibold mb-4 text-center">Select Difficulty</h2>
                    <DifficultySelector value={difficulty} onChange={setDifficulty} />

                    {/* How to Play Section */}
                    <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <span>⚠️</span> Important
                        </h3>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-pink-400 flex-shrink-0">•</span>
                                <span>You get <strong className="text-white">ONE chance only!</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-pink-400 flex-shrink-0">•</span>
                                <span>You must guess BOTH the character name AND the anime</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-pink-400 flex-shrink-0">•</span>
                                <span>Getting either wrong means game over!</span>
                            </li>
                        </ul>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={startGame}
                        disabled={isLoading}
                        className={`btn btn-secondary w-full mt-6 text-lg ${isLoading ? 'btn-disabled' : ''}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span> Loading...
                            </span>
                        ) : (
                            'Start Game'
                        )}
                    </button>
                </div>
            </div>
        )
    }

    // Game complete screen
    if (gameState.isComplete && gameState.target) {
        const diff = difficultyInfo[gameState.difficulty as keyof typeof difficultyInfo] || difficultyInfo.normal

        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6">
                <div className="card p-8 max-w-2xl w-full text-center animate-fade-in">
                    {/* Result Icon */}
                    <div className="text-7xl mb-4 animate-bounce">{gameState.isWon ? '🎉' : '💀'}</div>

                    <h1 className="text-4xl font-bold mb-2">{gameState.isWon ? 'Perfect!' : 'Not Quite...'}</h1>

                    {/* Difficulty Badge */}
                    <div className="inline-block px-4 py-2 bg-white/10 rounded-full text-sm mb-6">
                        {diff.emoji} {diff.label}
                    </div>

                    {/* Character Info */}
                    {gameState.target.characterImage && (
                        <img
                            src={gameState.target.characterImage}
                            alt={gameState.target.characterName}
                            className="w-48 h-auto mx-auto rounded-lg shadow-xl my-6"
                        />
                    )}

                    <h2 className="text-2xl font-bold text-anime-secondary mb-2">{gameState.target.characterName}</h2>
                    <p className="text-xl text-gray-300 mb-6">
                        from <span className="text-anime-primary">{gameState.target.animeTitle}</span>
                        {gameState.target.animeYear && ` (${gameState.target.animeYear})`}
                    </p>

                    {/* Result breakdown */}
                    {gameState.result && (
                        <div className="flex justify-center gap-4 mb-6">
                            <div
                                className={`px-6 py-3 rounded-lg ${gameState.result.characterCorrect
                                    ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                    : 'bg-red-500/20 border border-red-500/50 text-red-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">{gameState.result.characterCorrect ? '✅' : '❌'}</div>
                                <div className="text-sm">Character</div>
                            </div>
                            <div
                                className={`px-6 py-3 rounded-lg ${gameState.result.animeCorrect
                                    ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                    : 'bg-red-500/20 border border-red-500/50 text-red-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">{gameState.result.animeCorrect ? '✅' : '❌'}</div>
                                <div className="text-sm">Anime</div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex justify-center gap-8 my-6 p-4 bg-white/5 rounded-lg">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{gameState.duration}s</div>
                            <div className="text-xs text-gray-400">Time</div>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => {
                                setGameState(null)
                                setCharacterName('')
                                setAnimeName('')
                            }}
                            className="btn btn-secondary"
                        >
                            🔄 Play Again
                        </button>
                        <Link to="/" className="btn btn-primary">
                            🏠 Home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Active game screen
    const diff = difficultyInfo[gameState.difficulty as keyof typeof difficultyInfo] || difficultyInfo.normal

    return (
        <div className="min-h-screen p-4 pb-8">
            {/* Header */}
            <div className="text-center pt-12 mb-6">
                <h1 className="text-3xl font-bold mb-2">🎭 Guess Character</h1>
                <div className="flex items-center justify-center gap-4 text-sm">
                    <span className="px-3 py-1 bg-white/10 rounded-full">
                        {diff.emoji} {diff.label}
                    </span>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="max-w-md mx-auto mb-4">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm text-center">
                    ⚠️ <strong>ONE CHANCE ONLY!</strong> Make sure both answers are correct!
                </div>
            </div>

            {/* Character Image */}
            <div className="max-w-md mx-auto mb-6">
                <div className="card p-4 animate-fade-in">
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg">
                            <div className="animate-spin text-4xl">⏳</div>
                        </div>
                    )}
                    <img
                        src={gameState.characterImage}
                        alt="Mystery character"
                        className="w-full rounded-lg shadow-xl"
                    />
                    <div className="mt-3 text-center text-gray-400 text-sm">
                        Who is this character?
                    </div>
                </div>
            </div>

            {/* Input Area - Part of page content */}
            <div className="max-w-2xl mx-auto mb-8">
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="card p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                <span>👤</span> Character Name
                            </label>
                            <SearchInput
                                value={characterName}
                                onChange={setCharacterName}
                                onSearch={searchCharacter}
                                placeholder="Enter character name..."
                                onSelect={(value) => setCharacterName(value)}
                                dropUp={false}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                <span>🎬</span> From Anime
                            </label>
                            <SearchInput
                                value={animeName}
                                onChange={setAnimeName}
                                onSearch={searchAnime}
                                placeholder="Enter anime name..."
                                onSelect={(value) => setAnimeName(value)}
                                dropUp={false}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={makeGuess}
                                disabled={isLoading || !characterName.trim() || !animeName.trim()}
                                className={`btn btn-secondary flex-grow py-3 text-lg ${isLoading || !characterName.trim() || !animeName.trim() ? 'btn-disabled' : ''
                                    }`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin">⏳</span> Checking...
                                    </span>
                                ) : (
                                    '🎯 Submit Guess'
                                )}
                            </button>
                            <button onClick={giveUp} disabled={isLoading} className="btn btn-danger px-6">
                                Give Up
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
