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