'use client';
/** Failed deliveries awaiting admin resolution. */
import { PageHeader } from '@/components/ui';
import { Exceptions } from '@/components/ops/DeliveryJobs';

export default function ExceptionsPage() {
  return (
    <>
      <PageHeader title="Delivery exceptions" sub="A failed delivery is not a completed meal. Admin investigates and resolves." />
      <Exceptions canResolve={false} />
    </>
  );
}
