I want to prototype a new game mechanic for the Marble Sorter game.

Mechanic idea: $ARGUMENTS

Follow the "Prototyping New Mechanics" workflow in CLAUDE.md:

1. Create a new branch from main: `mechanic/<short-name-from-my-description>`
2. Classify this as Tier 1 (registry box type) or Tier 2 (core mechanic) — explain your reasoning
3. For Tier 1: use `js/box_template.js.example` as your starting skeleton
4. For Tier 2: list ALL files you'll need to modify before writing any code, and study `js/rocket.js` integration points
5. Implement the mechanic following existing code patterns
6. Add the `<script>` tag in `index.html` in the correct position (after box_pack.js/before calibration.js for Tier 1, after physics.js/before rendering.js for Tier 2)
7. Create a test level JSON that demonstrates the mechanic — make it simple and focused
8. Commit all changes with a descriptive message
9. Push the branch and open a PR with:
   - Description of what the mechanic does and how it works
   - The test level JSON to paste into "Import Level"
   - Manual testing instructions
   - Preview URL: `https://quintusonus.github.io/MarblePerso/preview/<mechanic-name>/`

After opening the PR, tell me:
- The PR URL
- The preview URL (will be live ~1 minute after push)
- How to test: open the preview URL, click "Import Level", paste the test level JSON

If anything about my mechanic description is ambiguous, ask me BEFORE you start coding.
