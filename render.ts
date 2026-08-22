import { execa } from 'execa'
import path from 'path'
import fs from 'fs'

// Configuration
const FRAMES_DIR = path.resolve('./assets/frames')
const OUTPUT_FILE = path.resolve('./assets/final_mockup.mp4')
const FPS = 60

async function renderVideo() {
  console.log('🎬 Starting video render process...')

  // 1. Validate frames directory exists
  if (!fs.existsSync(FRAMES_DIR)) {
    console.error(`❌ Error: Frames directory not found at ${FRAMES_DIR}`)
    console.error('Please ensure you have extracted your exported frames there.')
    process.exit(1)
  }

  // Check if frames actually exist inside the directory
  const files = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.png'))
  if (files.length === 0) {
    console.error(`❌ Error: No PNG frames found in ${FRAMES_DIR}`)
    process.exit(1)
  }

  console.log(`✅ Found ${files.length} frames.`)
  console.log(`🚀 Encoding at ${FPS} FPS to ${OUTPUT_FILE}...`)

  // 2. FFmpeg arguments for high-quality MP4 output
  const ffmpegArgs = [
    '-y', // Overwrite output file if it exists
    '-framerate',
    String(FPS),
    '-i',
    path.join(FRAMES_DIR, 'frame_%04d.png'), // Input pattern: frame_0000.png, frame_0001.png, etc.
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2', // <--- FIX: Forces even dimensions for libx264
    '-c:v',
    'libx264', // H.264 Video Codec
    '-pix_fmt',
    'yuv420p', // Pixel format for maximum compatibility (QuickTime, Web, etc.)
    '-crf',
    '15', // Constant Rate Factor: 0 (lossless) to 51 (worst). 15 is visually lossless.
    '-preset',
    'veryslow', // Compression efficiency (slower encoding = smaller file size at same quality)
    OUTPUT_FILE,
  ]

  try {
    // 3. Execute FFmpeg
    const ffmpegProcess = execa('ffmpeg', ffmpegArgs)

    // Pipe FFmpeg output to the console so you can see the progress
    if (ffmpegProcess.stderr) {
      ffmpegProcess.stderr.pipe(process.stderr)
    }

    await ffmpegProcess

    console.log('\n✨ Video rendering complete! ✨')
    console.log(`📂 Output saved to: ${OUTPUT_FILE}`)
  } catch (error: unknown) {
    console.error('\n❌ Error during video encoding:')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}

await renderVideo()
