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

COPY requirements.txt requirements-prod.txt ./
RUN pip wheel --no-cache-dir --wheel-dir=/wheels -r requirements.txt

# ├─────────────────────────────────────────────────────┤
# │  Stage 2 — Base Runtime (Minimal slim image)        │
# ├─────────────────────────────────────────────────────┤
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# ├─────────────────────────────────────────────────────┤
# │  Stage 3 — Development                              │
# ├─────────────────────────────────────────────────────┤
FROM base AS dev

COPY manage.py ./
COPY config/ ./config/
COPY apps/ ./apps/
COPY schemas/ ./schemas/
COPY plugins/ ./plugins/
COPY data/ ./data/

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ├─────────────────────────────────────────────────────┤
# │  Stage 4 — Production                               │
# ├─────────────────────────────────────────────────────┤
FROM base AS production

RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

COPY --chown=appuser:appgroup manage.py ./
COPY --chown=appuser:appgroup config/ ./config/
COPY --chown=appuser:appgroup apps/ ./apps/
COPY --chown=appuser:appgroup schemas/ ./schemas/
COPY --chown=appuser:appgroup plugins/ ./plugins/
COPY --chown=appuser:appgroup data/ ./data/

EXPOSE 8000
USER appuser

CMD ["sh", "-c", "python manage.py migrate && daphne -b 0.0.0.0 -p 8000 config.asgi:application"]
