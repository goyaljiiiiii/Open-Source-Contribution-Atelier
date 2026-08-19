FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860 \
    AUDIT_LOG_FILE=/tmp/audit.log

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup backend/manage.py ./
COPY --chown=appuser:appgroup backend/config/ ./config/
COPY --chown=appuser:appgroup backend/apps/ ./apps/
COPY --chown=appuser:appgroup backend/schemas/ ./schemas/
COPY --chown=appuser:appgroup backend/plugins/ ./plugins/
COPY --chown=appuser:appgroup backend/data/ ./data/

EXPOSE 7860

USER appuser

CMD ["sh", "-c", "python manage.py migrate && daphne -b 0.0.0.0 -p 7860 config.asgi:application"]
