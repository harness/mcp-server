/**
 * Maps security-sensitive artifacts to automated guard tests.
 * If you change Dockerfile pins, postinstall wiring, or CVE overrides, update this map.
 */
export type SecurityRegressionGuardRow = {
  artifact: string;
  tests: string[];
};

export const SECURITY_REGRESSION_GUARDS: SecurityRegressionGuardRow[] = [
  {
    artifact: "Production Dockerfile (Debian/OpenSSL/adm-zip install order)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    artifact: "adm-zip postinstall patch library and symlink traversal guard",
    tests: ["tests/scripts/adm-zip-security-lib.test.ts"],
  },
  {
    artifact: "ip-address NAT64 / semver security floor",
    tests: ["tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    artifact: "Runtime CVE dependency overrides (body-parser, zod, fast-uri, ip-address)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
  },
  {
    artifact: "Express middleware stack (qs, proxy-addr, path-to-regexp, express-rate-limit)",
    tests: ["tests/scripts/express-stack-security-pins.test.ts"],
  },
  {
    artifact: "Remaining pnpm transitive security overrides (picomatch, nanoid, OTel core, etc.)",
    tests: ["tests/scripts/additional-pnpm-security-pins.test.ts"],
  },
  {
    artifact: "HTTP framework pins (hono, @hono/node-server, vite)",
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    artifact: "Transitive build/parser toolchain pins",
    tests: ["tests/scripts/transitive-security-pins.test.ts"],
  },
  {
    artifact: "Service account list flattening (account/org scope)",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
  {
    artifact: "npm consumer adm-zip wiring (postinstall, shrinkwrap, packaged files)",
    tests: ["tests/scripts/npm-adm-zip-consumer-wiring.test.ts"],
  },
];
