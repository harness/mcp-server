export type SearchRoutingMode = "specific" | "cross_domain" | "ambiguous";

export interface SearchRoutingGoldenCase {
  id: string;
  query: string;
  mode: SearchRoutingMode;
  expectedTypes: string[];
  acceptableTypes?: string[];
  description?: string;
}

export interface SearchRoutingObservation {
  id: string;
  query: string;
  mode: SearchRoutingMode;
  expectedTypes: string[];
  acceptableTypes: string[];
  routedTypes: string[];
  semanticRouted: boolean;
  searchedTypes: number;
  candidateTypes: number;
  topScore: number;
  latencyMs: number;
}

export interface SearchRoutingCaseResult extends SearchRoutingObservation {
  matchedExpectedTypes: string[];
  missingExpectedTypes: string[];
  extraRoutedTypes: string[];
  expectedRecall: number;
  passed: boolean;
}

export interface SearchRoutingSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  expectedTypeRecall: number;
  falseNegativeCount: number;
  averageRoutedTypes: number;
  averageSearchedTypes: number;
  averageLatencyMs: number;
  averageTopScore: number;
}

export interface SearchRoutingEvaluation {
  cases: SearchRoutingCaseResult[];
  summary: SearchRoutingSummary;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export function validateGoldenCases(
  cases: readonly SearchRoutingGoldenCase[],
  knownResourceTypes: readonly string[],
): string[] {
  const known = new Set(knownResourceTypes);
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (!testCase.id) errors.push("Golden case is missing id");
    if (ids.has(testCase.id)) errors.push(`Duplicate golden case id: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.query) errors.push(`${testCase.id}: query is required`);
    if (!["specific", "cross_domain", "ambiguous"].includes(testCase.mode)) {
      errors.push(`${testCase.id}: invalid mode ${String(testCase.mode)}`);
    }
    if (!Array.isArray(testCase.expectedTypes) || testCase.expectedTypes.length === 0) {
      errors.push(`${testCase.id}: expectedTypes must contain at least one resource type`);
    }
    for (const resourceType of [...testCase.expectedTypes, ...(testCase.acceptableTypes ?? [])]) {
      if (!known.has(resourceType)) {
        errors.push(`${testCase.id}: unknown resource type "${resourceType}"`);
      }
    }
  }
  return errors;
}

export function evaluateRoutingCase(observation: SearchRoutingObservation): SearchRoutingCaseResult {
  const expectedTypes = unique(observation.expectedTypes);
  const acceptableTypes = unique(observation.acceptableTypes);
  const expectedSet = new Set(expectedTypes);
  const acceptableSet = new Set(acceptableTypes);
  const routedSet = new Set(observation.routedTypes);
  const matchedExpectedTypes = expectedTypes.filter((resourceType) => routedSet.has(resourceType));
  const missingExpectedTypes = expectedTypes.filter((resourceType) => !routedSet.has(resourceType));
  const extraRoutedTypes = observation.routedTypes.filter(
    (resourceType) => !expectedSet.has(resourceType) && !acceptableSet.has(resourceType),
  );
  const expectedRecall = expectedTypes.length === 0
    ? 1
    : matchedExpectedTypes.length / expectedTypes.length;
  const passed = observation.mode === "ambiguous"
    ? missingExpectedTypes.length === 0 || !observation.semanticRouted
    : missingExpectedTypes.length === 0;

  return {
    ...observation,
    expectedTypes,
    acceptableTypes,
    matchedExpectedTypes,
    missingExpectedTypes,
    extraRoutedTypes,
    expectedRecall,
    passed,
  };
}

export function summarizeRoutingEvaluation(
  cases: readonly SearchRoutingCaseResult[],
): SearchRoutingSummary {
  const totalCases = cases.length;
  const expectedTypeCount = cases.reduce((sum, result) => sum + result.expectedTypes.length, 0);
  const matchedExpectedTypeCount = cases.reduce((sum, result) => sum + result.matchedExpectedTypes.length, 0);
  const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    totalCases,
    passedCases: cases.filter((result) => result.passed).length,
    failedCases: cases.filter((result) => !result.passed).length,
    expectedTypeRecall: expectedTypeCount === 0 ? 1 : matchedExpectedTypeCount / expectedTypeCount,
    falseNegativeCount: cases.reduce((sum, result) => sum + result.missingExpectedTypes.length, 0),
    averageRoutedTypes: average(cases.map((result) => result.routedTypes.length)),
    averageSearchedTypes: average(cases.map((result) => result.searchedTypes)),
    averageLatencyMs: average(cases.map((result) => result.latencyMs)),
    averageTopScore: average(cases.map((result) => result.topScore)),
  };
}

export function evaluateRouting(
  observations: readonly SearchRoutingObservation[],
): SearchRoutingEvaluation {
  const cases = observations.map(evaluateRoutingCase);
  return {
    cases,
    summary: summarizeRoutingEvaluation(cases),
  };
}
