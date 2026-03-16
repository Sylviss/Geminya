import axios from 'axios'
import { getGuildId } from '../discord'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(
    (config) => {
        const user = window.discordUser
        if (user) config.headers['X-User-ID'] = user.id
        const guildId = getGuildId()
        if (guildId) config.headers['X-Guild-ID'] = guildId
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data?.detail || error.message)
        return Promise.reject(error)
    }
)

export const anidleApi = {
    start: (userId: string, difficulty: string) => api.post('/anidle/start', { user_id: userId, difficulty }),
    guess: (gameId: string, animeName: string) => api.post(`/anidle/${gameId}/guess`, { anime_name: animeName }),
    hint: (gameId: string, hintType: string) => api.post(`/anidle/${gameId}/hint`, { hint_type: hintType }),
    giveUp: (gameId: string) => api.post(`/anidle/${gameId}/giveup`),
    status: (gameId: string) => api.get(`/anidle/${gameId}/status`),
    search: (query: string) => api.get('/anidle/search', { params: { q: query, limit: 25 } }),
}

export const guessAnimeApi = {
    start: (userId: string, difficulty: string) => api.post('/guess-anime/start', { user_id: userId, difficulty }),
    guess: (gameId: string, animeName: string) => api.post(`/guess-anime/${gameId}/guess`, { anime_name: animeName }),
    revealStage: (gameId: string) => api.post(`/guess-anime/${gameId}/reveal_stage`),
    navigateStage: (gameId: string, stage: number) => api.post(`/guess-anime/${gameId}/navigate_stage/${stage}`),
    giveUp: (gameId: string) => api.post(`/guess-anime/${gameId}/giveup`),
    status: (gameId: string) => api.get(`/guess-anime/${gameId}/status`),
    search: (query: string) => api.get('/guess-anime/search', { params: { q: query, limit: 25 } }),
}

export const guessCharacterApi = {
    start: (userId: string, difficulty: string) => api.post('/guess-character/start', { user_id: userId, difficulty }),
    guess: (gameId: string, characterName: string, animeName: string) => api.post(`/guess-character/${gameId}/guess`, { character_name: characterName, anime_name: animeName }),
    giveUp: (gameId: string) => api.post(`/guess-character/${gameId}/giveup`),
    status: (gameId: string) => api.get(`/guess-character/${gameId}/status`),
    searchCharacter: (query: string) => api.get('/guess-character/search-character', { params: { q: query, limit: 25 } }),
    searchAnime: (query: string) => api.get('/guess-character/search/anime', { params: { q: query, limit: 25 } }),
}

export const guessOpApi = {
    start: (userId: string, difficulty: string) => api.post('/guess-theme/op/start', { user_id: userId, difficulty }),
    guess: (gameId: string, animeName: string) => api.post(`/guess-theme/${gameId}/guess`, { anime_name: animeName }),
    reveal: (gameId: string) => api.post(`/guess-theme/${gameId}/reveal`),
    giveUp: (gameId: string) => api.post(`/guess-theme/${gameId}/giveup`),
    search: (query: string) => api.get('/guess-theme/search/anime', { params: { q: query, limit: 25 } }),
}

export const guessEdApi = {
    start: (userId: string, difficulty: string) => api.post('/guess-theme/ed/start', { user_id: userId, difficulty }),
    guess: (gameId: string, animeName: string) => api.post(`/guess-theme/${gameId}/guess`, { anime_name: animeName }),
    reveal: (gameId: string) => api.post(`/guess-theme/${gameId}/reveal`),
    giveUp: (gameId: string) => api.post(`/guess-theme/${gameId}/giveup`),
    search: (query: string) => api.get('/guess-theme/search/anime', { params: { q: query, limit: 25 } }),
}
export const nwnlAcademyApi = {
    status: () => api.get('/nwnl/academy/status'),
    claimDaily: () => api.post('/nwnl/academy/daily'),
    getMissions: () => api.get('/nwnl/academy/missions'),
    claimMission: (missionId: number) => api.post(`/nwnl/academy/missions/${missionId}/claim`),
    rename: (name: string) => api.post('/nwnl/academy/rename', { name }),
    reset: (confirmation: string) => api.post('/nwnl/academy/reset', { confirmation }),
    deleteAccount: (confirmation: string) => api.delete('/nwnl/academy/delete', { data: { confirmation } }),
    searchCollection: (params: { name?: string; series?: string; genre?: string; archetype?: string; element?: string; page?: number; page_size?: number }) =>
        api.get('/nwnl/academy/search', { params }),
}

export const nwnlBannerApi = {
    list: () => api.get('/nwnl/banners'),
    get: (bannerId: number) => api.get(`/nwnl/banners/${bannerId}`),
    pool: (bannerId: number) => api.get(`/nwnl/banners/${bannerId}/pool`),
    rates: (bannerId: number) => api.get(`/nwnl/banners/${bannerId}/rates`),
}

export const nwnlSummonApi = {
    single: (bannerId?: number) => api.post('/nwnl/summon', { banner_id: bannerId ?? null }),
    multi: (bannerId?: number) => api.post('/nwnl/summon/multi', { banner_id: bannerId ?? null }),
    awaken: (waifuId: number) => api.post(`/nwnl/summon/awaken/${waifuId}`),
}

export default api

