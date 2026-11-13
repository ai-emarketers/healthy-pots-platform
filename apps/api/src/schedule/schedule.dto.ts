/** Request shapes and validation for pause, resume and reschedule. */
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { IsIsoDate, IsMealTypes, OptionalText } from '../common/validators';

/** Request body for: pause. Unknown fields are stripped and invalid values return 400. */
// Body of POST /schedule/pause
export class PauseDto {
  // Which subscription
  @IsUUID() subscriptionId: string;
  // Specific meals to pause (alternative to date range)
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) mealIds?: string[];
  // Pause range start
  @IsOptional() @IsIsoDate() fromDate?: string;
  // Pause range end
  @IsOptional() @IsIsoDate() toDate?: string;
  // Limit the range to these meal types
  @IsOptional() @IsMealTypes() mealTypes?: any[];
  // Reason (audited, required for admins in practice)
  @OptionalText(300) reason?: string;
}

/** Request body for: resume. Unknown fields are stripped and invalid values return 400. */
// Body of POST /schedule/resume
export class ResumeDto {
  // Which subscription
  @IsUUID() subscriptionId: string;
  // Specific meals to resume (default: all paused)
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) mealIds?: string[];
  // Reason
  @OptionalText(300) reason?: string;
}

/** Request body for: reschedule. Unknown fields are stripped and invalid values return 400. */
// Body of POST /schedule/reschedule
export class RescheduleDto {
  // Meal to move
  @IsUUID() mealId: string;
  // Target date
  @IsIsoDate() newDate: string;
  // Reason
  @OptionalText(300) reason?: string;
}
