/**
 * `server-only` wirft bei Import außerhalb einer React-Server-Umgebung.
 * CLI-Skripte (Migrationen, Seeds) führen Server-Code direkt in Node aus und
 * benötigen daher einen No-op. Die Schutzwirkung in der Next.js-Anwendung
 * bleibt unverändert — dort wird das Original aufgelöst.
 */
const Module = require("node:module");
const path = require("node:path");

const stubPath = path.join(__dirname, "server-only-stub.cjs");
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, ...args) {
  if (request === "server-only" || request === "client-only") {
    return stubPath;
  }
  return originalResolve.call(this, request, ...args);
};
