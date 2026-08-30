// ============================================================================
// Core Math & Animation Primitives
// ============================================================================

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

// ============================================================================
// Lighting, Shadows & Post-Processing
// ============================================================================

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

// ============================================================================
// Textures, Materials & Stage Primitives
// ============================================================================

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

// ============================================================================
// Scene Objects (Devices, Podiums, Props)
// ============================================================================

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
  materials?: Record<string, MaterialProperties>
  keyframes?: ObjectKeyframes
}

// ============================================================================
// Camera & Root Configuration
// ============================================================================

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
  fps: number
  durationFrames: number
}

export interface SceneVariables {
  screenMedia?: string
  chassisColor?: string
  backgroundGradient?: string
  backgroundColor?: string
  screenTransform?: TextureTransform
  [customVar: string]: unknown
}

export interface SceneAnimationConfig {
  id: string
  output: RenderOutputConfig
  variables?: SceneVariables
  camera?: CameraConfig
  lights?: SceneLightsConfig
  postProcessing?: PostProcessingConfig
  contactShadows?: boolean | ContactShadowsConfig
  elements?: StagePrimitiveElement[]
  objects: SceneObject[]
}