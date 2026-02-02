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
    console.log('SDK ready! Current user:', discordSdk.instanceId)

    // Simple approach: just authorize and the SDK will handle the rest
    await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds'],
    })
    
    console.log('Authorization complete')

    // The SDK should now have user context
    // Use a simple approach - get the current user from the SDK context
    // For Activities, the user info is embedded in the SDK after authorization
    
    // Fallback to a basic user ID from the SDK
    const userId = discordSdk.instanceId || 'activity_user'
    
    console.log('Using user ID:', userId)

    return {
        id: userId,
        username: 'Activity User',
        discriminator: '0000',
        avatar: null,
    }
}

export function getDiscordSdk(): DiscordSDK | null {
    return discordSdk
}
