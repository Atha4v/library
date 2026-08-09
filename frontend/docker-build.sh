#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-shelfmark-frontend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"
VITE_API_URL="${VITE_API_URL:-/api}"

FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
if [[ -n "${REGISTRY}" ]]; then
  FULL_IMAGE="${REGISTRY%/}/${FULL_IMAGE}"
fi

echo "Building frontend image: ${FULL_IMAGE}"
echo "VITE_API_URL=${VITE_API_URL}"

docker build \
  -f "${SCRIPT_DIR}/Dockerfile" \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  -t "${FULL_IMAGE}" \
  "${REPO_ROOT}"

echo "Frontend image built successfully: ${FULL_IMAGE}"
