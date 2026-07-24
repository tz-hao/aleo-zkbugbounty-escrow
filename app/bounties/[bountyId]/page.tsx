import { PublicBountyView } from "@/components/public-bounty-view";

export default async function PublicBountyPage({
  params,
}: {
  params: Promise<{ bountyId: string }>;
}) {
  const { bountyId } = await params;
  return <PublicBountyView bountyId={bountyId} />;
}
