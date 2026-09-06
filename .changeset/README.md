# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one
markdown file per user-facing change, describing what changed and how the
version should bump.

Add one with:

```bash
pnpm changeset
```

Pick a bump (patch / minor / major) and write the entry in the house voice —
the file body becomes the changelog entry verbatim. Commit the generated file
alongside your change.

Chores, refactors, CI and docs need no changeset. To record that deliberately,
use `pnpm changeset --empty`.

Changesets accumulate on `main` until the **Version Packages** pull request is
merged, which bumps the version and rolls the entries into `CHANGELOG.md`.
Merging that pull request is what triggers a release.
