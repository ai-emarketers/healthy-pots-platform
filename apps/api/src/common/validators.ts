/** Shared validation rules (phone, pincode, dates, text) used by the DTO classes. */
import { BadRequestException } from '@nestjs/common';
import { applyDecorators } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MealType } from '@prisma/client';

/** Shared patterns. Keep the web forms (apps/web/src/lib/validate.ts) in sync with these. */
export const PHONE_RE = /^(\+?91[\s-]?)?[6-9]\d{9}$/; // Indian mobile
export const PINCODE_RE = /^[1-9]\d{5}$/;
/** Optional map link: any http(s) URL up to 500 characters (Google Maps, maps.app.goo.gl, Apple Maps...). */
export const MAP_LINK_RE = /^https?:\/\/\S{3,490}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];
export const CITIES = ['Kolkata', 'Delhi NCR', 'Bangalore', 'Mumbai', 'Pune', 'Hyderabad'];

export const IsPhone = () => Matches(PHONE_RE, { message: 'Enter a valid 10-digit Indian mobile number' });
/** Pincode is free text: no format or serviceability rule is applied. */
export const IsPincode = () => applyDecorators(IsOptional(), IsString(), MaxLength(12));
export const IsIsoDate = () => Matches(DATE_RE, { message: 'Date must be YYYY-MM-DD' });
export const IsMealTypes = () => applyDecorators(IsArray(), IsIn(MEAL_TYPES, { each: true, message: 'Unknown meal type' }));
export const Text = (min: number, max: number, label?: string) =>
  applyDecorators(IsString(), MinLength(min, { message: `${label ?? 'This field'} must be at least ${min} characters` }), MaxLength(max, { message: `${label ?? 'This field'} must be at most ${max} characters` }));
export const OptionalText = (max: number) => applyDecorators(IsOptional(), IsString(), MaxLength(max));

/** Throws 400 with a readable message when a plain object (e.g. a map of addresses) is not a valid address. */
export function assertAddress(a: any, label: string) {
  const bad = (m: string) => new BadRequestException(`${label}: ${m}`);
  if (!a || typeof a !== 'object') throw bad('address is required');
  if (typeof a.line1 !== 'string' || a.line1.trim().length < 5 || a.line1.length > 200) throw bad('enter the house or flat number and street (5 to 200 characters)');
  if (a.landmark != null && (typeof a.landmark !== 'string' || a.landmark.length > 200)) throw bad('landmark is too long');
  if (a.mapLink != null && a.mapLink !== '' && !MAP_LINK_RE.test(String(a.mapLink))) throw bad('map link must be a web link starting with http:// or https://');
  if (typeof a.city !== 'string' || a.city.trim().length < 2 || a.city.length > 80) throw bad('city is required');
  if (a.pincode != null && (typeof a.pincode !== 'string' || a.pincode.length > 12)) throw bad('pincode is too long');
}

/** Number within [min, max], or 400. */
export function assertNumber(v: any, name: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new BadRequestException(`${name} must be a number between ${min} and ${max}`);
}
