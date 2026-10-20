import { describe, expect, it } from "vitest";
import type { ConversationListItem } from "@/lib/messaging/service";
import {
  canComposeConversation,
  filterConversations,
  getConversationStatus,
  getConversationTitle,
} from "@/components/messaging/conversation-view";

const currentUserId = "client-1";

function conversation(
  id: string,
  overrides: Partial<ConversationListItem> = {},
): ConversationListItem {
  return {
    id,
    client_id: currentUserId,
    provider_id: "provider-1",
    project_id: id,
    application_id: id,
    service_request_id: null,
    source_deleted_at: null,
    source_title: null,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    project: { id, title: "Website design", slug: "website-design", status: "in_discussion" },
    application: { id, status: "pending", proposed_price: null, estimated_delivery_days: null },
    service_request: null,
    client: { id: currentUserId, full_name: "Client", country: null, city: null },
    provider: { id: "provider-1", full_name: "Elena Rostova", country: null, city: null },
    last_message: {
      id: `${id}-message`,
      message_text: "Let's discuss the website scope",
      sender_id: "provider-1",
      created_at: "2026-10-01T10:00:00Z",
      is_read: false,
    },
    unread_count: 1,
    ...overrides,
  };
}

describe("messaging view", () => {
  const pending = conversation("pending");
  const accepted = conversation("accepted", {
    application: { id: "accepted", status: "accepted", proposed_price: null, estimated_delivery_days: null },
    unread_count: 0,
  });
  const cancelledService = conversation("cancelled", {
    project_id: null,
    application_id: null,
    project: null,
    application: null,
    service_request_id: "request-1",
    service_request: {
      id: "request-1",
      service_id: "service-1",
      message: "I need a logo",
      status: "cancelled",
      service: {
        id: "service-1",
        title: "Logo design",
        status: "published",
        price_type: "fixed",
        starting_price: 250,
      },
    },
  });
  const projectOnly = conversation("project-only", {
    application_id: null,
    application: null,
  });
  const all = [pending, accepted, cancelledService, projectOnly];

  it("searches by participant, listing title, and last message preview", () => {
    expect(filterConversations(all, currentUserId, "  elena  ", "all")).toHaveLength(4);
    expect(filterConversations(all, currentUserId, "logo", "all").map((item) => item.id)).toEqual(["cancelled"]);
    expect(filterConversations(all, currentUserId, "website scope", "all")).toHaveLength(4);
  });

  it("filters unread, pending, accepted, and closed conversations", () => {
    expect(filterConversations(all, currentUserId, "", "unread").map((item) => item.id)).toEqual(["pending", "cancelled", "project-only"]);
    expect(filterConversations(all, currentUserId, "", "pending").map((item) => item.id)).toEqual(["pending"]);
    expect(filterConversations(all, currentUserId, "", "accepted").map((item) => item.id)).toEqual(["accepted"]);
    expect(filterConversations(all, currentUserId, "", "closed").map((item) => item.id)).toEqual(["cancelled", "project-only"]);
  });

  it("keeps service request messaging available after cancellation but project-only read-only", () => {
    expect(canComposeConversation(cancelledService)).toBe(true);
    expect(canComposeConversation(projectOnly)).toBe(false);
    expect(canComposeConversation(conversation("withdrawn", {
      application: { id: "withdrawn", status: "withdrawn", proposed_price: null, estimated_delivery_days: null },
    }))).toBe(false);
  });

  it("disables composing when the source listing has been deleted", () => {
    const deleted = conversation("deleted", { source_deleted_at: "2026-10-10T10:00:00Z" });
    expect(canComposeConversation(deleted)).toBe(false);
    expect(getConversationStatus(deleted).label).toBe("Listing removed");
    expect(getConversationTitle({ ...deleted, project: null, source_title: "Archived listing" })).toBe("Archived listing");
  });
});
