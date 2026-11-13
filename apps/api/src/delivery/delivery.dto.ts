/** Request shapes and validation for delivery actions and the partner webhook. */
import { IsIn, IsOptional } from 'class-validator';
import { OptionalText, Text } from '../common/validators';

/** Request body for: assign. Unknown fields are stripped and invalid values return 400. */
// Body of POST /delivery/jobs/:id/assign
export class AssignDto {
  // Partner name
  @Text(2, 60, 'Partner') partner: string;
}

/** Request body for: advance. Unknown fields are stripped and invalid values return 400. */
// Body of POST /delivery/jobs/:id/advance
export class AdvanceDto {
  // Next status
  @IsIn(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) status: any;
  // Reason (mandatory for FAILED, checked in the service)
  @IsOptional() @Text(3, 300, 'Reason') reason?: string;
}

/** Request body for: resolve. Unknown fields are stripped and invalid values return 400. */
// Body of POST /delivery/exceptions/:id/resolve
export class ResolveDto {
  // Redeliver / credit the customer / waive the meal
  @IsIn(['REDELIVER', 'CREDIT', 'WAIVE'], { message: 'Choose CREDIT, REDELIVER or WAIVE' }) resolution: 'REDELIVER' | 'CREDIT' | 'WAIVE';
  // Reason is mandatory (goes to the audit log)
  @Text(5, 300, 'Reason') note: string;
}

/** Request body for: webhook. Unknown fields are stripped and invalid values return 400. */
// Body of the delivery-partner webhook
export class WebhookDto {
  // Tracking reference to match a job
  @Text(3, 60) trackingRef: string;
  // Status sent by the partner
  @IsIn(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) status: any;
  // Failure reason
  @OptionalText(300) reason?: string;
}
