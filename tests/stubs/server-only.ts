/**
 * Stub für das `server-only`-Paket in Vitest.
 * `server-only` wirft außerhalb einer React-Server-Umgebung eine Ausnahme;
 * in Node-Integrationstests wird der Server-Code direkt aufgerufen, daher
 * ersetzt dieser Stub das Paket. Die Schutzwirkung in der echten App bleibt
 * unverändert (dort wird das Original aufgelöst).
 */
export {};
