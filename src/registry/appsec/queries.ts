/**
 * Constants, attribute catalogs, and GraphQL query templates for the AppSec (Traceable) toolset.
 */

export const GRAPHQL_PATH = "/graphql";

export const ONE_HOUR_MS = 3_600_000;
export const ONE_DAY_MS = 86_400_000;
export const ONE_WEEK_MS = 7 * ONE_DAY_MS;

export const TIME_FILTER_MS: Record<string, number> = {
  LAST_1_HOUR: ONE_HOUR_MS,
  LAST_6_HOURS: 6 * ONE_HOUR_MS,
  LAST_24_HOURS: ONE_DAY_MS,
  LAST_48_HOURS: 2 * ONE_DAY_MS,
  LAST_7_DAYS: ONE_WEEK_MS,
  LAST_14_DAYS: 14 * ONE_DAY_MS,
  LAST_30_DAYS: 30 * ONE_DAY_MS,
  LAST_90_DAYS: 90 * ONE_DAY_MS,
};

export const VALID_TIME_FILTERS = Object.keys(TIME_FILTER_MS);

export const ENTITY_SCOPES = [
  "SERVICE",
  "BACKEND",
  "BACKEND_API",
  "DOMAIN",
  "ACTOR",
  "APPLICATION_ASSET",
  "APPLICATION_GROUP",
  "MCP_SERVER",
  "MCP_TOOL",
  "MCP_PROMPT",
  "MCP_RESOURCE",
] as const;

export const MCP_AI_ASSET_TYPES = new Set(["MCP_TOOL", "MCP_SERVER", "MCP_PROMPT", "MCP_RESOURCE"]);

export const COMMON_ENTITY_ATTRIBUTES: Record<string, readonly string[]> = {
  API: [
    "id",
    "name",
    "serviceId",
    "serviceName",
    "environment",
    "apiType",
    "isAuthenticated",
    "authTypes",
    "isExternal",
    "hasPii",
    "dataTypeIds",
    "piiTypes",
    "riskScore",
    "riskScoreCategory",
    "lastCalledTime",
    "createdTime",
    "isLearnt",
  ],
  SERVICE: ["id", "name", "environment", "applicationType"],
  BACKEND: ["id", "name", "type", "environment"],
  BACKEND_API: ["id", "apiName", "backendName", "environment"],
  DOMAIN: ["id", "name", "environment"],
  ACTOR: [
    "actorId",
    "score",
    "scoreCategory",
    "status",
    "environment",
    "mostSuspiciousIpReputationLevel",
    "country",
    "city",
    "createdTime",
  ],
  APPLICATION_ASSET: [
    "id",
    "assetId",
    "assetType",
    "name",
    "environment",
    "riskScore",
    "riskScoreCategory",
    "datatypes",
    "lastCalled",
  ],
  APPLICATION_GROUP: ["id", "name"],
  MCP_TOOL: [
    "name",
    "isExternal",
    "isEncrypted",
    "isAuthenticated",
    "authTypes",
    "datatypeIds",
    "datasetIds",
    "createdTime",
    "lastUpdateTime",
    "owner",
    "schema",
    "mcpServerId",
    "environment",
  ],
  MCP_SERVER: ["name", "host", "createdTime", "lastCalled", "environment", "owner"],
  MCP_PROMPT: [
    "name",
    "isExternal",
    "isEncrypted",
    "authTypes",
    "datatypeIds",
    "datasetIds",
    "createdTime",
    "lastUpdateTime",
    "lastCalled",
    "owner",
    "schema",
    "mcpServerId",
    "environment",
  ],
  MCP_RESOURCE: [
    "name",
    "mcpServerId",
    "isAuthenticated",
    "authTypes",
    "environment",
    "isExternal",
    "isEncrypted",
    "lastCalled",
    "owner",
    "lastUpdateTime",
    "createdTime",
    "schema",
  ],
};

export const VULNERABILITY_DEFAULT_SOURCES = [
  "VULNERABILITY_SOURCE_TYPE_RUNTIME_PROTECTION",
  "VULNERABILITY_SOURCE_TYPE_GATEWAY_CONFIGURATION",
  "VULNERABILITY_SOURCE_TYPE_COMPLIANCE",
  "VULNERABILITY_SOURCE_TYPE_SECURITY_TESTING",
  "VULNERABILITY_SOURCE_TYPE_CONFORMANCE_ANALYSIS",
] as const;

export const VULNERABILITY_DEFAULT_STATUSES = [
  "VULNERABILITY_STATUS_OPEN",
  "VULNERABILITY_STATUS_REOPENED",
  "VULNERABILITY_STATUS_UNDER_REVIEW",
] as const;

export const VULNERABILITY_ALL_STATUSES = [
  ...VULNERABILITY_DEFAULT_STATUSES,
  "VULNERABILITY_STATUS_FIXED",
  "VULNERABILITY_STATUS_ACCEPTED_RISK",
  "VULNERABILITY_STATUS_NOT_A_VULNERABILITY",
] as const;

