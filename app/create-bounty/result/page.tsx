import { CreateBountyResult } from "@/components/create-bounty-result";

export default async function CreateBountyResultPage({
  searchParams,
}: {
  searchParams: Promise<{ bountyId?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialBountyId = typeof params.bountyId === "string" ? params.bountyId : "";
  return <CreateBountyResult initialBountyId={initialBountyId} />;
}
