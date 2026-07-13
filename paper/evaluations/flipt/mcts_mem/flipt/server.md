- The server composes API handlers around storage, evaluation, auth, analytics, and telemetry services (`Server`).

- Transport-specific middleware is kept separate for HTTP and gRPC while preserving shared request behavior.

