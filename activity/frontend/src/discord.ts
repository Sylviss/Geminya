import { DiscordSDK } from '@discord/embedded-app-sdk'

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''

export interface DiscordUser {
    id: string
    username: string
    discriminator: string
    avatar: string | null
}

let discordSdk: DiscordSDK | null = null

export async function setupDiscord(): Promise<DiscordUser> {
    if (!CLIENT_ID) {
        throw new Error('Discord Client ID not configured')
    }

    console.log('Initializing Discord SDK with Client ID:', CLIENT_ID)
    
    discordSdk = new DiscordSDK(CLIENT_ID)
    
    console.log('Waiting for SDK ready...')
    await discordSdk.ready()
    console.log('SDK ready!')

    // For Activities, we just need to authorize - no token exchange needed
    console.log('Requesting authorization...')
    const { code } = await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds'],
    })
    
    console.log('Authorization complete with code:', code)

    // Get user info directly from the SDK
    // The SDK's instanceId gives us access to the user
    const user = await discordSdk.commands.getInstanceConnectedParticipants()
    
    if (!user || !user.participants || user.participants.length === 0) {
        throw new Error('No user found in activity')
    }

    const currentUser = user.participants[0]

    console.log('Got user:', currentUser)

    return {
        id: currentUser.id,
        username: currentUser.username,
        discriminator: '0000',
        avatar: currentUser.avatar ?? null,
    }
}

export function getDiscordSdk(): DiscordSDK | null {
    return discordSdk
}
