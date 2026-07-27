#!/usr/bin/env node
process.env.PPHAT_INVOKED_AS = 'registry';

// Workaround: on Windows, npm's shim for the scoped bin `@pphatdev/registry`
// can inject a spurious "/registry" as the first user argument.
if (process.argv[2] === '/registry') {
  process.argv.splice(2, 1);
}

require('../dist/index.js');
