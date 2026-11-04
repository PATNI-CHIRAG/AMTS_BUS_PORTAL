# Local PostgreSQL / PostGIS Setup with Docker Compose

This project provides a complete Docker Compose environment running **PostgreSQL 17** with the **PostGIS 3.5** spatial extension pre-installed and configured.

---

## 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Ensure port `5432` is not occupied by another native PostgreSQL service (or change the external port mapping in `docker-compose.yml` to `5433:5432`).

---

## 2. Starting the PostgreSQL/PostGIS Database

To spin up the PostGIS database container in the background:

```bash
docker compose up -d db
```

To verify that the PostGIS database container is healthy:

```bash
docker compose ps
```

To check PostGIS version inside the running container:

```bash
docker compose exec db psql -U postgres -d amts_portal_db -c "SELECT PostGIS_Full_Version();"
```

---

## 3. Running Django Migrations inside Docker

To apply all migrations against the empty PostGIS database:

```bash
docker compose run --rm backend python manage.py migrate
```

## 4. Importing schedule data for ten AMTS route numbers

`data/source/gtfs.zip` is a community static GTFS snapshot containing AMTS and other agencies. The importer filters to AMTS and defaults to ten route codes. Review the dry-run report first:

```bash
docker compose run --rm backend python manage.py import_gtfs --zip /data/source/gtfs.zip
```

If the route codes and counts look right, write the static schedule records:

```bash
docker compose run --rm backend python manage.py import_gtfs --zip /data/source/gtfs.zip --apply
```

Use `--all-amts` to import every AMTS route code in the feed. This imports routes, stops, calendars, scheduled trips, and stop times. It does not create physical fleet records, live GPS locations, fare policies, incidents, or crowding observations; those need separately verified sources. Confirm community data reuse rights before production use.

---

## 5. Starting the Entire Stack (PostGIS + Django Backend)

```bash
docker compose up -d
```

- **Django Backend:** `http://127.0.0.1:8000/api/v1/health/`
- **PostgreSQL / PostGIS:** `localhost:5432` (User: `postgres`, Password: `root`, DB: `amts_portal_db`)

To view backend logs:

```bash
docker compose logs -f backend
```

To stop all services:

```bash
docker compose down
```

To stop all services and wipe database volumes:

```bash
docker compose down -v
```
