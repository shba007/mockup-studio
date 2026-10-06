export interface PlatformPreset {
  id: string
  name: string
  platform: string
  width: number
  height: number
  aspectLabel: string
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'x-landscape',
    name: 'X (Twitter)',
    platform: 'X',
    width: 1600,
    height: 900,
    aspectLabel: '16:9',
  },
  {
    id: 'linkedin-portrait',
    name: 'LinkedIn Portrait',
    platform: 'LinkedIn',
    width: 1080,
    height: 1350,
    aspectLabel: '4:5',
  },
  {
    id: 'social-square',
    name: 'Square Post',
    platform: 'IG / LinkedIn',
    width: 1080,
    height: 1080,
    aspectLabel: '1:1',
  },
  {
    id: 'mobile-story',
    name: 'Story / Reel / TikTok',
    platform: 'Reels / TikTok',
    width: 1080,
    height: 1920,
    aspectLabel: '9:16',
  },
  {
    id: 'yt-landscape',
    name: 'Full HD Landscape',
    platform: 'YouTube / Web',
    width: 1920,
    height: 1080,
    aspectLabel: '16:9',
  },
]