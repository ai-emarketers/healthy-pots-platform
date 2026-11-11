/** Request shapes and validation for kitchen status updates. */
import { IsIn, IsString, Matches } from 'class-validator';
import { IsIsoDate } from '../common/validators';

/** Request body for: meal status. Unknown fields are stripped and invalid values return 400. */
export class MealStatusDto {
  @IsIn(['PREPARING', 'READY']) status: 'PREPARING' | 'READY';
}

/** Request body for: bulk status. Unknown fields are stripped and invalid values return 400. */
export class BulkStatusDto {
  /** an ISO date, "today" or "next" */
  @IsString() @Matches(/^(today|next|\d{4}-\d{2}-\d{2})$/, { message: 'Date must be YYYY-MM-DD, today or next' }) date: string;
  @IsIn(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']) mealType: any;
  @IsIn(['PREPARING', 'READY']) status: 'PREPARING' | 'READY';
}
