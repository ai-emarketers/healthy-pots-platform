'use client';
/** Failed deliveries awaiting admin resolution. */
import { PageHeader } from '@/components/ui';
import { Exceptions } from '@/components/ops/DeliveryJobs';

// Failed deliveries (read-only for kitchen staff)
export default function ExceptionsPage() {
  return (
    <>
      <PageHeader title="Delivery exceptions" sub="A failed delivery is not a completed meal. Admin investigates and resolves." />
      {/* Only admins can resolve; staff just see them as "Sent to admin" */}
      <Exceptions canResolve={false} />
    </>
  );
}
