/** Request shapes and validation for delivery actions and the partner webhook. */
import { IsIn, IsOptional } from 'class-validator';
import { OptionalText, Text } from '../common/validators';

/** Request body for: assign. Unknown fields are stripped and invalid values return 400. */
export class AssignDto {
  @Text(2, 60, 'Partner') partner: string;
}

/** Request body for: advance. Unknown fields are stripped and invalid values return 400. */
export class AdvanceDto {
  @IsIn(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) status: any;
  @IsOptional() @Text(3, 300, 'Reason') reason?: string;
}

/** Request body for: resolve. Unknown fields are stripped and invalid values return 400. */
export class ResolveDto {
  @IsIn(['REDELIVER', 'CREDIT', 'WAIVE'], { message: 'Choose CREDIT, REDELIVER or WAIVE' }) resolution: 'REDELIVER' | 'CREDIT' | 'WAIVE';
  @Text(5, 300, 'Reason') note: string;
}

/** Request body for: webhook. Unknown fields are stripped and invalid values return 400. */
export class WebhookDto {
  @Text(3, 60) trackingRef: string;
  @IsIn(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) status: any;
  @OptionalText(300) reason?: string;
}
