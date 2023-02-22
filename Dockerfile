FROM node AS frontend

# set frontend build args
ARG ANALYTICS_FE_WRITE_KEY_PROD
ARG ANALYTICS_DATA_PLANE_URL
ARG SENTRY_DSN_FE

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY apps/ apps
COPY client/ client
COPY playwright.config.js .
RUN npm run build-web

FROM rust:slim-bookworm as builder
WORKDIR /build
RUN apt-get update && \
    apt-get -y install build-essential curl cmake python3 protobuf-compiler pkg-config libssl3 libssl-dev git && \
    apt-get -y clean && \
    curl -sLo sccache.tar.gz https://github.com/mozilla/sccache/releases/download/v0.3.3/sccache-v0.3.3-x86_64-unknown-linux-musl.tar.gz && \
    tar xzf sccache.tar.gz && \
    mv sccache-*/sccache /usr/bin/sccache
ENV RUSTC_WRAPPER="/usr/bin/sccache"
ENV PYTHON /usr/bin/python3
COPY server server
COPY apps/desktop/src-tauri apps/desktop/src-tauri
COPY Cargo.lock Cargo.toml .
RUN --mount=target=/root/.cache/sccache,type=cache --mount=target=/build/target,type=cache  \
    cargo --locked build -p bleep --release && \
    cp /build/target/release/bleep / && \
    sccache --show-stats

FROM debian:bookworm-slim
VOLUME ["/repos", "/data"]
RUN apt-get update && apt-get -y install universal-ctags openssl ca-certificates && apt-get clean
COPY model /model
COPY --from=builder /bleep /
COPY --from=frontend /build/client/dist /frontend
ENTRYPOINT ["/bleep", "--host=0.0.0.0", "--source-dir=/repos", "--index-dir=/data", "--model-dir=/model"]
