FROM node AS frontend

# set frontend build args
ARG ANALYTICS_FE_WRITE_KEY_PROD
ARG ANALYTICS_DATA_PLANE_URL
ARG SENTRY_DSN_FE

WORKDIR /build
RUN npm install -g pnpm && \
    pnpm -g config set store-dir /tmp/pnpm-store && \
    pnpm -g config set global-dir /tmp/pnpm-store/global 
COPY pnpm-lock.yaml ./
RUN pnpm fetch
COPY apps/ apps
COPY client/ client
COPY package.json pnpm-workspace.yaml playwright.config.js .
RUN pnpm install -r --offline && pnpm run build-web

FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /build
RUN apt-get update && apt-get -y install cmake python3 protobuf-compiler && apt-get -y clean && \
    curl -sLo sccache.tar.gz https://github.com/mozilla/sccache/releases/download/v0.3.3/sccache-v0.3.3-x86_64-unknown-linux-musl.tar.gz && \
    tar xzf sccache.tar.gz && \
    mv sccache-*/sccache /usr/bin/sccache

FROM chef AS planner
COPY . .
RUN cargo --locked chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json

# Build dependencies - this is the caching Docker layer!
ENV RUSTC_WRAPPER="/usr/bin/sccache"
RUN --mount=target=/root/.cache/sccache,type=cache --mount=target=/build/target,type=cache \
    cargo --locked chef cook -p bleep --release --recipe-path recipe.json

COPY server server
COPY apps/desktop/src-tauri apps/desktop/src-tauri
COPY Cargo.lock Cargo.toml .
RUN --mount=target=/root/.cache/sccache,type=cache --mount=target=/build/target,type=cache  \
    rm server/bleep/src/main.rs && \
    cargo --locked --frozen --offline build -p bleep --release && \
    cp /build/target/release/bleep / && \
    sccache --show-stats

FROM debian:stable-slim
VOLUME ["/repos", "/data"]
RUN apt-get update && apt-get -y install universal-ctags openssl ca-certificates && apt-get clean
COPY model /model
COPY --from=builder /bleep /
COPY --from=frontend /build/client/dist /frontend
ENTRYPOINT ["/bleep", "--host=0.0.0.0", "--source-dir=/repos", "--index-dir=/data", "--model-dir=/model"]
