export interface GradientSpot {
  x: number
  y: number
  r: number
  color: string
}

export interface GradientPreset {
  id: string
  name: string
  category: 'flow' | 'aurora' | 'sunset' | 'dark'
  baseColor: string
  colors: [string, string, string, string]
  spots: GradientSpot[]
}

export const FERAL_GRADIENTS: GradientPreset[] = [
  {
    id: 'iridescent-cloud',
    name: 'Iridescent cloud',
    category: 'flow',
    baseColor: '#1e50a2',
    colors: ['#eaf4fc', '#1e50a2', '#f09199', '#895b8a'],
    spots: [
      { x: 0.55, y: 0.1, r: 0.7, color: '#eaf4fc' },
      { x: 0.75, y: 0.35, r: 0.65, color: '#1e50a2' },
      { x: 0.25, y: 0.25, r: 0.65, color: '#f09199' },
      { x: 0.85, y: 0.85, r: 0.75, color: '#895b8a' },
    ],
  },
  {
    id: 'opal',
    name: 'Opal',
    category: 'flow',
    baseColor: '#a78bfa',
    colors: ['#fbcfe8', '#c4b5fd', '#bae6fd', '#fed7aa'],
    spots: [
      { x: 0.2, y: 0.2, r: 0.6, color: '#fbcfe8' },
      { x: 0.8, y: 0.2, r: 0.6, color: '#c4b5fd' },
      { x: 0.3, y: 0.8, r: 0.7, color: '#bae6fd' },
      { x: 0.7, y: 0.8, r: 0.6, color: '#fed7aa' },
    ],
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    category: 'flow',
    baseColor: '#0369a1',
    colors: ['#38bdf8', '#0284c7', '#0f766e', '#0369a1'],
    spots: [
      { x: 0.15, y: 0.2, r: 0.65, color: '#38bdf8' },
      { x: 0.85, y: 0.2, r: 0.6, color: '#0284c7' },
      { x: 0.5, y: 0.85, r: 0.7, color: '#0f766e' },
      { x: 0.2, y: 0.8, r: 0.6, color: '#0369a1' },
    ],
  },
  {
    id: 'emerald',
    name: 'Emerald',
    category: 'flow',
    baseColor: '#064e3b',
    colors: ['#6ee7b7', '#10b981', '#047857', '#064e3b'],
    spots: [
      { x: 0.2, y: 0.2, r: 0.65, color: '#6ee7b7' },
      { x: 0.8, y: 0.25, r: 0.6, color: '#10b981' },
      { x: 0.5, y: 0.8, r: 0.7, color: '#047857' },
      { x: 0.15, y: 0.9, r: 0.6, color: '#064e3b' },
    ],
  },
  {
    id: 'solar-flare',
    name: 'Solar flare',
    category: 'sunset',
    baseColor: '#b91c1c',
    colors: ['#fde047', '#fb923c', '#f43f5e', '#b91c1c'],
    spots: [
      { x: 0.8, y: 0.15, r: 0.65, color: '#fde047' },
      { x: 0.2, y: 0.25, r: 0.6, color: '#fb923c' },
      { x: 0.5, y: 0.75, r: 0.7, color: '#f43f5e' },
      { x: 0.85, y: 0.9, r: 0.65, color: '#b91c1c' },
    ],
  },
  {
    id: 'orchid',
    name: 'Orchid',
    category: 'flow',
    baseColor: '#6b21a8',
    colors: ['#f472b6', '#c084fc', '#9333ea', '#6b21a8'],
    spots: [
      { x: 0.2, y: 0.2, r: 0.6, color: '#f472b6' },
      { x: 0.85, y: 0.2, r: 0.65, color: '#c084fc' },
      { x: 0.4, y: 0.8, r: 0.7, color: '#9333ea' },
      { x: 0.8, y: 0.85, r: 0.6, color: '#6b21a8' },
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'sunset',
    baseColor: '#7c2d12',
    colors: ['#fdba74', '#fb923c', '#e11d48', '#7c2d12'],
    spots: [
      { x: 0.25, y: 0.2, r: 0.65, color: '#fdba74' },
      { x: 0.8, y: 0.2, r: 0.6, color: '#fb923c' },
      { x: 0.3, y: 0.8, r: 0.7, color: '#e11d48' },
      { x: 0.85, y: 0.85, r: 0.65, color: '#7c2d12' },
    ],
  },
  {
    id: 'midnight-bloom',
    name: 'Midnight bloom',
    category: 'dark',
    baseColor: '#09090b',
    colors: ['#818cf8', '#4f46e5', '#312e81', '#09090b'],
    spots: [
      { x: 0.2, y: 0.2, r: 0.6, color: '#818cf8' },
      { x: 0.8, y: 0.2, r: 0.65, color: '#4f46e5' },
      { x: 0.4, y: 0.8, r: 0.7, color: '#312e81' },
      { x: 0.9, y: 0.85, r: 0.65, color: '#09090b' },
    ],
  },
]