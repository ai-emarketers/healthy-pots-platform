/** Request shapes and validation for kitchen status updates. */
import { IsIn, IsString, Matches } from 'class-validator';
import { IsIsoDate } from '../common/validators';

/** Request body for: meal status. Unknown fields are stripped and invalid values return 400. */
// Body of POST /kitchen/meals/:id/status
export class MealStatusDto {
  // Kitchen can only set these two statuses (delivery sets the rest)
  @IsIn(['PREPARING', 'READY']) status: 'PREPARING' | 'READY';
}

/** Request body for: bulk status. Unknown fields are stripped and invalid values return 400. */
// Body of POST /kitchen/bulk
export class BulkStatusDto {
  /** an ISO date, "today" or "next" */
  // Date: YYYY-MM-DD, "today" or "next" (next bookable day)
  @IsString() @Matches(/^(today|next|\d{4}-\d{2}-\d{2})$/, { message: 'Date must be YYYY-MM-DD, today or next' }) date: string;
  // Which meal type to update
  @IsIn(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']) mealType: any;
  // New status for all those meals
  @IsIn(['PREPARING', 'READY']) status: 'PREPARING' | 'READY';
}
