#!/usr/bin/env bash
set -euo pipefail
cd /workspace/hey
npm ci --no-audit --no-fund --cache /tmp/zhaozhepai-npm-cache
npm run build
