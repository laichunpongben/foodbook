#!/usr/bin/env bash
# new-dish.sh <slug> — scaffold src/content/dishes/<slug>/index.mdx
#
# Generic placeholder. Default visibility: public. Sample text is
# deliberately abstract — replace before committing. See ADR-0005.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <slug>" >&2
  exit 1
fi

slug=$1
dir="src/content/dishes/${slug}"

if [[ -e $dir ]]; then
  echo "$dir already exists" >&2
  exit 1
fi

mkdir -p "$dir"
cat >"${dir}/index.mdx" <<MDX
---
title: "TODO"
shortTitle: "TODO"
hero: "/photos/dishes/${slug}/hero"
tagline: "TODO — one-line editorial tagline."
origin: ""
tags: []
visibility: public

stages:
  source:
    note: ""
    farms: []
  cook:
    note: ""
    recipes: []
---

TODO — opening prose for this dish. Keep it generic; no real names or
addresses (see ADR-0005). Replace this stub before committing.
MDX

echo "Created ${dir}/index.mdx"
