/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace TS packages from source.
  transpilePackages: ["@spectra/contracts", "@spectra/design-tokens", "@spectra/sandbox"],
  env: {
    COMPILER_URL: process.env.COMPILER_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
