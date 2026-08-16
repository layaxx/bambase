.PHONY: help format format-write format-check install-hooks remove-hooks lint lint-fix pre-commit

NVM_INIT = . ~/.nvm/nvm.sh && nvm use

# All targets operate on frontend/ — the only workspace in this repo.
help:
	@echo "Available targets:"
	@echo "  pre-commit     Run format-check and lint (used by the git pre-commit hook)"
	@echo "  format-check   Check formatting without writing changes"
	@echo "  format         Format all code"
	@echo "  lint           Lint"
	@echo "  lint-fix       Lint and auto-fix"
	@echo "  install-hooks  Install the git pre-commit hook"
	@echo "  remove-hooks   Remove the git pre-commit hook"

pre-commit: format-check lint

# Check formatting
format-check:
	cd frontend && $(NVM_INIT) && yarn format:check

# Format all code
format:
	cd frontend && $(NVM_INIT) && yarn format:write

# Lint
lint:
	cd frontend && $(NVM_INIT) && yarn lint

# Lint and auto-fix
lint-fix:
	cd frontend && $(NVM_INIT) && yarn lint:fix

# Install git hooks
install-hooks:
	@mkdir -p .git/hooks
	@echo '#!/bin/sh' > .git/hooks/pre-commit
	@echo 'make pre-commit' >> .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Git pre-commit hook installed"

# Remove git hooks
remove-hooks:
	@rm -f .git/hooks/pre-commit
	@echo "Git pre-commit hook removed"
