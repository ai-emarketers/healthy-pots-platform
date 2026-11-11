/** Request shapes and validation for pause, resume and reschedule. */
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { IsIsoDate, IsMealTypes, OptionalText } from '../common/validators';

/** Request body for: pause. Unknown fields are stripped and invalid values return 400. */
export class PauseDto {
  @IsUUID() subscriptionId: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) mealIds?: string[];
  @IsOptional() @IsIsoDate() fromDate?: string;
  @IsOptional() @IsIsoDate() toDate?: string;
  @IsOptional() @IsMealTypes() mealTypes?: any[];
  @OptionalText(300) reason?: string;
}

/** Request body for: resume. Unknown fields are stripped and invalid values return 400. */
export class ResumeDto {
  @IsUUID() subscriptionId: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) mealIds?: string[];
  @OptionalText(300) reason?: string;
}

/** Request body for: reschedule. Unknown fields are stripped and invalid values return 400. */
export class RescheduleDto {
  @IsUUID() mealId: string;
  @IsIsoDate() newDate: string;
  @OptionalText(300) reason?: string;
}
