# Ideas for further teaching games

Companion apps for the course at https://github.com/kavonrtep/bioinformatics
(weeks refer to `docs/Practicals.md`; topics refer to the exam list). Each
follows the pattern of the dotplot trainer: simulate → visualise → let the
student act → check with computed answers. Effort: S ≈ a day, M ≈ the dotplot
trainer, L ≈ the alignment rebuild.

Status: ☐ idea · ◐ in progress · ☑ done

## Weeks 2–4 · MSA, profiles, matrices

- ☑ **1. MSA workbench – consensus, PSSM, logo, information content** (M).
  Multi-row gap editor; progressive alignment (guide tree → profile
  alignment) that can be stepped; live sum-of-pairs score, consensus with
  threshold, PSSM (log-odds with pseudocounts), sequence logo in bits;
  click a column for counts/entropy/information. Quiz: most conserved
  column, consensus at column k, PSSM score of residue X at column k.
  Bonus: scan a sequence with the PSSM (score trace). → `msa.html`
- ☐ **2. Profile search: PSSM vs. profile HMM** (M–L). Slide the PSSM along
  a sequence; build a tiny profile HMM (match/insert/delete) from the same
  MSA and step Viterbi through it; show why the HMM copes with insertions.
  Topics: PSI-BLAST, HMM states, PSSM vs. HMM.
- ☐ **3. Build your own BLOSUM** (S–M). Count residue pairs in an aligned
  block, compute log-odds, compare with BLOSUM62; BLOSUM62 heatmap grouped
  by residue class; PAM1 → PAM250 matrix-power animation. Quiz: why W/W is
  11 and L/L is 4; which matrix for close vs. distant sequences.
- ☐ **4. Motif regex golf** (S). PROSITE-style pattern editor; write a
  pattern matching all positives and no negatives; levels up to the serine
  protease catalytic-triad motifs (exercise 3.6).

## Week 4 · BLAST

- ☑ **5. E-value playground** (M) → part of `blast.html` (experiments 3 and 5). Random database, distribution of best
  local scores (Gumbel), E = K·m·n·e^(−λS); change database size, query
  length, word size and predict the E-value; shuffle control; dust/
  low-complexity toggle. Reuses `alignEngine.js`.
- ◐ **6. Which BLAST? + six-frame translation** (S) → translated-search experiment in `blast.html`; a program-chooser quiz could still be added. Pick
  blastn/blastp/blastx/tblastn/tblastx for a query/database pair and see
  what is actually compared; ORF finder.

## Weeks 5–7 · Assembly

- ☐ **7. k-mer spectrum & genome-size estimator** (M). Simulate genome
  (repeat fraction, heterozygosity), reads (coverage, error rate), count
  k-mers, histogram; read off coverage peak, genome size, error peak,
  heterozygous half-peak, repeat multiples. Mirrors the jellyfish practical.
- ☐ **8. Overlap–layout–consensus by hand** (M). Draggable reads, overlaps
  from the local aligner, consensus; repeat-induced misassembly resolved by
  mate pairs; N50/L50 mini-game; Lander–Waterman coverage. Extends 1.8.
- ☐ **9. FASTQ & Phred decoder** (S). Decode quality strings, trim by
  threshold, spot adapters, mean quality along the read.

## Mapping

- ☐ **10. Burrows–Wheeler stepper** (M). Rotations → sort → BWT, F/L
  columns, LF-mapping, backward search stepped one character at a time;
  suffix array alongside. Quiz: count occurrences.
- ☐ **11. Read mapping with repeats and MAPQ** (M). Simulated genome with
  repeats; multi-mapping reads, MAPQ 0 explained, paired-end rescue,
  spaced seeds vs. contiguous seeds, minimizer picking.

## Week 8 · ChIP-seq

- ☐ **12. Peak-calling sandbox** (M). Simulated ChIP and input coverage with
  planted sites; threshold/fold-change; true vs. false peaks; what happens
  without input or with one replicate.

## RNA-seq

- ☐ **13. Normalisation & multiple-testing simulator** (M). RPKM vs. TPM on
  toy samples; 1 000 null genes and the number "significant" at p < 0.05
  vs. BH-FDR; add true changes and vary replicates; live volcano/MA plots.

## Week 9 · Phylogenetics

- ☐ **14. UPGMA / Neighbor-Joining by hand** (M). Distance matrix from an
  MSA; student picks the pair to join and enters new distances; tree grows;
  ultrametric vs. not.
- ☐ **15. Tree-reading quiz** (S). Generated trees as cladogram/phylogram,
  rooted/unrooted: sisters, monophyly, same-tree recognition, Newick.
- ☐ **16. Parsimony & tree search** (M). Fitch counting, NNI moves to lower
  the score, bootstrap by column resampling, a planted long-branch
  attraction case.

## Week 10 · Structure

- ☐ **17. Sequence-to-structure predictor** (S–M). Kyte–Doolittle hydropathy
  with window slider, Chou–Fasman propensities with student prediction,
  heptad helical wheel for coiled coils, draggable Ramachandran φ/ψ.

## Cross-cutting

- ☐ **18. Format decoder** (S). FASTA/FASTQ/SAM/VCF/GFF3/BED snippets:
  identify format, extract fields, 1-based ↔ 0-based conversion, CIGAR.
- ☐ **19. Gene-structure annotator** (M). Synthetic gene with exons, GT-AG
  introns, UTRs; six-frame translation; mark ORF/exons/splice sites, export
  GFF3, compare with truth; RNA-seq coverage as evidence.

## Suggested order

1 (MSA workbench) → 5 (E-value) → 7 (k-mer spectrum) → 15 + 14 (trees) →
10 (BWT) and 18 (formats).
