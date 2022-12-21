use std::{
    fs::{create_dir_all, write},
    path::Path,
    process::Command,
    time::Duration,
};

use super::relative_command_path;

pub(super) const QDRANT_CONFIG: &str = r#"
storage:
  # Where to store all the data
  storage_path: {{ STORAGE }}

  # Where to store snapshots
  snapshots_path: {{ SNAPSHOTS }}

  # If true - point's payload will not be stored in memory.
  # It will be read from the disk every time it is requested.
  # This setting saves RAM by (slightly) increasing the response time.
  # Note: those payload values that are involved in filtering and are indexed - remain in RAM.
  on_disk_payload: false

  # Write-ahead-log related configuration
  wal:
    # Size of a single WAL segment
    wal_capacity_mb: 32

    # Number of WAL segments to create ahead of actual data requirement
    wal_segments_ahead: 0


  performance:
    # Number of parallel threads used for search operations. If 0 - auto selection.
    max_search_threads: 0

  optimizers:
    # The minimal fraction of deleted vectors in a segment, required to perform segment optimization
    deleted_threshold: 0.2

    # The minimal number of vectors in a segment, required to perform segment optimization
    vacuum_min_vector_number: 1000

    # Target amount of segments optimizer will try to keep.
    # Real amount of segments may vary depending on multiple parameters:
    #  - Amount of stored points
    #  - Current write RPS
    #
    # It is recommended to select default number of segments as a factor of the number of search threads,
    # so that each segment would be handled evenly by one of the threads.
    # If `default_segment_number = 0`, will be automatically selected by the number of available CPUs
    default_segment_number: 0

    # Do not create segments larger this size (in KiloBytes).
    # Large segments might require disproportionately long indexation times,
    # therefore it makes sense to limit the size of segments.
    #
    # If indexation speed have more priority for your - make this parameter lower.
    # If search speed is more important - make this parameter higher.
    # Note: 1Kb = 1 vector of size 256
    # If not set, will be automatically selected considering the number of available CPUs.
    max_segment_size_kb: null

    # Maximum size (in KiloBytes) of vectors to store in-memory per segment.
    # Segments larger than this threshold will be stored as read-only memmaped file.
    # To enable memmap storage, lower the threshold
    # Note: 1Kb = 1 vector of size 256
    # If not set, mmap will not be used.
    memmap_threshold_kb: null

    # Maximum size (in KiloBytes) of vectors allowed for plain index.
    # Default value based on https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md
    # Note: 1Kb = 1 vector of size 256
    indexing_threshold_kb: 20000

    # Interval between forced flushes.
    flush_interval_sec: 5
    
    # Max number of threads, which can be used for optimization.
    max_optimization_threads: 1

  # Default parameters of HNSW Index. Could be overridden for each collection individually
  hnsw_index:
    # Number of edges per node in the index graph. Larger the value - more accurate the search, more space required.
    m: 16
    # Number of neighbours to consider during the index building. Larger the value - more accurate the search, more time required to build index.
    ef_construct: 100
    # Minimal size (in KiloBytes) of vectors for additional payload-based indexing.
    # If payload chunk is smaller than `full_scan_threshold_kb` additional indexing won't be used -
    # in this case full-scan search should be preferred by query planner and additional indexing is not required.
    # Note: 1Kb = 1 vector of size 256
    full_scan_threshold_kb: 10000
    # Number of parallel threads used for background index building. If 0 - auto selection.
    max_indexing_threads: 0

service:

  # Maximum size of POST data in a single request in megabytes
  max_request_size_mb: 32

  # Number of parallel workers used for serving the api. If 0 - equal to the number of available cores.
  # If missing - Same as storage.max_search_threads
  max_workers: 0

  # Host to bind the service on
  host: 127.0.0.1

  # HTTP port to bind the service on
  http_port: 6333

  # gRPC port to bind the service on.
  # If `null` - gRPC is disabled. Default: null
  grpc_port: 6334
  # Uncomment to enable gRPC:
  # grpc_port: 6334

  # Enable CORS headers in REST API.
  # If enabled, browsers would be allowed to query REST endpoints regardless of query origin.
  # More info: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  # Default: true
  enable_cors: true

cluster:
  # Use `enabled: true` to run Qdrant in distributed deployment mode
  enabled: false

  # Configuration of the inter-cluster communication
  p2p:
    # Port for internal communication between peers
    port: 6335

  # Configuration related to distributed consensus algorithm
  consensus:
    # How frequently peers should ping each other.
    # Setting this parameter to lower value will allow consensus
    # to detect disconnected nodes earlier, but too frequent
    # tick period may create significant network and CPU overhead.
    # We encourage you NOT to change this parameter unless you know what you are doing.
    tick_period_ms: 100
"#;

pub async fn start(cache_dir: impl AsRef<Path>) {
    let cache_dir = cache_dir.as_ref();
    let qdrant_dir = cache_dir.join("qdrant");
    let qd_config_dir = qdrant_dir.join("config");
    create_dir_all(&qd_config_dir).unwrap();
    write(
        qd_config_dir.join("config.yaml"),
        &QDRANT_CONFIG
            .replace(
                "{{ STORAGE }}",
                &qdrant_dir.join("storage").to_string_lossy(),
            )
            .replace(
                "{{ SNAPSHOTS }}",
                &qdrant_dir.join("snapshots").to_string_lossy(),
            ),
    )
    .unwrap();

    let command = relative_command_path("qdrant").expect("bad bundle");
    _ = Command::new(command)
        .current_dir(qdrant_dir)
        .spawn()
        .expect("failed to start qdrant");

    use qdrant_client::prelude::*;
    let qdrant = QdrantClient::new(Some(QdrantClientConfig::from_url("http://127.0.0.1:6334")))
        .await
        .unwrap();

    for _ in 0..60 {
        if qdrant.health_check().await.is_ok() {
            return;
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    panic!("qdrant cannot be started");
}
