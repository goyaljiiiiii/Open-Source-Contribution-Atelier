# ├─────────────────────────────────────────────────────┤
# │  Stage 1 — Builder (Compile wheel packages)         │
# ├─────────────────────────────────────────────────────┤
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r requirements.txt

# ├─────────────────────────────────────────────────────┤
# │  Stage 2 — Production Runtime (< 350 MB)              │
# ├─────────────────────────────────────────────────────┤
FROM python:3.11-slim AS runner

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860 \
    AUDIT_LOG_FILE=/tmp/audit.log \
    CURRICULUM_JSON_PATH=/app/frontend/public/content/curriculum.json

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

COPY --chown=appuser:appgroup backend/manage.py ./
COPY --chown=appuser:appgroup backend/config/ ./config/
COPY --chown=appuser:appgroup backend/apps/ ./apps/
COPY --chown=appuser:appgroup backend/schemas/ ./schemas/
COPY --chown=appuser:appgroup backend/plugins/ ./plugins/
COPY --chown=appuser:appgroup backend/data/ ./data/
COPY --chown=appuser:appgroup frontend/public/content/ ./frontend/public/content/

EXPOSE 7860

USER appuser

CMD ["sh", "-c", "python manage.py migrate && daphne -b 0.0.0.0 -p 7860 config.asgi:application"]
