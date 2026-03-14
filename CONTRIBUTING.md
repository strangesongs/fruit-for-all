# contributing to fruit for all

Thanks for your interest. This is a community project and all contributions are welcome.

## ways to contribute

- **Bug reports** — open a GitHub issue using the bug report template
- **Feature requests** — open an issue using the feature request template
- **Code** — fix a bug or build a feature, then open a pull request
- **Fruit data** — use the app and add trees in your area

## development setup

See [README.md](README.md) for full setup instructions.

## running the tests

```bash
npm test
```

Tests use Node's built-in test runner (no extra dependencies). They cover server-side validation utilities and client-side auth helpers. A pre-commit hook runs `npm test` automatically when you commit.

If you add new utility functions, please add corresponding tests in `tests/`.

## pull requests

1. Fork the repo and create a branch from `main`
2. Run `npm run dev` to work locally
3. Run `npm test` and make sure all tests pass
4. Test on desktop and on narrow mobile (360px width)
5. Open a PR with a clear description of what changed and why

All PRs must pass CI checks and receive a review from the repo owner before merging.

## code style

- Lowercase variable and function names (matches existing style)
- React class components (no need to convert to hooks)
- CSS changes should be checked at 480px and 360px breakpoints

## reporting bugs

Open an issue and include:
- What you expected vs what happened
- Steps to reproduce
- Device and browser (especially relevant for layout issues)

## questions

admin@fruitforall.app
