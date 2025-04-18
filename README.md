# MONGTENDO64 FPS Game

A retro-inspired first-person shooter with physics-based movement, multiple weapons, and advanced enemy AI with pathfinding capabilities.

## Features

- Three.js for 3D rendering
- Rapier physics engine for collision detection
- Custom AI systems for enemy behavior including advanced pathfinding
- First-person shooter mechanics
- Sound management system

## Setup

`ash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
``n
## Enemy Behavior

The DNB (Demon NightBlood) enemy uses advanced pathfinding to navigate around obstacles when pursuing the player. When a direct path is blocked, it will calculate the best alternative route to reach the player.

## Source Code Structure

- \src/components/\ - Core game components (Player, Enemies, Weapons)
- \src/physics/\ - Physics engine integration
- \src/core/\ - Core game engine and mechanics
- \src/audio/\ - Audio management system

## Note

This repository contains only source code. Assets are not included to keep the repository size manageable.
