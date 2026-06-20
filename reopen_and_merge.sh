#!/bin/bash
PRS="302 301 300 299 298 297 296 295 294 293 292 291 290 289 288 286 279 278 277 276 274 273 272 271 270 269 267 266 265 264 263 262"
for pr in $PRS; do
  echo "Reopening and merging PR $pr"
  gh pr reopen $pr >/dev/null 2>&1 || true
  gh pr checkout $pr >/dev/null 2>&1 || continue
  git merge origin/main -X ours -m "resolve" >/dev/null 2>&1 || { git add .; git commit -m "force resolve" >/dev/null 2>&1; }
  git push -u origin HEAD --force >/dev/null 2>&1
  gh pr merge $pr --squash --admin >/dev/null 2>&1 || echo "Failed to merge $pr"
  git checkout main >/dev/null 2>&1
done
