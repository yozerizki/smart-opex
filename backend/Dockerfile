FROM node:20-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

ENV OCR_PYTHON=/usr/bin/python3

COPY . .

RUN npx prisma generate

CMD ["npm", "run", "start:dev"]
