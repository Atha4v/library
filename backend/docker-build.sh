#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-shelfmark-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"

FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
if [[ -n "${REGISTRY}" ]]; then
  FULL_IMAGE="${REGISTRY%/}/${FULL_IMAGE}"
fi

echo "Building backend image: ${FULL_IMAGE}"

docker build \
  -f "${SCRIPT_DIR}/Dockerfile" \
  -t "${FULL_IMAGE}" \
  "${REPO_ROOT}"

echo "Backend image built successfully: ${FULL_IMAGE}"
