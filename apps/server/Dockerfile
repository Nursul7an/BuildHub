# Сборка сервера. Контекст сборки — корень репозитория, а не apps/server:
# рабочие пространства npm ставятся одним деревом, и package-lock.json
# лежит в корне. Собирать из каталога пакета пришлось бы копированием
# зависимостей вручную, и версии разъехались бы с локальными.
#
#   docker build -f apps/server/Dockerfile -t build-hub-server .

# --- Этап сборки -------------------------------------------------------
FROM node:20-slim AS build

# Prisma требует OpenSSL для генерации клиента под платформу.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Сначала манифесты — слой с установкой зависимостей переиспользуется,
# пока они не менялись.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

# Ставим только серверные рабочие пространства: инструменты сборки веба
# (vite, плагин React, сам React) в образ сервера не нужны, а lock-файл
# один на всё дерево и без ограничения притащил бы их целиком.
#
# --include=dev указан явно: при NODE_ENV=production npm молча пропускает
# отладочные зависимости, а сборка стоит на них — tsc и tsx. Собирающая
# среда это значение выставляет сама, и полагаться на то, что здесь она
# его не выставит, не стоит.
RUN npm ci --include=dev \
    --workspace=@build-hub/server \
    --workspace=@build-hub/shared \
    --include-workspace-root

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build --workspace=@build-hub/shared \
    && npx --workspace=@build-hub/server prisma generate \
    && npm run build --workspace=@build-hub/server

# Отладочные зависимости в готовый образ не едут.
RUN npm prune --omit=dev

# Клиент Prisma генерируется ПОСЛЕ уборки. Сгенерированный код лежит в
# node_modules/.prisma и ни в одном package.json не числится, поэтому
# npm prune считает его лишним и сносит. Собранный образ падал бы при
# первом же обращении к базе — с жалобой, что клиент не сгенерирован.
RUN npx --workspace=@build-hub/server prisma generate

# --- Готовый образ -----------------------------------------------------
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/apps/server/prisma apps/server/prisma

# Каталог загрузок. Без подключённого тома он временный, и фотографии
# пропадут при перезапуске — том задаётся в настройках хостинга.
RUN mkdir -p /app/var/uploads && chown -R node:node /app/var
ENV FILE_STORAGE_DIR=/app/var/uploads

# Не от root: обычная предосторожность, а не формальность.
USER node

EXPOSE 4000
ENV PORT=4000

# Схема накатывается перед стартом: миграции версионированы, повторный
# запуск ничего не делает.
#
# prisma здесь — обычная зависимость, а не отладочная: без неё команда
# после уборки исчезла бы из образа, и контейнер уходил бы за ней в сеть
# при каждом запуске.
CMD ["sh", "-c", "npx --workspace=@build-hub/server prisma migrate deploy && node apps/server/dist/index.js"]
