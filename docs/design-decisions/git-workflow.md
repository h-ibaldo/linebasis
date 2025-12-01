# Decision
Adopt a strict Feature Branch workflow combined with Conventional Commits.

# Motivation
To ensure a clean, readable git history that "tells a story," facilitate automated release note generation, and prevent low-quality commits from entering the main branch.

# Implications
- **Branching**: Must use `feat/`, `fix/`, etc. prefixes. Short-lived branches.
- **Commits**: Must follow `type(scope): description` format.
- **Enforcement**: Git hooks (pre-commit, commit-msg, pre-push) are required to enforce these rules.

# Alternatives considered
- **Gitflow**: Considered too complex for this project size.
- **Trunk-based**: Rejected to ensure higher quality control via PRs for all changes.
