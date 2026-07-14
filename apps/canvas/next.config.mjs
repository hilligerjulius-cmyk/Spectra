/** @type {import('next').NextConfig} */

// Node-only deps used by the in-process Compiler Engine. They must never be
// bundled: esbuild ships a native binary + dynamic requires, and there's no
// value in webpack-ing @babel/parser or the Anthropic SDK into the server.
const SERVER_EXTERNALS = ["esbuild", "@babel/parser", "@anthropic-ai/sdk", "dotenv"];

const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace TS packages from source.
  transpilePackages: [
    "@spectra/contracts",
    "@spectra/design-tokens",
    "@spectra/sandbox",
    "@spectra/compiler",
  ],
  // Turbopack path (next dev --turbopack / future default).
  serverExternalPackages: SERVER_EXTERNALS,
  // Webpack path (default `next build`): force-externalize so the transpiled
  // compiler's `import ... from "esbuild"` stays a runtime require.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(({ request }, callback) => {
        if (request && SERVER_EXTERNALS.includes(request)) {
          return callback(null, "commonjs " + request);
        }
        callback();
      });
    }
    return config;
  },
};

export default nextConfig;
