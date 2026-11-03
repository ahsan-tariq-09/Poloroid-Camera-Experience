# Design and animation skills

All four requested repositories are installed as project-local agent skills in
`.agents/skills/`. They teach Codex how to work on Poloroid; they are not MCP
servers and do not require an MCP connection or account. This installation
does not change the website's appearance or add browser dependencies.

Open `C:\GitHub\Poloroid Photobooth` as the project when using them. The skills
will be available on the next turn in that project. `AGENTS.md` also points
agents to the installed files and records Poloroid's existing design constraints.
This resources-folder chat can access them by their full filesystem paths.

## Installed inventory

| Repository | Installed skills | Purpose |
| --- | --- | --- |
| [transitions.dev](https://github.com/Jakubantalik/transitions.dev) | `transitions-dev`, `transitions-polish`, `transitions-ui-generation` | CSS recipes, motion tuning, optional UI-generation reveal |
| [Impeccable](https://github.com/pbakaus/impeccable) | `impeccable` | Design, critique, audit, polish, responsive layout, accessibility, and other commands within the skill |
| [GSAP skills](https://github.com/greensock/gsap-skills) | `gsap-core`, `gsap-frameworks`, `gsap-performance`, `gsap-plugins`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils` | GSAP API, React integration, timelines, scrolling, plugins, utilities, and performance |
| [Make Interfaces Feel Better](https://github.com/jakubkrehel/make-interfaces-feel-better) | `make-interfaces-feel-better` | Interface craft and interaction reviews |

There are **13 skills**. Impeccable's commands are playbooks within one skill,
not separate missing skills. Reference files, launchers, and other resources
inside the installed skill directories are included. The Transitions live
agent and Refine relay are separate optional tools, not part of this skills
installation; paid recipes still require the provider's access.

## How to use them later

Use a skill by name, or describe the intended outcome. Example requests:

- “Use $impeccable to audit Poloroid's editor for accessibility and mobile layout.”
- “Use $impeccable to polish the Start screen while keeping the warm paper design.”
- “Use $make-interfaces-feel-better to review the editor's controls.”
- “Use $transitions-dev to improve the upload dialog's open and close animation.”
- “Use $transitions-polish to review the timing of existing animations.”
- “Use $gsap-react and $gsap-timeline to build a coordinated photo reveal.”
- “Use $transitions-ui-generation for a skeleton-to-interface reveal.”

These are instructions for Codex, not commands to paste into a terminal.
Natural-language requests also work if the agent reads the matching skill.

## Runtime and helper setup

Poloroid currently uses `motion/react`, CSS, and a separate presentation model
for canvas animation. Keep that architecture unless a feature warrants a change.
The GSAP skills do not install `gsap` or `@gsap/react`. Install those packages
with pnpm as part of a feature that actually imports them.

Impeccable includes a Windows launcher at
`.agents/skills/impeccable/scripts/impeccable.cmd`. Its helper binary is local
tooling, excluded from Git and deployments. The launcher can fetch its pinned
engine on another machine after verifying the published checksum. For example,
from the project root in PowerShell:

```powershell
& .\.agents\skills\impeccable\scripts\impeccable.cmd engine-probe
```

When a design task calls for Impeccable, follow its setup instructions to load
context. The existing design document is `docs/DESIGN.md`. No hooks, live
browser relay, or background services are enabled by this installation.

## Sources, updates, and licenses

`design-skills.lock.json` records the exact GitHub revisions, upstream paths,
installed directories, and SHA-256 of each `SKILL.md`. These are vendored
snapshots, so they do not update silently. To update, review an upstream revision,
replace the corresponding skill directories with the Skill Installer, preserve
the notices, and refresh the lock record.

Upstream license files are retained in `design-skill-licenses/`. Transitions
also includes its license in each skill directory; its terms permit use in
personal and commercial projects and restrict redistribution as a competing
library or kit. Impeccable is Apache-2.0 with its NOTICE retained. The GSAP
skills and Make Interfaces Feel Better skill are MIT. The GSAP runtime has
its own license, separate from the MIT skill documentation.

Agent skills, helper binaries, and agent instructions are excluded from Vercel
uploads and Docker build context. They are never placed in `public/` or imported
by the website.
