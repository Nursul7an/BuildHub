#!/usr/bin/env bash
#
# Резервная копия базы и файлов.
#
# Это НЕ восстановление на момент времени, которого требует ТЗ §3.1.
# Это снимок раз в сутки: потерять можно всё, что сделано с последнего
# снимка — то есть до одного рабочего дня отчётов. Для настоящего PITR
# нужен archive_mode с непрерывной отгрузкой WAL на отдельное хранилище;
# см. примечание в конце файла.
#
# Установка в расписание (каждый день в 03:30):
#   crontab -e
#   30 3 * * * /path/to/deploy/backup.sh >> /var/log/build-hub-backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")"

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
DIR="./backups"
mkdir -p "$DIR"

echo "[$(date -Is)] снимок базы"
# pg_dump внутри контейнера: снаружи порт базы не открыт, и открывать
# его ради бэкапа — значит выставить базу в интернет.
docker compose exec -T postgres \
	pg_dump -U "${POSTGRES_USER:-buildhub}" -d "${POSTGRES_DB:-buildhub}" --format=custom \
	> "$DIR/db-$STAMP.dump"

echo "[$(date -Is)] снимок фотографий"
# Фотографии отчётов — доказательная база по скрытым работам, и в дампе
# базы их нет: там только ссылки.
docker compose run --rm --no-deps -v "$PWD/$DIR:/backups" \
	--entrypoint sh server \
	-c "tar -czf /backups/uploads-$STAMP.tar.gz -C /app/var/uploads ." \
	>/dev/null

echo "[$(date -Is)] уборка старше $KEEP_DAYS дней"
find "$DIR" -name 'db-*.dump' -mtime "+$KEEP_DAYS" -delete
find "$DIR" -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "[$(date -Is)] готово:"
ls -lh "$DIR" | tail -4

# Восстановление:
#   docker compose exec -T postgres \
#     pg_restore -U buildhub -d buildhub --clean --if-exists < backups/db-ГГГГ-ММ-ДД_ЧЧММ.dump
#   tar -xzf backups/uploads-ГГГГ-ММ-ДД_ЧЧММ.tar.gz -C /var/lib/docker/volumes/build-hub_uploads/_data
#
# Копии лежат на том же сервере, что и база. Пожар в дата-центре уносит
# и то и другое — отвозите их наружу (rsync на другой хост, s3cmd,
# Hetzner Storage Box).
