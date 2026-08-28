/**
 * TUX — TUX UIX review system (Node reference implementation).
 *
 * Public library surface alongside the `tux` CLI.
 *
 * @module index
 */
export { canonicalJson, compactJson, sortedObject } from './canonical.js';
export { nowMs, canonicalTimestamp, ulid, deterministicEntropy, newId } from './ids.js';
export { SCHEMA_VERSION, FEEDBACK_TYPES, FEEDBACK_STATUSES, validateFeedback, makeFeedback, normalizedText } from './schema.js';
export { loadConfig, resolveIdentity } from './config.js';
export { loadStore, saveStore } from './store.js';
export { opList, opShow, opCreate, opUpdate, opDelete, opClear, opExport, opIncorporate, opValidate } from './feedback.js';
export { opDesignInstall, opDesignCreate, opLiveCreate, opDesignStart, opDesignStatus, opDesignStop } from './design.js';
export { opLiveInstall, opLiveStart, opLiveStatus, opLiveStop } from './live.js';
export { run, parseArgs, VERSION } from './cli.js';
export { startServer, inject } from './server.js';
