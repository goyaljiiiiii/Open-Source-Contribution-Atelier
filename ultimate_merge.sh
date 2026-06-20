#!/bin/bash
for pr in $(gh pr list --state open --limit 100 --json number --jq '.[].number'); do
  echo "Merging PR $pr"
  
  # Make sure we're on main and up to date
  git checkout main >/dev/null 2>&1
  git fetch origin main >/dev/null 2>&1
  git reset --hard origin/main >/dev/null 2>&1
  
  # Fetch the PR branch to a local branch named pr-NUMBER
  git fetch origin pull/$pr/head:pr-$pr >/dev/null 2>&1
  
  # Attempt to merge it
  if git merge pr-$pr -m "Merge PR $pr" >/dev/null 2>&1; then
      echo "Clean merge for PR $pr"
  else
      echo "Conflicts detected for PR $pr, resolving..."
      # Keep ours (PR's changes) for conflicts
      git merge --abort >/dev/null 2>&1
      git merge pr-$pr -X theirs -m "Merge PR $pr" >/dev/null 2>&1 || {
          # If still conflicting (e.g. modify/delete), just add all and commit
          git add .
          git commit -m "Force resolve PR $pr" >/dev/null 2>&1
      }
  fi
  
  # Push main back to remote
  git push origin main >/dev/null 2>&1
  
  # The PR will automatically be marked as merged by GitHub
  # Cleanup local branch
  git branch -D pr-$pr >/dev/null 2>&1
done
echo "All done!"
