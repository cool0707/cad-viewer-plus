#!/usr/bin/env bash
# Updates the `gh-pages` branch used by GitHub Pages (see .github/workflows/demo.yml).
#
#   tools/publish-pages.sh main <dir>             # <dir> → site root, keeps preview/
#   tools/publish-pages.sh preview <slug> <dir>   # <dir> → preview/<slug>/
#   tools/publish-pages.sh remove <slug>          # deletes preview/<slug>/
#
# Run inside a checkout whose `origin` can be pushed to (actions/checkout with
# `contents: write`). Concurrent runs for other branches may push in between,
# so the whole update is retried on a rejected push.
set -euo pipefail

mode="${1:?mode: main | preview | remove}"
case "$mode" in
  main)
    slug=""
    src="${2:?source directory}"
    ;;
  preview)
    slug="${2:?preview slug}"
    src="${3:?source directory}"
    ;;
  remove)
    slug="${2:?preview slug}"
    src=""
    ;;
  *)
    echo "unknown mode: $mode" >&2
    exit 2
    ;;
esac
if [[ -n "$slug" && ! "$slug" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "invalid preview slug: $slug" >&2
  exit 2
fi
if [[ -n "$src" ]]; then
  src="$(cd "$src" && pwd)"
fi

pages="${RUNNER_TEMP:-/tmp}/gh-pages-worktree"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

publish_once() {
  git worktree remove --force "$pages" 2>/dev/null || rm -rf "$pages"
  if git fetch --depth=1 origin gh-pages 2>/dev/null; then
    git worktree add --detach "$pages" FETCH_HEAD
  else
    git worktree add --detach "$pages"
    git -C "$pages" checkout --orphan gh-pages-new
    git -C "$pages" rm -rfq --ignore-unmatch .
  fi

  case "$mode" in
    main)
      # Replace everything except the previews of other branches.
      find "$pages" -mindepth 1 -maxdepth 1 ! -name .git ! -name preview \
        -exec rm -rf {} +
      cp -a "$src/." "$pages/"
      ;;
    preview)
      rm -rf "$pages/preview/$slug"
      mkdir -p "$pages/preview/$slug"
      cp -a "$src/." "$pages/preview/$slug/"
      ;;
    remove)
      rm -rf "$pages/preview/$slug"
      ;;
  esac
  # GitHub Pages: serve files/folders starting with "_" as-is.
  touch "$pages/.nojekyll"

  git -C "$pages" add -A
  if git -C "$pages" diff --cached --quiet; then
    echo "gh-pages is already up to date"
    return 0
  fi
  git -C "$pages" commit -qm "deploy: $mode ${slug:-root} (${GITHUB_SHA:-local})"
  git -C "$pages" push origin HEAD:refs/heads/gh-pages
}

for attempt in 1 2 3 4 5; do
  # A subshell outside any `if`, so `set -e` still aborts on the first error.
  set +e
  (
    set -e
    publish_once
  )
  status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    git worktree remove --force "$pages" 2>/dev/null || true
    exit 0
  fi
  echo "update failed (attempt $attempt), retrying..." >&2
  sleep $((attempt * 5))
done
echo "failed to update gh-pages" >&2
exit 1
