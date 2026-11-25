# Teacher honors modal refresh

Approved design: retain top-three podium composition, simplify to ivory/white surfaces, near-black typography and restrained MindX red. Remove metallic medals, 3D bases, confetti and glow. Portraits, names, centres and CR45 scores are the primary content. Preserve the mascot outfit entry point and modal keyboard/close behaviour.

Implementation: replace the monolithic canvas/animated presentation with a semantic responsive dialog and scoped CSS module. Keep the existing top-teachers API and weekly entry trigger. Provide real loading, empty and retry states instead of presenting fabricated winners when data is absent. Desktop uses rank 2/1/3 with the winner slightly raised; mobile keeps all three visible with readable wrapping. Verify TypeScript/lint and render desktop/mobile when available. No new backend or permission changes.

## Code reference refinement

The user clarified that references must be code components rather than Canva posters. Reviewed Trophy UI Leaderboard Podium documentation and its actual registry source: https://ui.trophy.so/docs/components/leaderboard-podium and https://ui.trophy.so/r/leaderboard-podium.json (repository: https://github.com/trophyso/ui, MIT). Adopted the general avatar/badge/stepped-podium composition with an independently implemented TPS CSS module, actual teacher data and no added dependency. Burgundy first-place block, neutral second/third blocks, thin portrait frames and centered award heading replace the previous flat photo grid. Verified desktop 1280x720 and mobile 390x844 visually.

## User annotation refinement

Use the official public/logo.svg asset instead of a text-built wordmark. Remove both navigation tabs, page arrows and the mascot panel from this modal (supersedes the earlier request to preserve its entry point here). Add restrained gold/silver/bronze finishes to portrait rings, rank medallions and podium blocks. A staggered slow sheen is disabled under prefers-reduced-motion. Checked the actual communication page at tablet and mobile sizes; ranking data, retry states and close/focus handling remain intact.

## Remove formulaic hero structure

User correction: do not use a kicker/title/description hero for the recognition modal. Removed the three-tier heading and generic footer slogan/CTA. Use a compact Exo section label with reporting month, with the teachers and their metallic podium as the main content. Keep the official logo, close button and accessible dialog name. Visually checked on the communication page.
