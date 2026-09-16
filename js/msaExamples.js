/**
 * MSA WORKBENCH EXAMPLES
 * ======================
 * Synthetic sets for hand editing and real protein sets from the course
 * exercises (UniProt accessions in the notes). Quiz answers are functions of
 * ctx = { M: MsaEngine, E: AlignEngine, rows (automatic alignment), names,
 * stats (columnStats of the automatic alignment), I (identity matrix), params, type }.
 * Column numbers in questions are 1-based.
 */
const MSA_EXAMPLES = {
    'promoter': {
        name: 'DNA: promoter fragments with a TATA box (synthetic)',
        group: 'Hands-on',
        description: 'Eight short promoter-like sequences sharing a TATA box and a downstream GC box at slightly different spacings.',
        notes: 'Small enough to align by hand: put the TATAAA blocks under each other, then the GGGCGG blocks; the gaps between them differ by 1–2 bp. Watch the logo: conserved blocks become tall, the variable spacer stays flat. Try the consensus threshold and compare the IUPAC consensus with the logo.',
        params: { gapOpen: -4, gapExtend: -1 },
        sequences: [
            { name: 'p1', seq: 'GCTATAAAAGGCTGGGCGGAGCT' },
            { name: 'p2', seq: 'GATATAAATGGCGGGGCGGTGCA' },
            { name: 'p3', seq: 'GCTATATAAGGCAGGGCGGAGC' },
            { name: 'p4', seq: 'GTTATAAAAGGTGGGCGGACT' },
            { name: 'p5', seq: 'GCTATAAAAGGCTTGGGCGGAGCC' },
            { name: 'p6', seq: 'ACTATAAATGGGCTGGGCGGTG' },
            { name: 'p7', seq: 'GCCATAAAAGGCTGGGCGGAGCT' },
            { name: 'p8', seq: 'GCTATAAAAGGCAGGGGCGGAGCT' }
        ],
        questions: [
            { q: 'Which column has the highest information content?', type: 'number', answer: c => c.M.bestColumn(c.stats).index + 1, tolerance: 0, explanation: c => `Column ${c.M.bestColumn(c.stats).index + 1} (${c.M.bestColumn(c.stats).info.toFixed(2)} bits): every sequence has the same base there and no gaps.` },
            { q: 'How many columns are fully conserved (same base in all sequences, no gaps)?', type: 'number', answer: c => c.stats.columns.filter(x => x.conserved).length, tolerance: 0, explanation: () => 'Count the columns whose logo stack reaches the maximum height with a single letter.' },
            { q: 'What is the maximum possible information content of a DNA column (bits)?', type: 'number', answer: () => 2, tolerance: 0, explanation: () => 'log2(4) = 2 bits: four equally likely bases carry 2 bits of uncertainty; a fully conserved column removes all of it.' }
        ]
    },
    'peptides': {
        name: 'Protein: nucleotide-binding motif GxGxxG (synthetic)',
        group: 'Hands-on',
        description: 'Six short peptides sharing the Rossmann-fold glycine-rich motif GxGxxG, with small insertions between them.',
        notes: 'Align the G-x-G-x-x-G blocks first; the flanks differ in length by 1–3 residues. In the logo the three glycines dominate while the x positions show mixtures of similar residues. Look at the PSSM row for G in the motif columns – strongly positive – and compare with the flanks.',
        params: { gapOpen: -8, gapExtend: -1 },
        sequences: [
            { name: 'pep1', seq: 'MKVAVLGAGGVGKSALTVQ' },
            { name: 'pep2', seq: 'MRKIAVIGAGNIGRALAIRL' },
            { name: 'pep3', seq: 'MSNVLILGGGAVGTSLAKEL' },
            { name: 'pep4', seq: 'MTKLAVLGAGGIGSALVRE' },
            { name: 'pep5', seq: 'MEQPKVAVVGAGGIGKATLNQF' },
            { name: 'pep6', seq: 'MAKIGIIGAGGVGLALAHYL' }
        ],
        questions: [
            { q: 'How many fully conserved columns does the alignment have?', type: 'number', answer: c => c.stats.columns.filter(x => x.conserved).length, tolerance: 0, explanation: () => 'The glycines of the motif and a few flanking residues.' },
            { q: 'What is the PSSM score (log-odds, bits) of G in the most conserved glycine column? (±0.2)', type: 'number', answer: c => c.M.bestColumn(c.stats, 'G').pssm.G, tolerance: 0.2, explanation: c => `Column ${c.M.bestColumn(c.stats, 'G').index + 1}: log2(frequency / background) with background 0.074 for glycine = ${c.M.bestColumn(c.stats, 'G').pssm.G.toFixed(2)} bits.` },
            { q: 'What is the maximum information content of a protein column (bits)? (±0.05)', type: 'number', answer: () => Math.log2(20), tolerance: 0.05, explanation: () => 'log2(20) = 4.32 bits.' }
        ]
    },
    'globins': {
        name: 'Globins: human and mouse Hb α, Hb β, myoglobin, neuroglobin (exercise 3.5)',
        group: 'Course data',
        description: 'The eight globins of exercise 3.5 (UniProt P69905, P68871, P02144, Q9NPG2, P01942, P02088, P04247, Q9ER97).',
        notes: 'Too long to align by hand – use the automatic alignment and step through the merges: the guide tree pairs each human protein with its mouse ortholog first (the closest sequences), then joins paralogs. The proximal histidine that binds the heme iron (His87 in Hb α, F8 in the helix nomenclature) is one of the few fully conserved columns; find it in the logo.',
        params: { gapOpen: -10, gapExtend: -1 },
        sequences: [
                { name: 'HBA_HUMAN', seq: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR' },
                { name: 'HBB_HUMAN', seq: 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH' },
                { name: 'MYG_HUMAN', seq: 'MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGATVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPVKYLEFISECIIQVLQSKHPGDFGADAQGAMNKALELFRKDMASNYKELGFQG' },
                { name: 'NGB_HUMAN', seq: 'MERPEPELIRQSWRAVSRSPLEHGTVLFARLFALEPDLLPLFQYNCRQFSSPEDCLSSPEFLDHIRKVMLVIDAAVTNVEDLSSLEEYLASLGRKHRAVGVKLSSFSTVGESLLYMLEKCLGPAFTPATRAAWSQLYGAVVQAMSRGWDGE' },
                { name: 'HBA_MOUSE', seq: 'MVLSGEDKSNIKAAWGKIGGHGAEYGAEALERMFASFPTTKTYFPHFDVSHGSAQVKGHGKKVADALASAAGHLDDLPGALSALSDLHAHKLRVDPVNFKLLSHCLLVTLASHHPADFTPAVHASLDKFLASVSTVLTSKYR' },
                { name: 'HBB1_MOUSE', seq: 'MVHLTDAEKAAVSCLWGKVNSDEVGGEALGRLLVVYPWTQRYFDSFGDLSSASAIMGNAKVKAHGKKVITAFNDGLNHLDSLKGTFASLSELHCDKLHVDPENFRLLGNMIVIVLGHHLGKDFTPAAQAAFQKVVAGVATALAHKYH' },
                { name: 'MYG_MOUSE', seq: 'MGLSDGEWQLVLNVWGKVEADLAGHGQEVLIGLFKTHPETLDKFDKFKNLKSEEDMKGSEDLKKHGCTVLTALGTILKKKGQHAAEIQPLAQSHATKHKIPVKYLEFISEIIIEVLKKRHSGDFGADAQGAMSKALELFRNDIAAKYKELGFQG' },
                { name: 'NGB_MOUSE', seq: 'MERPESELIRQSWRVVSRSPLEHGTVLFARLFALEPSLLPLFQYNGRQFSSPEDCLSSPEFLDHIRKVMLVIDAAVTNVEDLSSLEEYLTSLGRKHRAVGVRLSSFSTVGESLLYMLEKCLGPDFTPATRTAWSRLYGAVVQAMSRGWDGE' }
            ],
        questions: [
            { q: 'Pairwise identity between HBA_HUMAN and HBA_MOUSE in the automatic alignment (%)? (±1)', type: 'number', answer: c => Math.round(c.I[0][4] * 100), tolerance: 1, explanation: () => 'Orthologs across mammals are typically 80–90 % identical.' },
            { q: 'Pairwise identity between HBA_HUMAN and HBB_HUMAN (%)? (±1)', type: 'number', answer: c => Math.round(c.I[0][1] * 100), tolerance: 1, explanation: () => 'Paralogs that duplicated before the mammalian radiation – much lower than the ortholog pair.' },
            { q: 'How many columns are fully conserved across all eight globins?', type: 'number', answer: c => c.stats.columns.filter(x => x.conserved).length, tolerance: 0, explanation: () => 'Very few – globins keep their fold with little sequence identity; the conserved ones are structurally essential (heme contacts, helix packing).' }
        ]
    },
    'proteases': {
        name: 'Serine proteases: trypsin, chymotrypsinogen, elastase, human and mouse (exercise 3.6)',
        group: 'Course data',
        description: 'Six chymotrypsin-family proteases (UniProt P07477, P17538, P08246, P07146, Q9CR35, Q3UP87).',
        notes: 'The catalytic triad His57–Asp102–Ser195 (chymotrypsin numbering) must be conserved in every active protease. The serine sits in the motif GDSGGP: after automatic alignment look for the tallest S in the logo. Because the alignment is long, use the PSSM table and the column detail panel rather than reading the letters.',
        params: { gapOpen: -10, gapExtend: -1 },
        sequences: [
                { name: 'TRY1_HUMAN', seq: 'MNPLLILTFVAAALAAPFDDDDKIVGGYNCEENSVPYQVSLNSGYHFCGGSLINEQWVVSAGHCYKSRIQVRLGEHNIEVLEGNEQFINAAKIIRHPQYDRKTLNNDIMLIKLSSRAVINARVSTISLPTAPPATGTKCLISGWGNTASSGADYPDELQCLDAPVLSQAKCEASYPGKITSNMFCVGFLEGGKDSCQGDSGGPVVCNGQLQGVVSWGDGCAQKNKPGVYTKVYNYVKWIKNTIAANS' },
                { name: 'CTRB1_HUMAN', seq: 'MASLWLLSCFSLVGAAFGCGVPAIHPVLSGLSRIVNGEDAVPGSWPWQVSLQDKTGFHFCGGSLISEDWVVTAAHCGVRTSDVVVAGEFDQGSDEENIQVLKIAKVFKNPKFSILTVNNDITLLKLATPARFSQTVSAVCLPSADDDFPAGTLCATTGWGKTKYNANKTPDKLQQAALPLLSNAECKKSWGRRITDVMICAGASGVSSCMGDSGGPLVCQKDGAWTLVGIVSWGSDTCSTSSPGVYARVTKLIPWVQKILAAN' },
                { name: 'ELNE_HUMAN', seq: 'MTLGRRLACLFLACVLPALLLGGTALASEIVGGRRARPHAWPFMVSLQLRGGHFCGATLIAPNFVMSAAHCVANVNVRAVRVVLGAHNLSRREPTRQVFAVQRIFENGYDPVNLLNDIVILQLNGSATINANVQVAQLPAQGRRLGNGVQCLAMGWGLLGRNRGIASVLQELNVTVVTSLCRRSNVCTLVRGRQAGVCFGDSGSPLVCNGLIHGIASFVRGGCASGLYPDAFAPVAQFVNWIDSIIQRSEDNPCPHPRDPDPASRTH' },
                { name: 'TRY2_MOUSE', seq: 'MSALLILALVGAAVAFPVDDDDKIVGGYTCRESSVPYQVSLNAGYHFCGGSLINDQWVVSAAHCYKYRIQVRLGEHNINVLEGNEQFVDSAKIIRHPNYNSWTLDNDIMLIKLASPVTLNARVASVPLPSSCAPAGTQCLISGWGNTLSNGVNNPDLLQCVDAPVLPQADCEASYPGDITNNMICVGFLEGGKDSCQGDSGGPVVCNGELQGIVSWGYGCAQPDAPGVYTKVCNYVDWIQNTIADN' },
                { name: 'CTRB1_MOUSE', seq: 'MAFLWLVSCFALVGATFGCGVPAIQPVLTGLSRIVNGEDAIPGSWPWQVSLQDRTGFHFCGGSLISENWVVTAAHCGVKTTDVVVAGEFDQGSDEENVQVLKIAQVFKNPKFNSFTVRNDITLLKLATPAQFSETVSAVCLPTVDDDFPAGTLCATTGWGKTKYNALKTPDKLQQAALPIVSEAKCKESWGSKITDVMICAGASGVSSCMGDSGGPLVCQKDGVWTLAGIVSWGSGFCSTSTPAVYARVTALMPWVQEILEAN' },
                { name: 'ELNE_MOUSE', seq: 'MALGRLSSRTLAAMLLALFLGGPALASEIVGGRPARPHAWPFMASLQRRGGHFCGATLIARNFVMSAAHCVNGLNFRSVQVVLGAHDLRRQERTRQTFSVQRIFENGFDPSQLLNDIVIIQLNGSATINANVQVAQLPAQGQGVGDRTPCLAMGWGRLGTNRPSPSVLQELNVTVVTNMCRRRVNVCTLVPRRQAGICFGDSGGPLVCNNLVQGIDSFIRGGCGSGLYPDAFAPVAEFADWINSIIRSHNDHLLTHPKDREGRTN' }
            ],
        questions: [
            { q: 'In which alignment column is the catalytic serine (the S of the GDSGGP motif)?', type: 'number', answer: c => c.M.motifColumn(c.rows[0], 'GDSGGP', 2) + 1, tolerance: 0, explanation: c => `Column ${c.M.motifColumn(c.rows[0], 'GDSGGP', 2) + 1}: the GDSGGP motif is identical in all six sequences.` },
            { q: 'How many columns are fully conserved?', type: 'number', answer: c => c.stats.columns.filter(x => x.conserved).length, tolerance: 0, explanation: () => 'Catalytic residues, the disulfide cysteines and the residues lining the specificity pocket.' },
            { q: 'Pairwise identity between TRY1_HUMAN and TRY2_MOUSE (%)? (±1)', type: 'number', answer: c => Math.round(c.I[0][3] * 100), tolerance: 1, explanation: () => 'Orthologous trypsins.' }
        ]
    },
    'hspb8': {
        name: 'HSPB8 small heat-shock proteins, 8 vertebrates (exercise 3.2)',
        group: 'Course data',
        description: 'The HSPB8 sequences from the course data (data/alignment_sequences/HSP8.fasta).',
        notes: 'The α-crystallin domain in the C-terminal half is conserved, the N-terminal region is variable and full of gaps. Compare the logo of the two halves, and see how the consensus threshold changes what is reported as conserved.',
        params: { gapOpen: -10, gapExtend: -1 },
        sequences: [
                { name: 'Gallus_gallus', seq: 'MADSQLPFSCHYPGRRSLRDPFREPGLTSRLLDDDFGLSPFPGDLTADWPDWARPRLTPTWPGPLRARASAMAPGYSTRFGGYPESRSPAPTSREPWKVCVNVHSFKPEELTVKTKDGYVEVSGKHEEQQVEGGIVSKNFTKKIQLPYEVDPITVFASLSPEGLLIIEAPQIPPYQQYGEGGCSGEIPLESPEATCA' },
                { name: 'Drosophila_melanogaster', seq: 'MSVVPLMFRDWWDELDFPMRTSRLLDQHFGQGLKRDDLMSSVWNSRPTVLRSGYLRPWHTNSLQKQESGSTLNIDSEKFEVILDVQQFSPSEITVKVADKFVIVEGKHEEKQDEHGYVSRQFSRRYQLPSDVNPDTVTSSLSSDGLLTIKAPMKALPPPQTERLVQITQTGPSSKEDNAKKVETSTA' },
                { name: 'Xenopus_laevis', seq: 'MADSQLPFTCHYPSNRHRGSRDPFREQGLSSRLLDDDFGIPPFSDDLTMNWPDWVRPRLTSSWSGPLRSGLMRTSGISPPVYNFSYTGNPEPRNTVANVSQPWKVCVNVQTFMPEELTVKTKDGFVEVSGNHEEQQKEGGIVSKNFTKKIQLPPEVDALTVFASLSPEGLLIIEAPLVPPYNQQGDDSYTYELPLDPQEVCAS' },
                { name: 'Mus_musculus', seq: 'MADGQLPFPCSYPSRLRRDPFRDSPLSSRLLDDGFGMDPFPDDLTAPWPEWALPRLSSAWPGTLRSGMVPRGPPATARFGVPAEGRSPPPFPGEPWKVCVNVHSFKPEELMVKTKDGYVEVSGKHEEKQQEGGIVSKNFTKKIQLPAEVDPATVFASLSPEGLLIIEAPQVPPYSPFGESSFNNELPQDNQEVTCS' },
                { name: 'Bos_taurus', seq: 'MADGQMPFPCHYTSRRRRDPFRDSPLSSRLLDDGFGMDPFPDDLTASWPDWALPRLSSAWPGTLRSGMVPRGPTAMTRFGVPAEGRSPPPFPGEPWKVCVNVHSFKPEELMVKTKDGYVEVSGKHEEKQQEGGIVSKNFTKKIQLPAEVDPVTVFASLSPEGLLIIEAPQVPPYSPFGESSFNNELPQDGQEVTCT' },
                { name: 'Danio_rerio', seq: 'MAEGDYYTLGNRQRIPRDPFREQSLASRFMDDDFGLPPFPNELSMDWPGWARPRLSHRLDAPWTGSLRSGFPRASMSSPQGFSSVYTESPRRASAPPTDSDEPWKVCVNVHSFKPEELNVKTKDGFVEVSGKHEEKQDEGGIVTKNFTKKIQIPLDVDPVTVFASLSPEGVLIIEARQTPPYYLYSNEMPAESMEEPEARPQEPSMTSTTTFEARE' },
                { name: 'Sus_scrofa', seq: 'MADGQMPFPCHYASRRRRDPFRDSPLSSRLLDDGFGMDPFPDDLTASWPDWALPRLSSAWPGTLRSGMVPRGPTSMARFGVPAEGRSPPPFPGEPWKVCVNVHSFKPEELMVKTKDGYVEVSGKHEEKQQEGGIVSKNFTKKIQLPAEVDPVTVFASLSPEGLLIIEAPQVPPYSPFGESSFNNELPQDNQEVTCT' },
                { name: 'Homo_sapiens', seq: 'MADGQMPFSCHYPSRLRRDPFRDSPLSSRLLDDGFGMDPFPDDLTASWPDWALPRLSSAWPGTLRSGMVPRGPTATARFGVPAEGRTPPPFPGEPWKVCVNVHSFKPEELMVKTKDGYVEVSGKHEEKQQEGGIVSKNFTKKIQLPAEVDPVTVFASLSPEGLLIIEAPQVPPYSTFGESSFNNELPQDSQEVTCT' }
            ],
        questions: [
            { q: 'What is the mean pairwise identity over all pairs (%)? (±1)', type: 'number', answer: c => Math.round(c.M.meanIdentity(c.I) * 100), tolerance: 1, explanation: () => 'Average of the off-diagonal entries of the identity matrix.' },
            { q: 'How many alignment columns contain a gap in at least one sequence?', type: 'number', answer: c => c.stats.columns.filter(x => x.gaps > 0).length, tolerance: 0, explanation: () => 'Mostly in the variable N-terminal region.' }
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MSA_EXAMPLES;
}
