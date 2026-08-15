# ├─────────────────────────────────────────────────────┤
# │  Stage 1 — Base                                     │
# ├─────────────────────────────────────────────────────┤
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ├─────────────────────────────────────────────────────┤
# │  Stage 2 — Dependencies                             │
# ├─────────────────────────────────────────────────────┤
FROM base AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-prod.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ├─────────────────────────────────────────────────────┤
# │  Stage 3 — Development                              │
# ├─────────────────────────────────────────────────────┤
FROM base AS dev

COPY --from=deps /install /usr/local

COPY manage.py ./
COPY config/ ./config/
COPY apps/ ./apps/

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ├─────────────────────────────────────────────────────┤
# │  Stage 4 — Production                               │
# ├─────────────────────────────────────────────────────┤
FROM base AS production

RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

COPY --from=deps /install /usr/local

COPY --chown=appuser:appgroup manage.py ./
COPY --chown=appuser:appgroup config/ ./config/
COPY --chown=appuser:appgroup apps/ ./apps/

EXPOSE 8000
USER appuser

CMD ["sh", "-c", "python manage.py migrate && daphne -b 0.0.0.0 -p 8000 config.asgi:application"]
