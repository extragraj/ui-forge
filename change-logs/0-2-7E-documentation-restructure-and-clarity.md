# 0.2.7E — Documentation Restructure & Cross-Platform Clarity

**Date:** 2026-05-06
**Scope:** Major README reorganization for better user onboarding, CLAUDE.md condensing, SKILL.md cross-platform updates, and improved skill-root detection.

## Restructured README for improved information architecture

**Issue:** The README had documentation scattered across multiple top-level sections with inconsistent organization. Users searching for manual invocation steps had to jump between "Bash Invocation", "Other CLIs / Bash", and "Capturing Forge Stdout Output". Page conversion documentation was a standalone section rather than grouped under Features.

**Fix:** Reorganized README with:

### Clearer installation flow
- Collapsed "Installation" and "Initialize Slash Commands & Permissions" into a cohesive two-step process
- Added flag reference table immediately after installation commands
- Moved CLI auto-detection explanation into the installation step itself

### New "Advanced: Manual Invocation & Inspection" section
- Consolidated all manual invocation guidance under one parent heading
- **"Resolving SKILL_ROOT in Your Terminal"** — separate subsections for each shell (CMD, PowerShell, Bash, Zsh) with complete working examples
- **"Capturing Generation Context"** — moved from "Capturing Forge Stdout Output" with improved formatting

### Consolidated "Bash Invocation (AI Agents)" section
- Replaced confusing "Other CLIs / Bash" heading with clearer "Bash Invocation (AI Agents)"
- Explained when and why agents use bash invocation vs slash commands
- Streamlined `SKILL_ROOT` resolution narrative (auto-discover approach first, then specific path)

### Moved "Page Conversion (Two-Stage)" into Features
- Changed from top-level `## Page Conversion (Two-Stage)` to `### Page Conversion (Two-Stage)` subsection under Features
- Positioned immediately after Signal-Based Generation (where `CONVERT_PAGE` is already documented)
- Improves reader flow: "Oh, `CONVERT_PAGE` does two-stage → here's how to use it"

## Condensed CLAUDE.md for better maintainability

**Issue:** CLAUDE.md had grown to 306 lines with repetitive command examples, verbose architecture descriptions, and redundant references to the command table already in README.

**Fix:** Reduced CLAUDE.md from 306 to 109 lines while preserving all essential guidance:

- **Simplified introduction** — clearer explanation of what UI Forge is and its key principle
- **Condensed versioning** — removed step-by-step versioning walkthrough; points to README for details
- **Converted "Architecture" to concise tables** — seven script descriptions replaced verbose prose; "Signal composition" and "Prompt patterns" sections now reference-friendly
- **Removed redundant command examples** — deleted 100+ lines of CLI examples (all covered in README and SKILL.md)
- **Clearer file roles** — pre-processing pipeline now a bullet list, not prose paragraphs
- **Added "Key directories" table** — at-a-glance reference for the project structure
- **"Environment" section** — moved to end, simplified

CLAUDE.md is now a **developers' quick reference** (architecture overview and principles), not a command catalogue.

## Updated SKILL.md for cross-platform clarity

**Issue:** SKILL.md mentioned only "Claude Code" but the skill works across Cursor, Codex CLI, and other agentic platforms. Claude Design features were not clearly marked as Claude.ai-only.

**Fix:**

- **Updated "Scan synthesis model"** — added "AntiGravity, and other agentic platforms" so users don't assume Claude Code is the only place the skill runs
- **Renamed section header** — "Claude Code (slash commands)" → "Slash Commands (Agentic CLI)" to signal platform-agnostic availability
- **Added platform-specific badges** — marked Claude Design features (handoff, export) with "(Claude.ai exclusive)" notes
- **Improved SKILL_ROOT resolution** — added auto-discover example first, then direct path approach; clearer explanation of when to use each

## Fixed detect.js for symlink-aware skill-root resolution

**Issue:** The detect.js CLI detection could fail when the script was invoked via symlink or indirect path. The `process.argv[1]` check was brittle and didn't properly fall back to environment-based detection.

**Fix:**

- **Resolved argv properly** — use `resolve(process.argv[1])` to handle symlinks and relative paths
- **Improved isMain check** — detect both direct invocation and symlink invocations correctly
- **Clearer CLI path logic** — extract skill root from the invoked script path first, then fall back to environment-based search
- **Better comments** — documented that the skill root is returned relative to invoked script location, not loaded file location

## Clarity improvements throughout

- Removed version notation like "0.2.1+" in favor of plain language ("Standard now supports directories")
- Fixed typo in references table (truncated "compatibility matrix" line in README)
- Improved wording in multiple sections for non-native English clarity
- Consistent terminology: "handoff" vs "Claude Design" used with precision

## Files changed

| File | Change |
|------|--------|
| `README.md` | Restructured installation, moved Advanced section to top of manual invocation, consolidated Bash guidance, moved Page Conversion to Features subsection, improved clarity throughout |
| `CLAUDE.md` | Condensed from 306 to 109 lines; converted architecture descriptions to tables; removed redundant command examples; added Key directories table |
| `SKILL.md` | Updated scan synthesis model to mention cross-platform support; renamed section to "Slash Commands (Agentic CLI)"; marked Claude Design features as Claude.ai-exclusive; improved SKILL_ROOT documentation |
| `scripts/detect.js` | Fixed symlink-aware skill-root detection; improved argv resolution and isMain check; added fallback logic documentation |

## User impact

- **Onboarding friction reduced** — users can now find manual invocation steps without jumping between sections
- **Cross-platform clarity** — users on Cursor, Codex, and other platforms see they're fully supported
- **Maintenance burden reduced** — CLAUDE.md is now a reference, not a duplicate command catalogue
- **Skill root detection more robust** — resolves edge cases with symlinks and indirect invocations
