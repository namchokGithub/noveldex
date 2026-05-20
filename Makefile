.PHONY: dev api web migrate-up migrate-down migrate-create db logs

dev:
	docker compose up -d
	$(MAKE) -j2 api web

api:
	cd apps/api && go run cmd/server/main.go

web:
	cd apps/web && pnpm dev

migrate-up:
	migrate -path apps/api/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path apps/api/migrations -database "$(DATABASE_URL)" down 1

migrate-create:
	migrate create -ext sql -dir apps/api/migrations -seq $(name)

db:
	docker compose exec postgres psql -U postgres -d noveldex

logs:
	docker compose logs -f
