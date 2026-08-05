import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MessagingApp } from "@/components/messaging/messaging-app-client";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MessagesPageProps = {
  searchParams: Promise<{
    conversation?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { conversation: initialConversationId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const provisioned = await ensureUserProfile(supabase, user);

  if (!provisioned.role) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (provisioned.role === "admin") {
    redirect(getDashboardPath(provisioned.role));
  }

  const conversationsResult = await getUserConversations(supabase, user.id);

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  const conversations = conversationsResult.data ?? [];
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );
  const roleDashboardPath = getDashboardPath(provisioned.role);

  return (
    <DashboardShell
      title="Messages"
      subtitle="Discuss scope, budget, timing, and project details before or after an application decision."
      actionHref={provisioned.role === "client" ? "/oglasi" : "/jobs"}
      actionLabel={provisioned.role === "client" ? "Review Projects" : "Browse Jobs"}
      navItems={[
        { href: roleDashboardPath, label: "Overview" },
        {
          href:
            provisioned.role === "client"
              ? "/dashboard/client/projects"
              : "/dashboard/provider/applications",
          label: provisioned.role === "client" ? "Projects" : "Applications",
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
          active: true,
        },
        {
          href:
            provisioned.role === "client"
              ? "/dashboard/client/profile"
              : "/dashboard/provider/profile",
          label: "Profile",
        },
      ]}
    >
      <MessagingApp
        conversations={conversations}
        currentUserId={user.id}
        initialConversationId={initialConversationId}
      />
    </DashboardShell>
  );
}
