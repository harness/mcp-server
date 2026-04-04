import { describe, it, expect } from "vitest";
import { documentationToolset } from "../../src/registry/toolsets/documentation.js";

describe("Documentation toolset", () => {
  describe("chatbotResponseExtract", () => {
    // Extract the responseExtractor function for testing
    const extractor = documentationToolset.resources[0].operations.list?.responseExtractor;
    if (!extractor) {
      throw new Error("responseExtractor not found");
    }

    it("handles string responses (legacy format)", () => {
      const result = extractor("This is a plain string answer");
      expect(result).toEqual({
        items: [{ answer: "This is a plain string answer" }],
        total: 1,
      });
    });

    it("handles empty string responses", () => {
      const result = extractor("");
      expect(result).toEqual({
        items: [{ answer: "No answer available" }],
        total: 0,
      });
    });

    it("handles whitespace-only string responses", () => {
      const result = extractor("   \n\t  ");
      expect(result).toEqual({
        items: [{ answer: "No answer available" }],
        total: 0,
      });
    });

    it("handles object responses with valid answer", () => {
      const input = {
        answer: "Harness CI/CD is a platform for continuous delivery",
        sources: [{ url: "https://docs.harness.io", title: "Docs" }],
        conversation_id: "conv-123",
      };
      const result = extractor(input);
      expect(result).toEqual({
        items: [input],
        total: 1,
      });
    });

    it("handles object responses with empty answer but preserves sources", () => {
      const input = {
        answer: "",
        sources: [{ url: "https://docs.harness.io", title: "Docs" }],
        conversation_id: "conv-123",
      };
      const result = extractor(input);
      expect(result).toEqual({
        items: [{ answer: "No answer available", sources: input.sources }],
        total: 0,
      });
    });

    it("handles object responses with whitespace-only answer", () => {
      const input = {
        answer: "   \n  ",
        sources: [{ url: "https://docs.harness.io" }],
      };
      const result = extractor(input);
      expect(result).toEqual({
        items: [{ answer: "No answer available", sources: input.sources }],
        total: 0,
      });
    });

    it("handles object responses without answer field (malformed)", () => {
      const input = { some_other_field: "value", data: [1, 2, 3] };
      const result = extractor(input);
      expect(result).toEqual({
        items: [{ answer: JSON.stringify(input) }],
        total: 1,
      });
    });

    it("handles null input", () => {
      const result = extractor(null);
      expect(result).toEqual({
        items: [{ answer: "null" }],
        total: 1,
      });
    });

    it("handles undefined input", () => {
      const result = extractor(undefined);
      expect(result).toEqual({
        items: [{ answer: undefined }],
        total: 1,
      });
    });

    it("handles number input", () => {
      const result = extractor(42);
      expect(result).toEqual({
        items: [{ answer: "42" }],
        total: 1,
      });
    });

    it("handles array input (malformed)", () => {
      const result = extractor([{ answer: "test" }]);
      expect(result).toEqual({
        items: [{ answer: JSON.stringify([{ answer: "test" }]) }],
        total: 1,
      });
    });
  });

  describe("toolset metadata", () => {
    it("has correct toolset name and display name", () => {
      expect(documentationToolset.name).toBe("documentation");
      expect(documentationToolset.displayName).toBe("Documentation");
    });

    it("defines a documentation resource with account scope", () => {
      const resource = documentationToolset.resources[0];
      expect(resource.resourceType).toBe("documentation");
      expect(resource.scope).toBe("account");
    });

    it("defines list operation with POST method", () => {
      const resource = documentationToolset.resources[0];
      expect(resource.operations.list?.method).toBe("POST");
      expect(resource.operations.list?.path).toBe("/harness-intelligence/api/v1/docs-chat");
    });

    it("has listFilterFields for question, chat_history, and conversation_id", () => {
      const resource = documentationToolset.resources[0];
      const filterFields = resource.listFilterFields || [];
      expect(filterFields.map((f) => f.name)).toEqual(["question", "chat_history", "conversation_id"]);
    });
  });

  describe("bodyBuilder", () => {
    const bodyBuilder = documentationToolset.resources[0].operations.list?.bodyBuilder;
    if (!bodyBuilder) {
      throw new Error("bodyBuilder not found");
    }

    it("maps search_term to question field", () => {
      const body = bodyBuilder({ search_term: "What is CI?" });
      expect(body).toEqual({ question: "What is CI?" });
    });

    it("maps query to question field", () => {
      const body = bodyBuilder({ query: "What is CD?" });
      expect(body).toEqual({ question: "What is CD?" });
    });

    it("maps question to question field directly", () => {
      const body = bodyBuilder({ question: "What is Harness?" });
      expect(body).toEqual({ question: "What is Harness?" });
    });

    it("includes chat_history when provided", () => {
      const history = [
        { question: "What is CI?", answer: "Continuous Integration..." },
        { question: "What is CD?", answer: "Continuous Delivery..." },
      ];
      const body = bodyBuilder({ search_term: "Tell me more", chat_history: history });
      expect(body).toEqual({ question: "Tell me more", chat_history: history });
    });

    it("excludes chat_history when empty", () => {
      const body = bodyBuilder({ search_term: "What is CI?", chat_history: [] });
      expect(body).toEqual({ question: "What is CI?" });
    });

    it("defaults to empty string when no question field provided", () => {
      const body = bodyBuilder({});
      expect(body).toEqual({ question: "" });
    });
  });

  describe("headersBuilder", () => {
    const headersBuilder = documentationToolset.resources[0].operations.list?.headersBuilder;
    if (!headersBuilder) {
      throw new Error("headersBuilder not found");
    }

    it("always includes X-Request-ID header", () => {
      const headers = headersBuilder({});
      expect(headers["X-Request-ID"]).toBeDefined();
      expect(typeof headers["X-Request-ID"]).toBe("string");
      expect(headers["X-Request-ID"].length).toBeGreaterThan(0);
    });

    it("includes X-Conversation-Id when conversation_id is provided", () => {
      const headers = headersBuilder({ conversation_id: "conv-123" });
      expect(headers["X-Conversation-Id"]).toBe("conv-123");
    });

    it("excludes X-Conversation-Id when conversation_id is empty string", () => {
      const headers = headersBuilder({ conversation_id: "" });
      expect(headers["X-Conversation-Id"]).toBeUndefined();
    });

    it("excludes X-Conversation-Id when conversation_id is not provided", () => {
      const headers = headersBuilder({});
      expect(headers["X-Conversation-Id"]).toBeUndefined();
    });

    it("excludes X-Conversation-Id when conversation_id is not a string", () => {
      const headers = headersBuilder({ conversation_id: 123 });
      expect(headers["X-Conversation-Id"]).toBeUndefined();
    });
  });
});
