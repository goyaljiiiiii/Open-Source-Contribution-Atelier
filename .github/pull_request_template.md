## Description
Please include a summary of the changes and the related issue. List any dependencies that are required for this change.

Fixes # (issue number)

## Type of Change
Please delete options that are not relevant.

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update (no code changes)
- [ ] ⚙️ CI/CD or build pipeline change
- [ ] ⚡ Performance optimization
- [ ] 🛠️ Refactoring (no functional changes)

## How Has This Been Tested?
Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce.

### Automated Tests
- Run backend tests: `cd backend && pytest`
- Run frontend tests: `cd frontend && npm run test`
- Alternatively, run the unified verification script: `./verify.sh`

### Manual Verification
- Describe any manual testing performed (e.g. user flow verification, edge case testing).
- Add screenshots / screen recordings for visual frontend changes.

## Pre-Push Checklist
Before pushing your branch, please confirm the following:

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or console errors
- [ ] I have run `git diff` locally and verified my changes
- [ ] I have run `./verify.sh` (or manually completed all 5 steps of the pre-push checklist in `AGENTS.md`) and everything passes
