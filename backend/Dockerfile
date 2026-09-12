FROM node:22-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npx prisma generate

EXPOSE 4000

# Push the schema (no migration history needed for this demo), seed sample
# data, then start the API + WebSocket + overdue scheduler.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run seed && npm start"]