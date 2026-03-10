import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const repositoriesToolset: ToolsetDefinition = {
  name: "repositories",
  displayName: "Code Repositories",
  description: "Harness Code repositories (source control)",
  resources: [
    {
      resourceType: "repository",
      displayName: "Repository",
      description:
        "Harness Code repository. Supports list, get, create, and update.",
      toolset: "repositories",
      scope: "project",
      identifierFields: ["repo_id"],
      listFilterFields: [
        { name: "query", description: "Search repositories by name or keyword" },
        { name: "sort", description: "Sort field" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos",
          queryParams: {
            query: "query",
            sort: "sort",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List code repositories",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}",
          pathParams: { repo_id: "repoIdentifier" },
          responseExtractor: passthrough,
          description: "Get repository details",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos",
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new repository. Body fields: identifier (required), default_branch, description, is_public, readme, git_ignore, license.",
          bodySchema: {
            description: "New repository definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Repository identifier/name" },
              { name: "default_branch", type: "string", required: false, description: "Default branch name (default: main)" },
              { name: "description", type: "string", required: false, description: "Repository description" },
              { name: "is_public", type: "boolean", required: false, description: "Whether the repo is public" },
              { name: "readme", type: "boolean", required: false, description: "Initialize with a README" },
              { name: "git_ignore", type: "string", required: false, description: "Gitignore template name" },
              { name: "license", type: "string", required: false, description: "License template name" },
            ],
          },
        },
        update: {
          method: "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}",
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update a repository. Body fields: description, default_branch, is_public.",
          bodySchema: {
            description: "Repository update fields",
            fields: [
              { name: "description", type: "string", required: false, description: "Repository description" },
              { name: "default_branch", type: "string", required: false, description: "Default branch name" },
              { name: "is_public", type: "boolean", required: false, description: "Whether the repo is public" },
            ],
          },
        },
      },
    },
    {
      resourceType: "branch",
      displayName: "Branch",
      description:
        "Git branch in a Harness Code repository. Supports list, get, create, and delete.",
      toolset: "repositories",
      scope: "project",
      identifierFields: ["repo_id", "branch_name"],
      listFilterFields: [
        { name: "query", description: "Search branches by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/files/{branchName}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/branches",
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List branches in a repository",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/branches/{branchName}",
          pathParams: {
            repo_id: "repoIdentifier",
            branch_name: "branchName",
          },
          responseExtractor: passthrough,
          description: "Get branch details including latest commit",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/branches",
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new branch. Body fields: name (required), target (required — commit SHA or branch name to branch from).",
          bodySchema: {
            description: "New branch definition",
            fields: [
              { name: "name", type: "string", required: true, description: "New branch name" },
              { name: "target", type: "string", required: true, description: "Source commit SHA or branch name to create from" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/branches/{branchName}",
          pathParams: {
            repo_id: "repoIdentifier",
            branch_name: "branchName",
          },
          responseExtractor: passthrough,
          description: "Delete a branch from the repository",
        },
      },
    },
    {
      resourceType: "commit",
      displayName: "Commit",
      description:
        "Git commit in a Harness Code repository. Supports list and get.",
      toolset: "repositories",
      scope: "project",
      identifierFields: ["repo_id", "commit_sha"],
      listFilterFields: [
        { name: "git_ref", description: "Git reference (branch/tag) filter" },
        { name: "path", description: "File path filter" },
        { name: "since", description: "Filter commits since date" },
        { name: "until", description: "Filter commits until date" },
        { name: "committer", description: "Filter by committer" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/commits",
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            git_ref: "git_ref",
            path: "path",
            since: "since",
            until: "until",
            committer: "committer",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description:
            "List commits in a repository. Filter by git_ref (branch/tag), path, date range, or committer.",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/commits/{commitSha}",
          pathParams: {
            repo_id: "repoIdentifier",
            commit_sha: "commitSha",
          },
          responseExtractor: passthrough,
          description: "Get commit details by SHA",
        },
      },
      executeActions: {
        diff: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/diff/{range}",
          pathParams: {
            repo_id: "repoIdentifier",
            range: "range",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get the raw diff between two refs. Set range to 'base..head' (e.g., 'main..feature-branch').",
          bodySchema: { description: "No body required. Diff range is specified via path parameter (e.g. main..feature-branch).", fields: [] },
        },
        diff_stats: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/diff-stats/{range}",
          pathParams: {
            repo_id: "repoIdentifier",
            range: "range",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get diff stats (files changed, additions, deletions) between two refs. Set range to 'base..head'.",
          bodySchema: { description: "No body required. Range is specified via path parameter.", fields: [] },
        },
      },
    },
    {
      resourceType: "file_content",
      displayName: "File Content",
      description:
        "File or directory content from a Harness Code repository. Supports get. Use execute action 'blame' for git blame.",
      toolset: "repositories",
      scope: "project",
      identifierFields: ["repo_id", "path"],
      listFilterFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/content/{filePath}",
          pathParams: {
            repo_id: "repoIdentifier",
            path: "filePath",
          },
          queryParams: {
            git_ref: "git_ref",
            include_commit: "include_commit",
          },
          responseExtractor: passthrough,
          description:
            "Get file or directory content. Specify path and optional git_ref (branch/tag/SHA). Returns file content or directory listing.",
        },
      },
      executeActions: {
        blame: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/blame/{filePath}",
          pathParams: {
            repo_id: "repoIdentifier",
            path: "filePath",
          },
          queryParams: {
            git_ref: "git_ref",
            line_from: "line_from",
            line_to: "line_to",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get git blame for a file. Optional line_from/line_to to restrict range.",
          bodySchema: { description: "No body required. File path and optional line range specified via path/query parameters.", fields: [] },
        },
      },
    },
    {
      resourceType: "tag",
      displayName: "Tag",
      description:
        "Git tag in a Harness Code repository. Supports list, create, and delete.",
      toolset: "repositories",
      scope: "project",
      identifierFields: ["repo_id", "tag_name"],
      listFilterFields: [
        { name: "query", description: "Search tags by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/tags",
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List tags in a repository",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/tags",
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a tag. Body fields: name (required), target (required — commit SHA), message (optional — for annotated tags).",
          bodySchema: {
            description: "New tag definition",
            fields: [
              { name: "name", type: "string", required: true, description: "Tag name" },
              { name: "target", type: "string", required: true, description: "Commit SHA to tag" },
              { name: "message", type: "string", required: false, description: "Tag message (creates annotated tag)" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/tags/{tagName}",
          pathParams: {
            repo_id: "repoIdentifier",
            tag_name: "tagName",
          },
          responseExtractor: passthrough,
          description: "Delete a tag from the repository",
        },
      },
    },
  ],
};
