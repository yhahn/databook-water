#!/bin/sh
# Writes every page of databook-water from the source as fetched (its
# shape checked first, V1), then the README; plays every vector (V2) and the
# live source's cases; then checks what proper gathers (V3, target.sql).
# Fetch first, if the source is to be read again: node .import/fetch.js
# (--again for a new release). The gather wants about 6G:
#   ~/Projects/crew.md/bin/crew run 6G -- sh .import/build.sh
set -e
cd "$(dirname "$0")/.."
node --max-old-space-size=4096 .import/water/import.js
node .import/water/readme.js
node --test .import/water/import.test.js
node ~/Projects/proper-sources/bin/proper-sources.js check .source
proper check
node .import/target.js
