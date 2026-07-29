# Multi-stage build for Rust Quant Engine
FROM rust:1.80-alpine AS builder

RUN apk add --no-cache musl-dev g++ make

WORKDIR /usr/src/quant-engine
COPY Cargo.toml ./
COPY src ./src

RUN cargo build --release

# Minimal runtime image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates libgcc

WORKDIR /app
COPY --from=builder /usr/src/quant-engine/target/release/quant-engine /app/quant-engine

EXPOSE 8000

ENV RUST_LOG=info

CMD ["/app/quant-engine"]
