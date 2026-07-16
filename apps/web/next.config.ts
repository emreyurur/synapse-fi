import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @synapsefi/shared ships raw TypeScript; let Next compile it.
  transpilePackages: ["@synapsefi/shared"],
};

export default nextConfig;
