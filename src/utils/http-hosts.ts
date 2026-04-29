const LOCALHOST_BIND_HOSTS = ["localhost", "127.0.0.1", "::1"];
const LOCALHOST_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const HOSTED_MCP_HOST = "mcp.harness.io";

interface HostEnv {
  HARNESS_MCP_ALLOWED_HOSTS?: string;
}

interface McpExpressHostOptions {
  host: string;
  allowedHosts?: string[];
}

export function normalizeHttpAllowedHost(rawHost: string): string | undefined {
  const trimmed = rawHost.trim();
  if (!trimmed) return undefined;

  try {
    const value = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function configuredAllowedHosts(env: HostEnv): string[] {
  const raw = env.HARNESS_MCP_ALLOWED_HOSTS;
  if (!raw) return [];

  const hosts: string[] = [];
  for (const value of raw.split(",")) {
    const hostname = normalizeHttpAllowedHost(value);
    if (hostname && !hosts.includes(hostname)) {
      hosts.push(hostname);
    }
  }

  return hosts;
}

export function resolveHttpHostValidationOptions(
  host: string,
  env: HostEnv,
): McpExpressHostOptions {
  const configuredHosts = configuredAllowedHosts(env);

  if (LOCALHOST_BIND_HOSTS.includes(host)) {
    return {
      host,
      allowedHosts: [...new Set([...LOCALHOST_ALLOWED_HOSTS, HOSTED_MCP_HOST, ...configuredHosts])],
    };
  }

  if (configuredHosts.length > 0) {
    return { host, allowedHosts: configuredHosts };
  }

  return { host };
}
