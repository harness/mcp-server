export interface ResourceExample {
  /** Unique name for this example, used to fetch it (e.g. 'minimal-ci') */
  name: string;
  /** Which resource_type this example belongs to (e.g. 'pipeline', 'pipeline_v1') */
  resourceType: string;
  /** One-line human description shown in search results */
  description: string;
  /** Searchable tags — matched during example_search */
  tags: string[];
  /** The actual YAML content */
  yaml: string;
}
