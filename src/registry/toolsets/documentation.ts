import { randomUUID } from "node:crypto";
import type { ToolsetDefinition } from "../types.js";

/**
 * Wraps the chatbot's response into the standard list format
 * so harness_search and harness_list can display it uniformly.
 *
 * Expected API response: { answer: string, sources?: Array<{...}>, conversation_id?: string }
 *
 * Handles edge cases:
 * - String responses (legacy format)
 * - Empty/null answers
 * - Malformed responses (fallback to stringified JSON)
 */
const chatbotResponseExtract = (raw: unknown): { items: unknown[]; total: number } => {
  // Handle plain string response
  if (typeof raw === "string") {
    const answer = raw.trim();
    return {
      items: [{ answer: answer || "No answer available" }],
      total: answer ? 1 : 0
    };
  }

  // Handle object response with answer field
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if ("answer" in obj) {
      const answer = obj.answer;
      if (typeof answer === "string" && answer.trim().length > 0) {
        return { items: [raw], total: 1 };
      }
      // Empty answer - preserve sources if present
      return {
        items: [{ answer: "No answer available", sources: obj.sources }],
        total: 0
      };
    }
  }

  // Fallback for unexpected format
  return { items: [{ answer: JSON.stringify(raw) }], total: 1 };
};

export const documentationToolset: ToolsetDefinition = {
  name: "documentation",
  displayName: "Documentation",
  description: "Query Harness documentation using the AI-powered documentation chatbot",
  resources: [
    {
      resourceType: "documentation",
      displayName: "Documentation",
      description:
        "Ask questions about Harness products, features, concepts, and how-to guides. " +
        "Uses the Harness Documentation Bot powered by official Harness docs (https://developer.harness.io/docs). " +
        "Returns answer with source citations. " +
        "For simple questions: use harness_search(query='...', resource_types=['documentation']). " +
        "For follow-up questions: use harness_list(resource_type='documentation', search_term='...', " +
        "filters={conversation_id: '<id-from-previous-response>', chat_history: [{question: '...', answer: '...'}]}). " +
        "The first response will include a conversation_id for subsequent turns.",
      toolset: "documentation",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "question", description: "The question to ask the documentation chatbot (alternative to search_term)" },
        { name: "chat_history", description: "Array of previous Q&A pairs for conversational context. Format: [{question: 'What is CI?', answer: '...'}, ...]" },
        { name: "conversation_id", description: "Conversation ID from previous response for multi-turn context. Extracted from first chatbot response and passed as X-Conversation-Id header." },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/harness-intelligence/api/v1/docs-chat",
          bodyBuilder: (input: Record<string, unknown>) => {
            const body: Record<string, unknown> = {
              question: input.search_term ?? input.query ?? input.search ?? input.question ?? input.name ?? "",
            };
            if (Array.isArray(input.chat_history) && input.chat_history.length > 0) {
              body.chat_history = input.chat_history;
            }
            return body;
          },
          headersBuilder: (input: Record<string, unknown>) => {
            const headers: Record<string, string> = {
              "X-Request-ID": randomUUID(),
            };
            const convId = input.conversation_id;
            if (typeof convId === "string" && convId.length > 0) {
              headers["X-Conversation-Id"] = convId;
            }
            return headers;
          },
          responseExtractor: chatbotResponseExtract,
          description: "Ask a question to the Harness documentation chatbot",
        },
      },
    },
  ],
};
