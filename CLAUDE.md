# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Interactive Sequence Alignment Trainer** - an educational web-based game designed to teach bioinformatics concepts, specifically pairwise sequence alignment. The project is currently in the planning/specification phase with only a detailed README document present.

## Technology Stack

The project is planned to be implemented using:
- **HTML** - Structure and layout
- **CSS** - Styling and visual design  
- **JavaScript** - Interactive functionality and game logic

## Project Structure

Currently, the repository contains only:
- `readme.md` - Comprehensive game specification and requirements

**No implementation files exist yet** - this is a greenfield project ready for initial development.

## Core Application Architecture (Planned)

Based on the specification, the application will have:

### Main Components
- **Sequence Input Area** - Text fields for DNA/RNA/protein sequences (5-50 chars)
- **Interactive Alignment Editor** - Core game interface allowing gap insertion/removal with keyboard navigation
- **Scoring Controls** - Sliders for match/mismatch/gap penalties
- **Dotplot Visualization** - Real-time similarity visualization
- **Statistics Panel** - Score tracking and alignment metrics

### Key Features
- Real-time scoring system with configurable parameters
- Visual feedback using bioinformatics color schemes (nucleotides: 4 colors, amino acids: Clustal scheme)
- Interactive dotplot with threshold filtering
- Keyboard-driven navigation and editing
- Educational progression system with difficulty levels

## Development Commands

**No build system is currently configured.** When implementing:
- Standard web development workflow (HTML/CSS/JS files served directly)
- Consider adding a simple HTTP server for development
- No package.json or build tools are present yet

## Implementation Notes

The project focuses on educational interactivity with:
- Constraint-based editing (gaps only, preserve sequence integrity)
- Real-time score calculation and visual updates
- Responsive design for classroom/tablet use
- Accessibility features (keyboard navigation, color-blind friendly)

## Next Steps for Development

1. Create basic HTML structure with main panel and side panel layout
2. Implement sequence input validation and preprocessing
3. Build interactive alignment editor with keyboard controls
4. Add real-time scoring system
5. Develop dotplot visualization component
6. Integrate educational features and progression system