FROM rust AS builder
WORKDIR /build
COPY . ./
RUN apt-get update && apt-get -y install cmake python3 protobuf-compiler
RUN cargo build --release -p bleep

FROM debian
RUN apt-get update && apt-get -y install universal-ctags openssl ca-certificates && apt-get clean
COPY model /model
COPY --from=builder /build/target/release/bleep /
ENTRYPOINT ["/bleep", "--host=0.0.0.0", "--index-dir=/data", "--model-dir=/model"]
