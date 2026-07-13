FROM node:20-alpine AS frontend-build
WORKDIR /app/Frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app/Backend
RUN apk add --no-cache openssl
COPY Backend/package.json Backend/package-lock.json ./
RUN npm ci
COPY Backend/ ./
RUN npx prisma generate

COPY --from=frontend-build /app/Frontend/dist /app/Frontend/dist

RUN mkdir -p uploads/kyc uploads/locations uploads/branding

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
