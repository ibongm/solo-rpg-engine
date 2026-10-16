## Summary
<!-- Briefly explain what changes are introduced and the motivation behind them. -->

## Type of Change
- [ ] `Added`: New feature or capability
- [ ] `Changed`: Existing functionality or structural reorganization
- [ ] `Deprecated`: Soon-to-be removed capability
- [ ] `Removed`: Feature removal
- [ ] `Fixed`: Bug fix
- [ ] `Security`: Security vulnerability remediation

## Architectural Compliance
- [ ] Frontend deterministic rules lawyer respected (no LLM-driven dice rolls or numeric mechanics in `src/engine/*`)
- [ ] Backend Vertex AI interactions adhere to structured schemas in `api/_lib/schemas.js`
- [ ] Prohibited mechanics avoided (no secret DM rolls, no timeline rewinds/branching, no manual companion adds, no ambient audio)
- [ ] Full copy-pasteable files maintained (no truncated code or stubs)
- [ ] `CHANGELOG.md` updated with descriptive entry

## Testing & Verification
- [ ] Unit tests pass: `npm run test`
- [ ] Production build succeeds: `npm run build`
