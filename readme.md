# Interactive Sequence Alignment Trainer

## Implementation 
- html
- css
- javascript
- Use React or vanilla JS for interactivity or any other framework you prefer??

## Game Specification: Interactive Sequence Alignment Trainer

### **Core Educational Objectives**
- Understand the principles of pairwise sequence alignment
- Learn the relationship between alignment quality and biological significance
- Visualize sequence similarity through multiple representations (alignment + dotplot)
- Grasp the impact of scoring parameters on alignment outcomes

### **1. User Interface Layout**

**Main Panel (70% width):**
- **Sequence Input Area** (top): Two text fields for entering sequences
- **Interactive Alignment Editor** (center): Two aligned sequences with editor like functionality - it should allow users to insert and remove gaps, editing sequences is not allowed.
- **Scoring Controls** (bottom): Sliders for match, mismatch, and gap penalties

**Side Panel (30% width):**
- **Dotplot Visualization** (top half): Real-time dotplot of the original sequences, seqeences letters on the axes
- **Statistics Panel** (bottom half): Current score, alignment length, identity percentage, gaps count

### **2. Sequence Management**
- **Input validation**: DNA/RNA (ATCG/AUCG) or protein sequences
- **Preset examples**: Short sequences (10-20 characters) for different difficulty levels
- **Sequence length limits**: 5-50 characters to keep it manageable for students
- **Case insensitive** input with automatic uppercase conversion

### **3. Interactive Alignment Editor Features**

**Core Interactions:**
- **using keyboard arrows to navigate
- **Insert gaps** by using a space or a gap character (-)
- **Remove gaps** by using delete or backspace
- **Visual feedback**: Similar to bioinformatics programs - color coding nucleotide with four colors, amino acid using clustal color scheme
  - matches are shown in line between the sequences, the line can contain either | to indicate a match or a space to indicate a gap
  - if two bases/AA match that the color is more saturated - to do this usilize alpha channel

