#!/bin/bash
set -e

# Get all open PRs
prs=$(gh pr list --state open --json number -q '.[].number' | sort -n)

git checkout main
git pull origin main

for pr in $prs; do
  echo "Processing PR $pr..."
  
  # Checkout PR branch
  gh pr checkout $pr
  PR_BRANCH=$(git branch --show-current)
  
  # Back to main
  git checkout main
  
  # Attempt merge
  if git merge $PR_BRANCH --no-ff -m "Merge PR $pr"; then
    echo "Successfully merged PR $pr cleanly."
    git push origin main
  else
    echo "Conflicts detected for PR $pr! Auto-resolving..."
    
    # Handle package-lock.json conflicts safely by keeping main's and reinstalling
    if git diff --name-only --diff-filter=U | grep -q "package-lock.json"; then
      echo "Resolving package-lock.json..."
      git checkout --ours frontend/package-lock.json
      (cd frontend && npm install --legacy-peer-deps)
      git add frontend/package-lock.json
    fi
    
    # For all other conflicted files, accept the PR's changes (theirs)
    conflicted_files=$(git diff --name-only --diff-filter=U)
    for file in $conflicted_files; do
      if [ -f "$file" ]; then
        echo "Accepting PR changes for $file..."
        git checkout --theirs "$file"
        git add "$file"
      else
        echo "File $file was deleted, keeping deletion..."
        git rm "$file"
      fi
    done
    
    git commit -m "Merge PR $pr with auto-resolved conflicts"
    git push origin main
  fi
done
