#!/usr/bin/env node
import { run } from '../src/cli.js';
// `serve` returns undefined and keeps the process alive; every other command
// returns an exit code.
const code = run(process.argv.slice(2));
if (code !== undefined) process.exit(code);