**Constraints:**
- Maintain sequence integrity (can't delete actual characters, only move or gap)
- Visual guides showing legal drop zones


### **4. Scoring System**

**Adjustable Parameters:**
- **Match score**: +1 to +5 (default: +2)
- **Mismatch penalty**: -1 to -5 (default: -1)
- **Gap opening penalty**: -1 to -10 (default: -2)
- **Gap extension penalty**: -0.5 to -5 (default: -0.5)

**Real-time Calculation:**
- Score updates immediately upon any alignment change
- Visual breakdown showing contribution of matches, mismatches, and gaps
- Percentage identity calculation

### **5. Dotplot Visualization**

**Features:**
- **Fixed reference**: Shows original unaligned sequences
- **Window size**: Adjustable (1-3 nucleotides for short sequences)
- **Threshold slider**: For filtering weak similarities
- **Diagonal highlighting**: Main diagonal and significant off-diagonals
- **Interactive**: Clicking on dotplot could highlight corresponding alignment regions

**Educational Value**: Helps students see sequence similarity patterns independent of alignment, reinforcing that alignment is about finding the best path through similarity space.

### **6. Educational Enhancements** (this is optional - can be added later)

**Guided Learning Mode:**
- **Tutorial sequence**: Step-by-step introduction
- **Hints system**: Suggests moves when students are stuck
- **Optimal alignment reveal**: Show the mathematically optimal alignment

**Difficulty Levels:**
1. **Beginner**: Highly similar sequences (80%+ identity)
2. **Intermediate**: Moderately similar sequences (60-80% identity)  
3. **Advanced**: Distantly related sequences with indels

**Challenge Modes:**
- **Time trials**: Achieve target score within time limit
- **Score optimization**: Find the highest possible score
- **Parameter exploration**: See how different scoring matrices affect results

### **7. Game Mechanics**

**Feedback System:**
- **Progress bar**: Shows how close current score is to optimal
- **Achievement badges**: For reaching scoring milestones
- **Move counter**: Encourages efficiency

**Comparison Feature:**
- **Reference alignment**: Show optimal or professor-provided alignment
- **Difference highlighting**: Visual comparison between student and reference alignments

### **8. Technical Considerations**

**Performance:**
- Real-time updates require efficient scoring algorithms
- Dotplot should update smoothly during alignment changes
- Consider using requestAnimationFrame for smooth interactions

**Responsive Design:**
- Works on tablets for classroom use
- Collapsible side panel for smaller screens

**Accessibility:**
- Keyboard navigation support
- Color-blind friendly palette
- High contrast mode option

### **9. Extension Ideas for Future Versions**

- **Multiple sequence alignment** mode
- **Different scoring matrices** (BLOSUM, PAM for proteins)
- **Export functionality** (save alignments as FASTA)
- **Sequence database** integration for real biological examples
- **Phylogenetic context** showing evolutionary relationships

Would you like me to elaborate on any of these components, or shall we start implementing specific parts? The alignment editor with real-time scoring would be a great starting point, as it's the core interactive element.

---

## Game 3: BLAST Algorithm Demonstration

### **Educational Objectives**
- Understand the core principles of the BLAST (Basic Local Alignment Search Tool) algorithm
- Learn the concept of k-mer based seed finding and local alignment extension
- Visualize how BLAST identifies potential alignment regions through shared k-mers
- Grasp the relationship between k-mer length and sensitivity vs. specificity
- Experience the step-by-step process of sequence database searching

### **BLAST Algorithm Steps to Demonstrate**

1. **K-mer Generation**: Break query sequence into overlapping k-mers of length L (3-6)
2. **K-mer Matching**: Find all positions in the database sequence where query k-mers match
3. **Seed Identification**: Locate shared k-mers between query and database sequence
4. **Alignment Extension**: Extend alignment bidirectionally around each seed using local alignment
5. **Scoring and Ranking**: Score extended alignments and rank by significance

### **User Interface Layout**

**Left Panel (40% width):**
- **Sequence Input Area** (top)
  - Query sequence input (shorter, 10-30 chars)
  - Database sequence input (longer, 50-200 chars)
  - K-mer length selector (3-6)
  - Load example button
- **Step Controls** (middle)
  - Step-by-step progression buttons
  - Current step indicator
  - Reset/restart functionality
- **Results Summary** (bottom)
  - Found k-mer matches count
  - Extended alignments count
  - Best alignment score

**Right Panel (60% width):**
- **Visualization Area** (full height)
  - K-mer generation display
  - Sequence comparison matrix
  - Alignment extension visualization
  - Final alignment results

### **Step-by-Step Workflow**

#### **Step 1: K-mer Generation**
**Interface:**
- Display query sequence with sliding window visualization
- Show all generated k-mers in a scrollable list
- Highlight current k-mer position on sequence
- K-mer count indicator

**Visualization:**
```
Query: ATCGATCG (k=3)
K-mers: [ATC][TCG][CGA][GAT][ATC][TCG]
        ^
Position: 0  1   2   3   4   5
```

**User Interaction:**
- Click "Generate K-mers" to see all k-mers
- Hover over k-mer to highlight position in sequence
- Adjust k-mer length to see effect on k-mer count

#### **Step 2: K-mer Matching**
**Interface:**
- Display database sequence
- Show matching positions for each query k-mer
- Color-coded matches (different colors for different k-mers)
- Match statistics panel

**Visualization:**
```
Database: GGATCGATCGAATCGTAG...
Query k-mers:
ATC: positions [2, 6, 15]  ■
TCG: positions [3, 7, 16]  ■
CGA: positions [4, 8]      ■
```

**User Interaction:**
- Click "Find Matches" to populate match table
- Click on k-mer to highlight all its matches in database
- Toggle individual k-mer visibility

#### **Step 3: Seed Identification**
**Interface:**
- Cluster nearby matches into potential alignment seeds
- Display seed regions with their coordinates
- Show seed quality metrics (match density, length)

**Visualization:**
```
Database: ----ATCGATCG----ATCG----
Seeds:    ████████████    ████
          Seed 1 (score: 12)  Seed 2 (score: 6)
          Pos: 4-11          Pos: 16-19
```

**User Interaction:**
- Click "Identify Seeds" to cluster matches
- Minimum seed length threshold slider
- Click on seed to see contributing k-mers

#### **Step 4: Alignment Extension**
**Interface:**
- For each seed, extend alignment in both directions
- Show extension process with match/mismatch scoring
- Display extended alignment with gaps if beneficial
- Extension stops when score drops below threshold

**Visualization:**
```
Extension around Seed 1:
Query:    --ATCGATCG--
          ||||||||||
Database: GGATCGATCGAA
          ^          ^
        Start      End
Score: +8 (matches) -2 (mismatches) = +6
```

**User Interaction:**
- Click "Extend Alignments" to process all seeds
- Extension threshold slider
- Step through extension process for selected seed
- Show/hide extension scoring details

#### **Step 5: Final Results**
**Interface:**
- List all significant alignments found
- Sort by score, e-value, or position
- Display full alignment details for selected result
- Comparison with different k-mer lengths

**Visualization:**
```
BLAST Results (k=3):
1. Score: 15, Query: 1-8, Database: 4-11
   Query:    ATCGATCG
             ||||||||
   Database: ATCGATCG

2. Score: 8, Query: 5-8, Database: 16-19
   Query:    ATCG
             ||||
   Database: ATCG
```

### **Educational Features**

#### **Parameter Exploration:**
- **K-mer length effects:**
  - Shorter k-mers (3): More sensitive, more false matches
  - Longer k-mers (6): More specific, fewer matches
- **Threshold effects:**
  - Extension threshold impact on alignment length
  - Seed clustering sensitivity

#### **Comparative Analysis:**
- Side-by-side comparison of different k-mer lengths
- Show trade-off between sensitivity and specificity
- Demonstrate why BLAST uses multiple approaches

#### **Interactive Learning:**
- **Guided mode**: Step-by-step tutorial with hints
- **Free exploration**: Advanced users can adjust all parameters
- **Challenge mode**: Find optimal parameters for given sequences

### **Technical Implementation Details**

#### **Data Structures:**
```javascript
class BlastDemo {
    // K-mer generation and matching
    generateKmers(sequence, k)
    findMatches(queryKmers, dbSequence)
    
    // Seed identification and clustering
    identifySeeds(matches, minSeedLength)
    clusterMatches(matches, maxDistance)
    
    // Alignment extension
    extendAlignment(seed, querySeq, dbSeq, threshold)
    scoreExtension(alignment, scoringMatrix)
    
    // Results processing
    rankAlignments(alignments)
    calculateSignificance(alignment, dbLength)
}
```

#### **Visualization Components:**
- **K-mer Generator**: Shows sliding window over sequence
- **Match Matrix**: 2D visualization of k-mer matches
- **Seed Clusters**: Grouped visualization of nearby matches
- **Extension Tracer**: Step-by-step alignment extension
- **Results Browser**: Interactive alignment viewer

#### **User Interface States:**
1. **Input State**: Sequence entry and parameter selection
2. **K-mer State**: K-mer generation and display
3. **Matching State**: Database searching and match finding  
4. **Seeding State**: Seed identification and clustering
5. **Extension State**: Alignment extension around seeds
6. **Results State**: Final alignment presentation and analysis

### **Example Sequences for Different Difficulty Levels**

#### **Beginner (High Similarity):**
```
Query:    ATCGATCGAA (10 chars)
Database: GGATCGATCGAATCGTAGCCATCGATCGAA... (80 chars)
Expected: Multiple perfect matches, clear seeds
```

#### **Intermediate (Moderate Similarity):**
```
Query:    ATCGATTGAA (10 chars)  
Database: GGATCGATCGAATCGTAGCCATCGTTCGAA... (100 chars)
Expected: Some mismatches, extension needed
```

#### **Advanced (Low Similarity):**
```
Query:    ATCGATTGAA (10 chars)
Database: CCATGGTTCGAATCGTTAGCCTTCGATCGAA... (120 chars) 
Expected: Few seeds, challenging extensions
```

### **Assessment and Learning Outcomes**

#### **Knowledge Checks:**
- What happens when k-mer length increases?
- Why does BLAST use seeds instead of full alignment?
- How does extension threshold affect results?

#### **Practical Skills:**
- Optimal parameter selection for different sequence types
- Understanding speed vs. sensitivity trade-offs
- Interpreting BLAST-like search results

This design provides a comprehensive, step-by-step exploration of BLAST fundamentals while maintaining the interactive, educational approach of the existing alignment games.



# TODO 
Dotplot Explorer is an interactive game designed to help students understand how dotplots reveal similarities between biological sequences. By inputting two sequences and adjusting parameters such as word length, students can explore how sensitivity and noise change the appearance of the plot.
Once potential patterns are visible, the Show Alignments feature highlights local alignments as connected blocks, similar to what is seen in genome synteny browsers. Through this hands-on exploration, students learn to interpret diagonals, inversions, and repeats, building intuition for how dotplots connect to real biological insights.

design will be similar to dotplot game but it is expected that the sequences will be longer - up to 200 characters
Additional feature will be functionality "show alignments" - when the user clicks on this button the program will find local alignments and highlight them on the dotplot as connected blocks - similar to what is seen in genome synteny browsers

