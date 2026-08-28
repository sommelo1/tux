/**
 * CLI error carrying a canonical exit code (SPC section 75).
 *
 * @module errors
 */

export const EXIT = {
  ok: 0,
  general: 1,
  usage: 2,
  config: 3,
  server: 4,
  authorization: 5,
  notFound: 6,
  conflict: 7,
};

/** Error with a canonical exit code; message printed as `error: …` on stderr. */
export class CliError extends Error {
  /**
   * @param {number} code canonical exit code
   * @param {string} message diagnostic message (no locale, no paths of the host)
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
