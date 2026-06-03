# CLAUDE.md

This file provides guidance to Claude Code when working with the **vendored
`ui-ux-pro-max` design-intelligence bundle** inside this repository.

> This is a vendored copy of
> [`nextlevelbuilder/ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
> (MIT). It was imported so the design skills are available in Claude Code web
> sessions for this repo. The upstream `.github/workflows/` were intentionally
> omitted, and the original symlinks were replaced with real files so the
> active skill is self-contained.

## Project Overview

`ui-ux-pro-max` is an AI-powered design-intelligence toolkit: searchable
databases of UI styles, color palettes, font pairings, chart types, and UX
guidelines, exposed as a Claude Code skill. It is **stack-agnostic** — the
skill auto-detects the host project's stack and tailors its guidance.

## Where things live in THIS repo

```
.claude/skills/                       # ACTIVE skills (auto-discovered by Claude Code)
├── ui-ux-pro-max/                    # flagship skill — real data/ + scripts/ (no symlinks)
│   ├── SKILL.md                      # stack-agnostic instructions (edit this for behavior)
│   ├── scripts/                      # search.py, core.py, design_system.py
│   └── data/                         # canonical CSV databases + data/stacks/
├── ui-styling/  design/  brand/      # supporting skills
├── design-system/  slides/  banner-design/

.claude-plugin/                       # marketplace.json + plugin.json (repo is also a valid marketplace)
skill.json                            # plugin manifest

ui-ux-pro-max-skill/                  # the rest of the upstream bundle (this folder)
├── src/ui-ux-pro-max/                # original upstream source (data/scripts/templates) — reference copy
├── cli/                              # uipro-cli npm installer (not used by this repo)
├── docs/  preview/  screenshots/     # upstream docs & assets
└── CLAUDE.md  LICENSE  README.md
```

**Canonical runtime copy:** `.claude/skills/ui-ux-pro-max/`. That is what
Claude Code actually loads and runs. The `ui-ux-pro-max-skill/src/` tree is the
original upstream source, kept for reference only.

## Search Command

Run against the active skill copy:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> [-n <max_results>]
```

**Domains:** `product`, `style`, `typography`, `color`, `landing`, `chart`,
`ux`, `google-fonts`, `react`, `web`, `prompt`. Domain auto-detection runs when
`--domain` is omitted. Add `--design-system` for a full recommendation set.

**Stack search** (16 supported stacks — pass the one the project uses):

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

`react`, `nextjs`, `vue`, `nuxtjs`, `nuxt-ui`, `svelte`, `astro`, `angular`,
`html-tailwind`, `shadcn`, `threejs`, `react-native`, `flutter`, `swiftui`,
`jetpack-compose`, `laravel`.

The engine uses BM25 ranking combined with regex matching.

## Editing Notes

- **To change skill behavior/guidance:** edit
  `.claude/skills/ui-ux-pro-max/SKILL.md`.
- **To change data or search logic:** edit the CSVs / Python under
  `.claude/skills/ui-ux-pro-max/{data,scripts}/` — this is the copy that runs.
- The symlinks the upstream repo used are gone; the `ui-ux-pro-max-skill/src/`
  copy and the active `.claude/skills/` copy are **independent**. If you change
  the data and want the reference source to match, update both, or treat
  `.claude/skills/` as the single source of truth and ignore `src/`.
- The `cli/` installer and upstream sync rules do not apply to this repo.

## Prerequisites

Python 3.x (no external dependencies required).
