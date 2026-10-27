# Sanka integration

Source: the user-supplied `参加型管理.zip`, Sanka Queue Manager 1.3.1.
The supplied package declares author `rumo-dev` and license `MIT`.

The renderer, card designer, overlay, sound synthesis and participation engine are retained here. CastPanel replaces the standalone application entry point, HTTP server and IPC host with `src/main/sanka.ts`. Original repository metadata, build automation and release configuration are not imported.

Integration changes include stable platform/user-ID keys, unified comment input and persistence, scoped IPC, authenticated OBS dock actions, OAuth state validation, protected asset imports, configurable shared themes, namespaced HTTP/WS routes, and connection lifecycle handling. Twitch login and points require user authorization and live-service verification.

Do not replace this directory with a fresh copy of the archive without preserving the integration changes and running the full Sanka tests and Electron smoke suite.
