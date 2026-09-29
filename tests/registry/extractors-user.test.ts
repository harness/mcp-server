import { describe, expect, it } from "vitest";
import {
  flattenUserAggregate,
  userAggregateExtract,
  userAggregatePageExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";

const nestedUser = {
  user: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    uuid: "uuid-ada",
    locked: false,
    disabled: false,
    externallyManaged: false,
  },
  roleAssignmentMetadata: [{ identifier: "ra1", roleName: "Account Viewer" }],
};

describe("flattenUserAggregate", () => {
  it("promotes nested user.uuid to identifier/uuid and copies email/name", () => {
    expect(flattenUserAggregate(nestedUser)).toMatchObject({
      identifier: "uuid-ada",
      uuid: "uuid-ada",
      email: "ada@example.com",
      name: "Ada Lovelace",
      locked: false,
    });
  });

  it("keeps already-flat identity fields", () => {
    expect(flattenUserAggregate({ uuid: "u1", email: "a@b.c", name: "A" })).toMatchObject({
      identifier: "u1",
      uuid: "u1",
      email: "a@b.c",
      name: "A",
    });
  });
});

describe("userAggregateExtract / pageExtract", () => {
  it("unwraps NG get envelope and flattens identity", () => {
    expect(userAggregateExtract({ status: "SUCCESS", data: nestedUser })).toMatchObject({
      identifier: "uuid-ada",
      email: "ada@example.com",
      roleAssignmentMetadata: [{ identifier: "ra1", roleName: "Account Viewer" }],
    });
  });

  it("unwraps NG list envelope and flattens each item", () => {
    expect(
      userAggregatePageExtract({
        data: { content: [nestedUser], totalElements: 1 },
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          identifier: "uuid-ada",
          uuid: "uuid-ada",
          email: "ada@example.com",
        }),
      ],
      total: 1,
    });
  });
});

describe("compact vs nested user DTO", () => {
  it("default compact drops nested user and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedUser]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.uuid).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.user).toBeUndefined();
  });
});
