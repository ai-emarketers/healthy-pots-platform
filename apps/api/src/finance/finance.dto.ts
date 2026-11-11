/** Request shape and validation for payment confirmation. */
import { IsIn, IsOptional } from 'class-validator';

/** Request body for: confirm payment. Unknown fields are stripped and invalid values return 400. */
export class ConfirmPaymentDto {
  @IsOptional() @IsIn(['UPI', 'Card', 'NetBanking', 'Wallet']) method?: string;
}
