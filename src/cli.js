// mcts-mem — build, verify, and explore an MCTS-Mem design tree.

import { lint } from './lint.js';
import { view, show } from './view.js';
import { uncertain } from './uncertain.js';
import { serve } from './serve.js';

const VERSION = '0.1.0';
const DEFAULT_ROOT = 'mcts_mem';

const HELP = `mcts-mem — work with an MCTS-Mem design tree
(a structured, linter-checked memory of how a project was decided)

usage: mcts-mem <command> [path] [options]
       path defaults to ./${DEFAULT_ROOT}

commands:
  lint [path] [--skeleton]
        Verify the tree against the grammar — structure, entry form, provenance
        tags, verbatim move pairs, append-only history, links, and "every node
        records a real decision". Run it like a compiler: after any edit, until
        clean. Prints each violation as "[R-rule] path: message" and exits 1;
        exits 0 when the tree is clean.
        --skeleton  Build-time only. Skips the R-thin check (a node with no
                    alternative / Facts / Moves / children is just a module-map
                    entry). A freshly-built Stage-1 skeleton is nodes + items
                    with no decisions recorded yet, so R-thin would fire on every
                    node; lint with --skeleton until history is folded in and the
                    tree pruned, then lint without it. (The mcts-mem-build skill
                    drives this; you won't need it on a finished tree.)

  view [path] [--alt] [--depth N]
        Render the decision tree. Node names are styled by confidence: bold =
        fought over (≥5 facts), dim = unweighed (reconsider freely). Annotations
        show facts (Nf), moves (Nm), and alternatives (↩N). --alt also walks the
        rejected alternatives; --depth limits how deep to render.

  show <node> [path]
        Print one node in full — its items, Facts, Moves, sub-decisions, and the
        alternatives it beat. <node> is a node name or a logical path.

  uncertain [path]
        List every (uncertain) entry — the worklist of decisions whose why is not
        yet backed by code or a source.

  serve [path] [--port N]
        Open a local web viewer for the tree (default port 4173). Reads the tree
        live from disk and serves it at http://localhost:<port>, reusing the same
        model as lint/view so the browser and the CLI never disagree. Runs until
        interrupted.

  help | --help | -h        show this
  --version                 print version
`;

function parse(args) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--depth') flags.depth = Number(args[++i]);
    else if (a === '--port') flags.port = Number(args[++i]);
    else if (a === '--skeleton') flags.skeleton = true;
    else if (a === '--alt') flags.alt = true;
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else pos.push(a);
  }
  return { flags, pos };
}

export function run(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return 0;
  }
  const { flags, pos } = parse(argv.slice(1));
  try {
    switch (cmd) {
      case 'lint': {
        const root = pos[0] || DEFAULT_ROOT;
        const { errors, nodeCount, factCount } = lint(root, flags);
        if (errors.length) {
          console.error(`${errors.length} violation(s):`);
          for (const e of errors) console.error(`  [${e.rule}] ${e.path}: ${e.msg}`);
          return 1;
        }
        console.log(`lint clean: ${nodeCount} nodes, ${factCount} fact files`);
        return 0;
      }
      case 'view': {
        const root = pos[0] || DEFAULT_ROOT;
        view(root, { alt: !!flags.alt, depth: flags.depth || Infinity });
        return 0;
      }
      case 'show': {
        if (!pos[0]) { console.error('show: needs a <node> name or logical path'); return 2; }
        const root = pos[1] || DEFAULT_ROOT;
        return show(root, pos[0]);
      }
      case 'uncertain': {
        const root = pos[0] || DEFAULT_ROOT;
        return uncertain(root);
      }
      case 'serve': {
        const root = pos[0] || DEFAULT_ROOT;
        serve(root, { port: flags.port });
        return undefined; // server keeps the process alive
      }
      default:
        console.error(`unknown command: ${cmd}\n`);
        process.stdout.write(HELP);
        return 2;
    }
  } catch (e) {
    console.error(`mcts-mem ${cmd}: ${e.message}`);
    return 1;
  }
}
