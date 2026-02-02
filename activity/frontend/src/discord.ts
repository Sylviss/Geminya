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

    // Authorize with OAuth2
    console.log('Requesting authorization...')
    const { code } = await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds'],
    })
    
    console.log('Got authorization code, authenticating...')

    // Authenticate directly with the code
    const auth = await discordSdk.commands.authenticate({
        access_token: code,
    })

    console.log('Authentication result:', auth)

    if (auth == null || auth.user == null) {
        throw new Error('Authenticate command failed - no user returned')
    }

    return {
        id: auth.user.id,
        username: auth.user.username,
        discriminator: auth.user.discriminator ?? '0000',
        avatar: auth.user.avatar ?? null,
    }
}

export function getDiscordSdk(): DiscordSDK | null {
    return discordSdk
}
