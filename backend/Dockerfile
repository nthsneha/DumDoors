# Development stage
FROM golang:1.21-alpine AS development

# Install development tools
RUN apk update && apk add --no-cache git ca-certificates tzdata curl wget netcat-openbsd && update-ca-certificates

# Install air for hot reloading (compatible version for Go 1.21)
RUN go install github.com/cosmtrek/air@v1.49.0

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 8080

# Default command for development
CMD ["air", "-c", ".air.toml"]

# Builder stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk update && apk add --no-cache git ca-certificates tzdata && update-ca-certificates

# Create appuser
RUN adduser -D -g '' appuser

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download
RUN go mod verify

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -s -extldflags "-static"' -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest AS production

# Install runtime dependencies
RUN apk --no-cache add ca-certificates wget

# Create appuser
RUN adduser -D -g '' appuser

WORKDIR /root/

# Import from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/passwd /etc/passwd

# Copy our static executable
COPY --from=builder /build/main .

# Copy wait-for-it script
COPY --from=builder /build/wait-for-it.sh .
RUN chmod +x wait-for-it.sh

# Create logs directory
RUN mkdir -p logs && chown appuser:appuser logs

# Use an unprivileged user
USER appuser

# Expose port
EXPOSE 8080

# Run the binary
ENTRYPOINT ["./main"]