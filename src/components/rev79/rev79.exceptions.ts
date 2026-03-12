import { InputException, NotFoundException } from '~/common';

/**
 * No Cord project was found (or is readable) for the given Rev79 project ID.
 */
export class Rev79ProjectNotFoundException extends NotFoundException {
  constructor(rev79ProjectId: string) {
    super(
      `No project found for Rev79 project ID "${rev79ProjectId}"`,
      'rev79ProjectId',
    );
  }
}

/**
 * No language engagement was found within the resolved project for the given
 * Rev79 community ID.
 */
export class Rev79CommunityNotFoundException extends NotFoundException {
  constructor(rev79CommunityId: string) {
    super(
      `No language engagement found for Rev79 community ID "${rev79CommunityId}"`,
      'rev79CommunityId',
    );
  }
}

/**
 * More than one language engagement within the project has the given Rev79
 * community ID, making the mapping ambiguous.
 */
export class AmbiguousRev79CommunityException extends InputException {
  constructor(rev79CommunityId: string) {
    super(
      `Multiple language engagements found for Rev79 community ID "${rev79CommunityId}". Mapping is ambiguous.`,
      'rev79CommunityId',
    );
  }
}

/**
 * The requested quarter number is outside the valid range of 1–4.
 */
export class QuarterOutOfRangeException extends InputException {
  constructor(quarter: number) {
    super(`Quarter must be between 1 and 4, got ${quarter}`, 'period.quarter');
  }
}

/**
 * No progress report exists for the resolved engagement covering the requested quarter.
 */
export class ProgressReportNotFoundException extends NotFoundException {
  constructor(year: number, quarter: number) {
    super(`No progress report found for Q${quarter} ${year}`);
  }
}
