import { renderMockupVideo } from './server/renderer';
import template from './templates/iphone-orbit.json';
import path from 'path';

const userOverrides = {
  screenMedia: path.resolve('./assets/textures/placeholder.png'),
  chassisColor: '#4f46e5',
  backgroundColor: '#090a0f',
};

const outputPath = path.resolve('./output_mockup.mp4');

await renderMockupVideo({
  template,
  overrides: userOverrides,
  outputPath,
});
