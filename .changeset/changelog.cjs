/**
 * Changelog formatter for the collective's house style.
 *
 * Each changeset file's markdown body IS the changelog entry, verbatim — the
 * curated voice we use everywhere ("Added **X**... Thanks to @y. Closes #z.").
 * The commit-hash and PR-link decoration the default formatter adds is dropped
 * deliberately, so CHANGELOG.md stays readable prose.
 */

async function getReleaseLine(changeset) {
  const summary = (changeset.summary || "").trim();
  if (!summary) return "";

  // Pass the author's markdown through faithfully. If they already wrote one
  // or more list items (the usual case for a consolidated entry), emit it as
  // written. Otherwise treat the whole summary as a single bullet.
  const isMarkdownList = /^\s*[-*]\s/.test(summary);
  return `\n${isMarkdownList ? summary : `- ${summary}`}`;
}

async function getDependencyReleaseLine() {
  // Internal dependency bumps are not user-facing.
  return "";
}

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
  default: { getReleaseLine, getDependencyReleaseLine },
};
