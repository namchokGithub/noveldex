# Search Index Benchmark Report

Run: 2026-09-11, deterministic synthetic data, seed `20260911`. Node heap is an approximation; browser heap is unavailable without a DevTools profile. Synthetic fixtures have no Firestore source dataset, so that field is `N/A`.

| Documents | Search dataset | Build | Exact p50 / p95 | Fuzzy p50 / p95 | 1k mutations | Node heap delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5,000 | 3.22 MiB | 519.7 ms | 3.39 / 6.19 ms | 3.39 / 4.71 ms | 53.84 ms | 40.9 MiB |
| 10,000 | 6.49 MiB | 929.0 ms | 7.24 / 9.94 ms | 6.82 / 7.78 ms | 52.34 ms | 88.6 MiB |
| 25,000 | 16.19 MiB | 2.25 s | 25.46 / 41.23 ms | 22.93 / 26.58 ms | 61.16 ms | 150.8 MiB |
| 50,000 | 32.52 MiB | 4.69 s | 55.35 / 67.64 ms | 52.84 / 57.42 ms | 79.74 ms | 90.3 MiB |

Search p95 remains below the 100 ms engine budget through 50,000 documents. Build time exceeds the 1 s checkpoint at 25,000 documents and memory exceeds the 50 MiB review threshold from the first checkpoint. The provider now builds the browser index in 500-document asynchronous chunks; profile field duplication before introducing IndexedDB or a Worker. A real baseline remains opt-in and may only use an authorized non-production source.
