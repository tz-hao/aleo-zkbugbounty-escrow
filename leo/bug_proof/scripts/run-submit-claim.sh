#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
leo run submit_claim $(tr '\n' ' ' < inputs/valid.in)
