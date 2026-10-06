import macbookPodiumShowcase from './macbook-podium-showcase.json'
import multiIphoneFanout from './multi-iphone-fanout.json'
import macbookPlatformReveal from './macbook-platform-reveal.json'
import iphoneHelixShowcase from './iphone-helix-showcase.json'
import terminalQuestionCard from './terminal-question-card.json'
import directorHudCard from './director-hud-card.json'

const templateLibrary: Record<string, unknown> = {
  'Terminal Question Card (2D)': terminalQuestionCard,
  'Director Viewfinder HUD (2D)': directorHudCard,
  'Macbook Podium Showcase': macbookPodiumShowcase,
  'Multi iPhone Fanout': multiIphoneFanout,
  'MacBook Platform Reveal': macbookPlatformReveal,
  'iPhone Helix Showcase': iphoneHelixShowcase,
}

export default templateLibrary