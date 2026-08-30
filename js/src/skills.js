/**
 * Canonical skill deployment (SPC sections 28, 32): `tux design install`,
 * `tux live install` and the start-review commands deploy the packaged
 * skills verbatim into the project's agent skill directories, so a package
 * installation plus one CLI invocation leaves the project ready, and a
 * package update refreshes the deployed copies on the next invocation.
 *
 * @module skills
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, EXIT } from './errors.js';

/** Agent skill directories relative to the project root (SPC sections 28, 32). */
export const AGENT_DIRS = ['.kilo', '.claude', '.hermes'];

const packagedSkillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

/**
 * Deploy every packaged `tux-<name>.md` skill verbatim into
 * `<root>/<agent>/skills/<name>/SKILL.md` for each agent directory.
 * Idempotent: deployed copies are rewritten on every run; files not
 * shipped by this package are never touched. Returns the sorted names.
 *
 * @param {string} root project root directory
 * @returns {string[]} deployed skill names, sorted
 */
export function deploySkills(root) {
  const names = readdirSync(packagedSkillsDir)
    .filter((f) => /^tux-.+\.md$/.test(f))
    .sort()
    .map((f) => f.replace(/\.md$/, ''));
  try {
    for (const agent of AGENT_DIRS) {
      for (const name of names) {
        const dst = join(root, agent, 'skills', name, 'SKILL.md');
        mkdirSync(dirname(dst), { recursive: true });
        writeFileSync(dst, readFileSync(join(packagedSkillsDir, `${name}.md`)));
      }
    }
  } catch (e) {
    throw new CliError(EXIT.general, `skill deployment failed: ${e.message}`);
  }
  return names;
}
