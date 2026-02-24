FROM node:20-bookworm

WORKDIR /app

# Full OCR installation reference (commented, optional)
# ENV PIP_DEFAULT_TIMEOUT=300 \
#   PIP_RETRIES=15 \
#   PIP_DISABLE_PIP_VERSION_CHECK=1
#
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends \
#     python3 \
#     python3-venv \
#     python3-pip \
#     libgl1 \
#     poppler-utils \
#   && rm -rf /var/lib/apt/lists/*
#
# COPY scripts/ocr/requirements.txt ./scripts/ocr/requirements.txt
# RUN python3 -m venv /opt/venv \
#   && /opt/venv/bin/pip install --no-cache-dir --timeout 300 --retries 15 -r scripts/ocr/requirements.txt \
#   && /opt/venv/bin/pip install --no-cache-dir --timeout 300 --retries 15 setuptools

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

CMD ["npm", "run", "start:dev"]
