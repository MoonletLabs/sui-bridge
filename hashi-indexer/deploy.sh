#!/usr/bin/env bash
# Deploy a released version of the Hashi indexer on THIS host.
#
#   ./deploy.sh hashi-indexer-v2.0
#
# Run it from the checkout's hashi-indexer/ folder, with a .env next to it. It never uses a branch:
# it fetches the tags, checks the requested release tag out (detached), builds the image from that
# exact commit and (re)starts the stack. Doing the same thing with an older tag is the rollback.
set -euo pipefail
cd "$(dirname "$0")"

TAG="${1:-}"
if [[ ! "$TAG" =~ ^hashi-indexer-v[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.]+)?$ ]]; then
    echo "usage: ./deploy.sh hashi-indexer-vMAJOR.MINOR   (a release tag, never a branch)" >&2
    exit 1
fi
[[ -f .env ]] || { echo ".env is missing: copy .env.example and fill it in" >&2; exit 1; }
# Tracked changes AND untracked files both count: an untracked file such as a stray migration would
# survive the tag checkout, be copied into the image and run on start. (.env and node_modules are
# git-ignored, so they do not count.)
if [[ -n "$(git status --porcelain)" ]]; then
    echo "the checkout has local changes or untracked files: refusing to deploy from it" >&2
    git status --short >&2
    exit 1
fi

git fetch --tags --quiet origin
git rev-parse -q --verify "refs/tags/$TAG^{commit}" >/dev/null || { echo "unknown tag: $TAG" >&2; exit 1; }
git checkout --detach --quiet "refs/tags/$TAG"

export HASHI_INDEXER_VERSION="${TAG#hashi-indexer-v}"
echo "Deploying $TAG ($(git rev-parse --short HEAD)) as version $HASHI_INDEXER_VERSION"

docker compose --env-file .env up -d --build
docker compose --env-file .env ps
