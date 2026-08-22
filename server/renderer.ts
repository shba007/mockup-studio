import { chromium } from 'playwright';
import { execa } from 'execa';
import { createServer } from 'vite';
import path from 'path';

export interface RenderJob {
  template: any;
  overrides: {
    screenMedia?: string;
    chassisColor?: string;
    backgroundColor?: string;
  };
  outputPath: string;
}

export async function renderMockupVideo({ template, overrides, outputPath }: RenderJob) {
  const { width, height, fps, durationFrames } = template.output;

  // 1. Boot internal Vite dev server for rendering
  const vite = await createServer({
    server: { port: 5173 },
  });
  await vite.listen();

  // 2. Spawn FFmpeg process via execa with stdin pipe
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', String(fps),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '18',
    outputPath,
  ];

  const ffmpegProcess = execa('ffmpeg', ffmpegArgs, {
    stdin: 'pipe',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  // 3. Launch Headless Browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  // Inject render payload before document loads
  await page.addInitScript(({ template, overrides }) => {
    (window as any).__RENDER_PAYLOAD__ = { template, overrides };
  }, { template, overrides });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof (window as any).__SEEK_FRAME__ === 'function');

  console.log(`[Renderer] Beginning render: ${durationFrames} frames @ ${fps}fps (${width}x${height})`);

  // 4. Step frame-by-frame and pipe directly to FFmpeg stdin
  for (let frame = 0; frame < durationFrames; frame++) {
    await page.evaluate((f) => (window as any).__SEEK_FRAME__(f), frame);

    // Allow canvas repaint
    await page.waitForTimeout(16);

    const frameBuffer = await page.locator('canvas').screenshot({
      type: 'png',
      omitBackground: false,
    });

    if (ffmpegProcess.stdin) {
      ffmpegProcess.stdin.write(frameBuffer);
    }
  }

  // 5. Finalize streams and cleanup
  if (ffmpegProcess.stdin) {
    ffmpegProcess.stdin.end();
  }

  await ffmpegProcess;
  await browser.close();
  await vite.close();

  console.log(`[Renderer] Successfully exported: ${outputPath}`);
}
