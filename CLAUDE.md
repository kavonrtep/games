# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A set of static, dependency-free web apps (plain HTML/CSS/JS, no build step)
for teaching bioinformatics students pairwise alignment, dotplots, BLAST, HMMs and
genome assembly. It is hosted on GitHub Pages, so everything must run in the
browser: no server, no bundler, no npm packages. `index.html` is the portal.

## Apps

| Page | Purpose | Main JS |
|---|---|---|
| `needleman-wunsch.html` | Global alignment trainer (editor, target score, DP matrix with step/fill modes, linear/affine gaps, BLOSUM62) | `alignTrainer.js` (`data-mode="global"`) |
| `smith-waterman.html` | Local alignment trainer, same code base (`data-mode="local"`) | `alignTrainer.js` |
| `alignment-quiz.html` | Seeded self-assessment on alignment (13 question types, 6 levels) | `alignQuiz.js`, `alignQuizGenerators.js` |
| `msa.html` | MSA workbench: multi-row gap editor, progressive alignment with stepper, consensus, PSSM, sequence logo, PSSM scan | `msaController.js`, `msaEngine.js`, `msaEditor.js`, `msaLogo.js` |
| `dotplot.html` | Dotplot trainer with examples, quiz questions and "name the event" game | `dotplotController.js` |
| `dotplot-quiz.html` | Seeded self-assessment on dotplots (16 question types) | `dotplotQuiz.js`, `dotplotQuizGenerators.js` |
| `blast.html` | BLAST Explorer: faithful small-scale pipeline (words/neighbourhoods, scan, two-hit, X-drop, gapped, Karlin–Altschul statistics) on databases with planted homologs, plus experiments (word size, translated search, E-value vs database size, masking, BLAST vs SW) and quiz | `blastLab.js`, `blastEngine.js` |
| `hmm.html` | HMM Explorer, three tabs + quiz: HMM basics (CpG islands / casino: generating, one path, Viterbi, Forward, posterior, counting and Baum–Welch), pair HMM (alignment as a path, Viterbi = Gotoh with log-odds scores, Forward, posterior heat map), profile HMM (Plan7 from an MSA, counting with pseudocounts, generator + HMMER file, Viterbi trellis, bit scores and simulated E-values, PSSM vs HMM, HMMER vs BLAST on a synthetic family) | `hmmBasics.js`, `hmmPair.js`, `hmmProfile.js`, `hmmQuiz.js`, `hmmApp.js`, `hmmViews.js` |
| `kmer-spectrum.html` | k-mer Spectrum Lab: the method in 7 steps (counting k-mers on a tiny genome, histogram and C_k, genome size from the peak, errors and cut-off, heterozygous peaks and r, repeat peaks and divergence, GenomeScope-like model fit) and a free genome lab (ploidy, heterozygosity, repeats, coverage, errors, k; truth colouring, peak picking, compare k) + quiz | `kmerController.js`, `kmerViews.js`, `kmerQuiz.js` |
| `olc.html` | OLC Assembly Lab: drag-and-flip assembly puzzle (4 levels: forward, both strands, errors, repeat), the algorithm in 5 steps (overlap matrix and pair view, orientation, overlap graph with transitive reduction, layout/unitigs, consensus), repeats (unitigs vs greedy misassembly, dotplots, mate pairs and scaffold), Lander–Waterman and N50/L50, quiz | `olcController.js`, `olcViews.js`, `olcQuiz.js` |
| `assembly.html` | Assembly Explorer: building a de Bruijn graph step by step (reads → k-mers → graph → contigs, clickable k-mers), repeats (k ≥ R + 2, contigs-vs-k sweep), sequencing errors (tips/bubbles, k-mer count histogram, coverage threshold), quiz. Genome, reads, graph and contigs share one horizontal scale | `assemblyController.js`, `assemblyGraphVisualizer.js`, `assemblyQuiz.js`, `assemblyExamples.js` |

`advanced-global-alignment.html`, `dotplot-demo.html`, `dotplot-explorer.html` and
`blast-demo.html` are redirects kept for old links.

## Shared modules

- `js/alignEngine.js` – pure pairwise-alignment computations (NW linear with
  all tied traceback arrows and optimal-path counting, Gotoh affine global and
  local, free end gaps, BLOSUM62, alignment scoring). No DOM.
- `js/alignEditor.js` – keyboard/mouse gap editor; `js/alignMatrixView.js` –
  DP matrix as an HTML table (values, arrows, paths, step-by-step and
  fill-it-yourself modes).
- `js/dotplotEngine.js` – dotplot computation (run-length and window/threshold
  modes, expected chance hits). `js/dotplotCanvas.js` – canvas renderer.
- `js/blastEngine.js` – BLAST pipeline, scenario generator, statistics,
  masking, six-frame translation. Builds on `alignEngine.js`.
- `js/hmmEngine.js` – general discrete HMM (sample, Viterbi, Forward/Backward,
  posterior, estimation, Baum–Welch), pair HMM (Durbin ch. 4; log-odds scores
  equal to Gotoh), Plan7 profile HMM (build from MSA, Viterbi/Forward in bits
  with N/C flanks and local/glocal modes, sampling, E-values with λ = ln 2),
  synthetic protein family generator. Examples in `js/hmmExamples.js`.
- `js/deBruijnAlgorithm.js` (`DeBruijn`) – seeded genome with planted repeats
  (flanking bases forced to differ, so k ≥ R + 2 resolves a repeat), tiled
  reads with substitution errors, de Bruijn graph with repeat/chance/error
  classification, unitigs with coverage threshold, contig placement in the
  genome (repeat / error / chimeric), k sweep, k-mer count spectrum.
- `js/kmerEngine.js` – diploid genome simulator (SNPs, repeat families with
  diverged copies), reads from both strands with errors, canonical k-mer
  counting in a typed-array hash (k ≤ 26 as exact numbers; the app offers
  9–25), histogram split by true copy number, peak/valley helpers and a
  ploidy-aware Poisson/NB mixture fit (genome size, heterozygosity, repeats).
- `js/olcEngine.js` – genome with a repeat, reads from both strands with
  substitution errors, dovetail overlaps (both orientations) and containment,
  orientation by spanning tree, overlap graph, transitive reduction, node-based
  unitigs (never jump between repeat copies), greedy layout, consensus,
  placement/correctness against the genome, mate pairs and scaffolding,
  Lander–Waterman, N50/L50.
- `js/msaEngine.js` – FASTA parsing, UPGMA guide tree, profile–profile
  progressive alignment, column statistics (entropy, information, PSSM,
  consensus) and PSSM scanning; `js/msaLogo.js` renders SVG logos.
- Example sets: `js/alignmentExamples.js`, `js/dotplotExamples.js`,
  `js/msaExamples.js` (real UniProt sequences from the course exercises). Quiz
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
- Keep sequences short enough to be readable (≤ 60 residues for the matrix
  view, ≤ 500 bp for dotplots).

## Development

Serve the directory with any static server, e.g. `python3 -m http.server 8765`,
and open `http://localhost:8765/`. Browsers cache the JS aggressively; hard-reload
after edits.