export const VULNERABILITY_SEVERITIES = [
  "VULNERABILITY_SEVERITY_CRITICAL",
  "VULNERABILITY_SEVERITY_HIGH",
  "VULNERABILITY_SEVERITY_MEDIUM",
  "VULNERABILITY_SEVERITY_LOW",
  "VULNERABILITY_SEVERITY_INFO",
] as const;

export const ALLOWED_VULN_ENUM_KEYS = new Set([
  "API_DISCOVERY_STATE",
  "STATUS",
  "VULNERABILITY_SUB_CATEGORY",
  "DISPLAY_NAME",
  "SUITE_TYPE",
  "VULNERABILITY_CATEGORY",
  "SEVERITY",
  "OWASP",
  "OWASP_API_TOP10",
  "AFFECTED_ENTITY_TYPE",
  "SOURCES",
  "VULNERABILITY_CHANGE_LOGS_STATUS",
  "API_RISK_CATEGORY",
  "API_RISK_SCORE_CATEGORY",
  "API_ENDPOINT_TYPE",
]);

export const APPSEC_DATATYPE_MAPPING: Record<string, readonly string[]> = {
  "Financial Information": [
    "Amex Credit Card",
    "Diners Credit Card",
    "Discover Credit Card",
    "JCB Credit Card",
    "MC Credit Card",
    "VISA Credit Card",
    "AmexCC",
    "VisaCC",
    "MasterCardCC",
    "Credit Card CVC",
    "Credit Card Encoded #",
    "Credit Card PIN",
    "CC Expiry",
    "CC Name",
    "card#",
    "test cc",
    "promptCC",
    "CreditCard-Prer",
  ],
  "Personal Identification": [
    "SSN",
    "SIN",
    "Tax ID",
    "TAX ID",
    "National ID Taiwan",
    "Italian Fiscal ID",
    "Indian PAN",
    "Indian PAN - Copy",
    "GST #",
    "Voter ID",
    "Passport",
    "Indian Passport",
    "Drivers License",
    "CURP",
    "BSN",
    "FDA #",
    "DEA #",
    "UK Insurance No",
    "Insurance ID",
    "Health ID",
    "healthID",
    "PHN",
    "Medical records number",
    "VIN",
    "CUSIP",
    "IBAN",
    "Bank #",
  ],
  "Contact Information": [
    "emailId",
    "Email",
    "mailid",
    "Phone",
    "phoneNumber",
    "Toll free number (US)",
    "address",
    "account_address_city",
    "account_address_country",
    "account_address_state",
    "account_address_street1",
    "account_address_street2",
    "hash street address",
    "State (US)",
  ],
  "Authentication Credentials": [
    "Username",
    "Password",
    "passwd",
    "otp",
    "captcha",
    "token",
    "JWT",
    "JWT Token",
    "API token",
    "Cert",
    "userdata",
  ],
  "Location Information": ["IP Address (v4)", "GPS"],
  "Names": ["Full name", "Middle and Last Names"],
  "System Identifiers": ["host", "hostname", "sourceSystemVersion", "id", "tenant"],
  "Miscellaneous": [
    "Legacy Datatype - Sensitive Headers",
    "Legacy Datatype - Automatic Secret Redaction",
    "Query Param Sensitive data",
    "http-url",
    "referer",
    "URL request data",
    "hmac",
  ],
};

export const DATATYPES_QUERY = `query GetDataTypes {
  dataTypes {
    results {
      id
      name
      description
      dataSuppression
      sensitivity
    }
  }
}`;

export function buildAttributeSelectionBlock(
  attributes: readonly string[],
  metricMode: "none" | "numCallsOnly" | "apiMetrics" = "none",
): string {
  const seen = new Set<string>();
  const lines: string[] = ["entityId: id"];
  for (const attr of attributes) {
    if (!attr || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(attr) || seen.has(attr)) continue;
    seen.add(attr);
    if (attr === "numCalls" || (attr === "errorCount" && metricMode === "apiMetrics")) {
      lines.push(`${attr}: metric(expression: {key: "${attr}"}) { sum { value } }`);
    } else {
      lines.push(`${attr}: attribute(expression: {key: "${attr}"})`);
    }
  }
  if (metricMode === "numCallsOnly" || metricMode === "apiMetrics") {
    if (!seen.has("numCalls")) {
      lines.push(`numCalls: metric(expression: {key: "numCalls"}) { sum { value } }`);
    }
  }
  if (metricMode === "apiMetrics" && !seen.has("errorCount")) {
    lines.push(`errorCount: metric(expression: {key: "errorCount"}) { sum { value } }`);
  }
  return lines.join("\n          ");
}

export function buildEntitiesQuery(selectionBlock: string): string {
  return `query GetEntities(
  $scope: String,
  $between: InputTimeRange!,
  $filterBy: [InputFilter],
  $orderBy: [InputAggregatableOrder],
  $limit: Int,
  $offset: Int,
  $includeInactive: Boolean
) {
  entities(
    scope: $scope,
    between: $between,
    filterBy: $filterBy,
    orderBy: $orderBy,
    limit: $limit,
    offset: $offset,
    includeInactive: $includeInactive
  ) {
    count
    total
    results {
      ${selectionBlock}
    }
  }
}`;
}
