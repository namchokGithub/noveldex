.PHONY: dev web stop db db-backup db-restore db-backups logs firebase-emulators

BACKUP_DIR ?= backups/postgres
BACKUP_KEEP ?= 3
BACKUP_FILE ?=

dev:
	docker compose up -d
	$(MAKE) web

web:
	cd web && corepack pnpm dev

stop:
	powershell.exe -NoProfile -Command "$$ports = 3000,8081; $$processIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $$ports -contains $$_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique; if ($$processIds) { Stop-Process -Id $$processIds -Force; Write-Host ('Stopped processes: ' + ($$processIds -join ', ')) } else { Write-Host 'No web or Firestore emulator processes are listening.' }"

db:
	docker compose exec postgres psql -U postgres -d noveldex

db-backup:
	@set -eu; \
	mkdir -p "$(BACKUP_DIR)"; \
	file="$(BACKUP_DIR)/noveldex-$$(date +%Y%m%d-%H%M%S).sql"; \
	docker compose exec -T postgres pg_dump -U postgres -d noveldex --clean --if-exists --no-owner --no-privileges > "$$file"; \
	files="$$(ls -1t "$(BACKUP_DIR)"/noveldex-*.sql 2>/dev/null || true)"; \
	if [ -n "$$files" ]; then \
		old_files="$$(printf '%s\n' "$$files" | tail -n +$$(( $(BACKUP_KEEP) + 1 )))"; \
		if [ -n "$$old_files" ]; then \
			printf '%s\n' "$$old_files" | while IFS= read -r old_file; do rm -f "$$old_file"; done; \
		fi; \
	fi; \
	echo "Backup saved to $$file"

db-restore:
	@set -eu; \
	file="$(BACKUP_FILE)"; \
	if [ -z "$$file" ]; then \
		file="$$(ls -1t "$(BACKUP_DIR)"/noveldex-*.sql 2>/dev/null | head -n 1)"; \
	fi; \
	if [ -z "$$file" ] || [ ! -f "$$file" ]; then \
		echo "Backup file not found. Set BACKUP_FILE=path/to/file.sql or run make db-backup first."; \
		exit 1; \
	fi; \
	docker compose exec -T postgres psql -U postgres -d noveldex < "$$file"; \
	echo "Database restored from $$file"

db-backups:
	@mkdir -p "$(BACKUP_DIR)"
	@ls -1t "$(BACKUP_DIR)"/noveldex-*.sql 2>/dev/null || echo "No backups found in $(BACKUP_DIR)"

logs:
	docker compose logs -f

firebase-emulators:
	cd web && pnpm run emulators
