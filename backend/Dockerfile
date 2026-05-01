# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags "-s -w" -o /out/server ./cmd/server

RUN go install github.com/pressly/goose/v3/cmd/goose@latest && \
    cp /go/bin/goose /out/goose

FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata postgresql16-client && \
    addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /out/goose  /usr/local/bin/goose

COPY migrations ./migrations
COPY seeds      ./seeds

RUN mkdir -p /app/storage/images && \
    if [ -d /app/seeds/images ]; then cp -R /app/seeds/images/. /app/storage/images/; fi && \
    chown -R app:app /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app
EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/app/server"]
