export type ProjectKind = '2d' | '3d'
export type ProjectMode = 'static' | 'animated'
export type ScreenFitMode = 'fit' | 'cover' | 'stretch'

export type CardType =
  | 'terminal'
  | 'window'
  | 'card'
  | 'browser'
  | 'viewfinder'
  | 'slate'
  | 'screenplay'

export interface CardWindowSettings {
  type: CardType
  title?: string
  showControls?: boolean
  borderRadius?: number
  padding?: number
  maxWidth?: number
  shadowBlur?: number

  // Media & Production House Additions (Configured directly in JSON)
  timecode?: string
  fpsBadge?: string
  aspectGuide?: string
  cameraSpec?: string
  lensSpec?: string
  sceneData?: {
    roll?: string
    scene?: string
    take?: string
  }
}

export interface CardContentSettings {
  text: string
  character?: string
  parenthetical?: string
  fontSize?: number
  lineHeight?: number
  fontFamily?: string
  showLineNumbers?: boolean
  metaLeft?: string
  metaRight?: string
  align?: 'left' | 'center'
}

export interface BackgroundStyleConfig {
  type: 'gradient' | 'solid' | 'mesh'
  value: string
  blur?: number
  noise?: boolean
}

export type Vector3Tuple = [x: number, y: number, z: number]
export type Vector2Tuple = [x: number, y: number]

export type EasingType =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInOutSine'

export interface Keyframe<T> {
  frame: number
  value: T
  easing?: EasingType
}

export type KeyframeTrack<T> = Keyframe<T>[]

export interface AmbientLightConfig {
  intensity?: number
  color?: string
}

export interface DirectionalLightConfig {
  position: Vector3Tuple
  intensity: number
  color?: string
}

export interface PointLightConfig {
  position: Vector3Tuple
  intensity: number
  color?: string
  distance?: number
  decay?: number
}

export interface SceneLightsConfig {
  ambient?: AmbientLightConfig
  directional?: DirectionalLightConfig[]
  point?: PointLightConfig[]
}

export interface BloomConfig {
  intensity?: number
  luminanceThreshold?: number
  luminanceSmoothing?: number
  mipmapBlur?: boolean
}

export interface PostProcessingConfig {
  bloom?: BloomConfig
}

export interface ContactShadowsConfig {
  position?: Vector3Tuple
  scale?: number
  scaleMultiplier?: number
  opacity?: number
  blur?: number
  far?: number
  color?: string
  resolution?: number
}

export interface TextureTransform {
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  offset?: Vector2Tuple
  repeat?: Vector2Tuple
  center?: Vector2Tuple
}

export interface MaterialProperties {
  color?: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
  toneMapped?: boolean
  transparent?: boolean
  opacity?: number
}

export interface StagePrimitiveElement {
  type: 'torus' | 'cylinder' | 'plane' | 'box'
  args: number[]
  position?: Vector3Tuple
  rotation?: Vector3Tuple
  scale?: number | Vector3Tuple
  material?: MaterialProperties & { type?: 'basic' | 'standard' }
}

export interface NodeKeyframeTracks {
  position?: KeyframeTrack<Vector3Tuple>
  rotation?: KeyframeTrack<Vector3Tuple>
  scale?: KeyframeTrack<Vector3Tuple>
}

export interface ObjectKeyframes {
  position?: KeyframeTrack<Vector3Tuple>
  rotation?: KeyframeTrack<Vector3Tuple>
  scale?: KeyframeTrack<Vector3Tuple>
  nodes?: Record<string, NodeKeyframeTracks>
}

export interface SceneObject {
  name: string
  modelUrl: string
  scale?: number
  autoScale?: boolean
  autoCenter?: boolean
  meshBindings?: {
    screen?: string
    chassis?: string
    keyboard?: string
    [bindingKey: string]: string | undefined
  }
  screenMedia?: string
  screenTransform?: TextureTransform
  screenFit?: ScreenFitMode
  materials?: Record<string, MaterialProperties>
  keyframes?: ObjectKeyframes
}

export interface CameraKeyframes {
  position?: KeyframeTrack<Vector3Tuple>
  rotation?: KeyframeTrack<Vector3Tuple>
}

export interface CameraConfig {
  fov?: number
  lookAt?: Vector3Tuple
  keyframes?: CameraKeyframes
}

export interface RenderOutputConfig {
  width: number
  height: number
  fps?: number
  durationFrames?: number
}

export interface SceneVariables {
  screenMedia?: string
  chassisColor?: string
  backgroundGradient?: string
  backgroundColor?: string
  screenTransform?: TextureTransform
  screenFit?: ScreenFitMode
  [customVar: string]: unknown
}

export interface BaseConfig {
  id: string
  name?: string
  kind?: ProjectKind
  mode?: ProjectMode
  output: RenderOutputConfig
  background?: BackgroundStyleConfig
}

export interface Project2DConfig extends BaseConfig {
  kind: '2d'
  mode: 'static' | 'animated'
  card: CardWindowSettings
  content: CardContentSettings
  background: BackgroundStyleConfig
  keyframes?: {
    scale?: KeyframeTrack<number>
    opacity?: KeyframeTrack<number>
  }
}

export interface Project3DConfig extends BaseConfig {
  kind?: '3d'
  mode?: 'animated'
  variables?: SceneVariables
  camera?: CameraConfig
  lights?: SceneLightsConfig
  postProcessing?: PostProcessingConfig
  contactShadows?: boolean | ContactShadowsConfig
  elements?: StagePrimitiveElement[]
  objects: SceneObject[]
}

export type SceneAnimationConfig = Project3DConfig | Project2DConfig