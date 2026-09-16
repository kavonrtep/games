# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A set of static, dependency-free web apps (plain HTML/CSS/JS, no build step)
for teaching bioinformatics students pairwise alignment, dotplots, BLAST and
genome assembly. It is hosted on GitHub Pages, so everything must run in the
browser: no server, no bundler, no npm packages. `index.html` is the portal.

## Apps

| Page | Purpose | Main JS |
|---|---|---|
| `needleman-wunsch.html` | Global alignment trainer (editor, target score, DP matrix with step/fill modes, linear/affine gaps, BLOSUM62) | `alignTrainer.js` (`data-mode="global"`) |
| `smith-waterman.html` | Local alignment trainer, same code base (`data-mode="local"`) | `alignTrainer.js` |
| `alignment-quiz.html` | Seeded self-assessment on alignment (13 question types, 6 levels) | `alignQuiz.js`, `alignQuizGenerators.js` |
| `dotplot.html` | Dotplot trainer with examples, quiz questions and "name the event" game | `dotplotController.js` |
| `dotplot-quiz.html` | Seeded self-assessment on dotplots (16 question types) | `dotplotQuiz.js`, `dotplotQuizGenerators.js` |
| `blast-demo.html` | BLAST seed-and-extend demo | `blast*.js`, `kmer*.js`, `seedIdentifier.js`, `alignmentExtender.js` |
| `assembly.html` | de Bruijn graph assembly demo | `assembly*.js`, `deBruijnAlgorithm.js` |

`advanced-global-alignment.html`, `dotplot-demo.html` and `dotplot-explorer.html`
are redirects kept for old links.

## Shared modules

- `js/alignEngine.js` – pure pairwise-alignment computations (NW linear with
  all tied traceback arrows and optimal-path counting, Gotoh affine global and
  local, free end gaps, BLOSUM62, alignment scoring). No DOM.
- `js/alignEditor.js` – keyboard/mouse gap editor; `js/alignMatrixView.js` –
  DP matrix as an HTML table (values, arrows, paths, step-by-step and
  fill-it-yourself modes).
- `js/dotplotEngine.js` – dotplot computation (run-length and window/threshold
  modes, expected chance hits). `js/dotplotCanvas.js` – canvas renderer.
- Example sets: `js/alignmentExamples.js`, `js/dotplotExamples.js`. Quiz
  answers in the examples are functions of the engine result, never literals.

## Conventions

- Engines are DOM-free and export via `module.exports` when available, so they
  can be tested in Node: `node -e 'const E=require("./js/alignEngine.js"); …'`.
  When changing an engine, re-run a brute-force comparison on short random
  sequences (see the git history of the engines for the harness).
- Quiz generators are seeded (`Rng` class in the generator files) and must
  validate their own output with the engine; regenerate rather than ship an
  ambiguous question.
- Matrix orientation everywhere: Sequence 1 horizontal (i, columns), Sequence 2
  vertical (j, rows). Coordinates shown to students are 1-based.
- Shared CSS lives in `styles.css`; page-specific rules are appended in
  labelled sections. Do not inject CSS from JS.
- Keep sequences short enough to be readable (≤ 50 residues for the matrix
  view, ≤ 500 bp for dotplots).

## Development

Serve the directory with any static server, e.g. `python3 -m http.server 8765`,
and open `http://localhost:8765/`. Browsers cache the JS aggressively; hard-reload
after edits.
