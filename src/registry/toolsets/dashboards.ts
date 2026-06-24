import type { ToolsetDefinition, ParamsSchema } from "../types.js";
import { dashboardListExtract, dashboardDataExtract } from "../extractors.js";

const DASHBOARD_DATA_GET_PARAMS: ParamsSchema = {
  fields: [
    {
      name: "reporting_timeframe",
      required: false,
      description: "Reporting timeframe in days (default 30)",
    },
  ],
};

export const dashboardsToolset: ToolsetDefinition = {
  name: "dashboards",
  displayName: "Dashboards",
  description: "Harness custom dashboards and analytics",
  resources: [
    {
      resourceType: "dashboard",
      displayName: "Dashboard",
      description: "Custom analytics dashboard. Supports list. Use dashboard_data to fetch content.",
      toolset: "dashboards",
      scope: "account",
      identifierFields: ["dashboard_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter dashboards by name or keyword" },
        { name: "folder_id", description: "Filter dashboards by folder ID" },
        { name: "tags", description: "Filter dashboards by tags" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/dashboards",
      operations: {
        list: {
          method: "GET",
          path: "/dashboard/v1/search",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            folder_id: "folderId",
            tags: "tags",
            page: "page",
            size: "pageSize",
          },
          defaultQueryParams: {
            tags: "HARNESS=true&CD=true&CE=true&CET=true&CF=true&CHAOS=true&CI=true&DBOPS=true&IACM=true&IDP=true&SSCA=true&STO=true&SRM=true",
          },
          pageOneIndexed: true,
          responseExtractor: dashboardListExtract,
          description: "List dashboards",
        },
      },
    },
    {
      resourceType: "dashboard_data",
      displayName: "Dashboard Data",
      description: "Download dashboard data as CSV. Supports get with optional reporting_timeframe (days, default 30).",
      toolset: "dashboards",
      scope: "account",
      identifierFields: ["dashboard_id"],
      deepLinkTemplate: "/ng/account/{accountId}/dashboards",
      operations: {
        get: {
          method: "GET",
          path: "/dashboard/download/dashboards/{dashboardId}/csv",
          pathParams: { dashboard_id: "dashboardId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            reporting_timeframe: "filters",
            expanded_tables: "expanded_tables",
          },
          responseType: "buffer",
          responseExtractor: dashboardDataExtract,
          description: "Download dashboard data as structured tables. Pass reporting_timeframe in days (default 30).",
          paramsSchema: DASHBOARD_DATA_GET_PARAMS,
        },
      },
    },
  ],
};
