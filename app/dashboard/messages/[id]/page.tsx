import { redirect } from "next/navigation";

type MessagesThreadRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MessagesThreadRedirectPage({
  params,
}: MessagesThreadRedirectPageProps) {
  const { id } = await params;

  redirect(`/dashboard/messages?conversation=${id}`);
}
