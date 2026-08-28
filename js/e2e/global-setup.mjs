/** Clears the example design's runtime store so every e2e run starts clean. */
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, '..', '..', 'examples', 'design-vanilla');

export default function globalSetup() {
  rmSync(join(example, '.tux'), { recursive: true, force: true });
}
