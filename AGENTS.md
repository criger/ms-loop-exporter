# Agent instructions

This is the public source repository for **Loop Board Exporter**.

- Read `README.md` and the actual files on the current branch before modifications.
- Preserve strict separation between Loop DOM extraction (`src/extractor.js`), date parsing (`src/dates.js`), export rendering (`src/formats.js`), UI (`src/panel.js`, `src/report.js`), and browser storage (`src/background.js`).
- Avoid new packages, remote calls, broad browser permissions or publishing internal Loop content.
- Do not embed real user export files, employee details, company URLs, access tokens or report content in this public repository. Use synthetic fixtures in tests.
- Keep English and Norwegian UI strings in sync.
- Test date normalization (including Today/Yesterday/Tomorrow), CSV formula injection and Excel's cell limit whenever output code changes.
- Node syntax checks and tests: `node --test tests/*.test.cjs` and `node --check src/*.js`.
- Confirm behavior in Microsoft Loop before calling a version runtime-verified.
- The private project history and engineering rules are maintained separately in `criger/projects-ai-commands/projects/ms-loop-exporter/`. Only developers authorized for that private repository should read them. Do not copy private content into public source.
- Never commit directly to `main` without explicit permission from the repository owner. Use a feature branch / reviewable pull request.
