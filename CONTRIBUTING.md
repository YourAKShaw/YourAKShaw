# Contributing to YourAKShaw

Thank you for helping. This project follows an issue-first workflow so that every change can be traced from the issue to its branch, commits and pull request.

## Workflow

1. **Open or pick an issue.** Search existing issues first, then use the matching [issue form](https://github.com/YourAKShaw/YourAKShaw/issues/new/choose). Every change needs an issue, except trivial edits such as typo fixes, which must say so in the pull request.
2. **Create a branch** from `main`, named `<github-login>/<type>/<issue-number>-<short-description>`, for example `octocat/feat/42-token-refresh`. `<type>` is one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci` or `chore`.
3. **Commit in small steps** using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), and reference the issue:

   ```text
   feat(auth): add token refresh (#42)

   Sessions expired mid-task. Refresh the access token shortly before
   it expires.

   Refs: #42
   ```

   Mark breaking changes with `!` after the type or scope and a `BREAKING CHANGE:` footer.
4. **Open a pull request** against `main` using the pull request template. Include `Closes #<issue>`, the commands you ran with their results, and anything you could not verify.
5. **Review and merge.** A maintainer reviews every pull request and is the only one who merges it.

## Development setup

```sh
# no install step detected
# no test command detected
```

## Changing scope mid-task

If the work changes while it is in progress, record it on the issue:

- A clarification of something already in the acceptance criteria: add a comment.
- New or changed acceptance criteria for the same goal: edit the issue and add a comment that quotes the change.
- A different goal that could ship or be reverted on its own: open a new issue and a new branch.

## Conduct and security

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
