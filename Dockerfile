# Stage 1: Build Go server
FROM golang:1.26-alpine AS server-build
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -o /server .

# Stage 2: Build client
FROM node:22-alpine AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 3: Production
FROM alpine:3.21
WORKDIR /app
COPY --from=server-build /server .
COPY --from=client-build /build/client/dist ./client/dist

ENV PORT=3001
EXPOSE 3001
CMD ["./server"]
