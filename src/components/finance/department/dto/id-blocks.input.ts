import { Field, InputType } from '@nestjs/graphql';
import { csv, NonEmptyArray } from '@seedcompany/common';
import { mapRange } from '@seedcompany/scripture';
import { Transform } from 'class-transformer';
import { Range as MutableRange } from '~/common';
import { ValidateBy } from '~/common/validators/validateBy';
import { ProjectType as Program } from '../../../project/dto/project-type.enum';

type Range<Point> = Readonly<MutableRange<Point>>;

type Blocks = NonEmptyArray<Range<number>>;

@InputType()
export class FinanceDepartmentIdBlockInput {
  @Field(() => String, {
    description: 'Ranges in the form of: "1-10,20-30,40-50"',
  })
  @Transform(({ value }) => {
    try {
      return parse(value);
    } catch (e) {
      return value;
    }
  })
  @ValidateBy({
    name: 'DepartmentIdBlocks',
    validator: {
      // Valid if transformed successfully
      validate: (value) => Array.isArray(value),
      defaultMessage: (args) => {
        try {
          parse(args?.value ?? '');
          return '';
        } catch (e) {
          return e.message;
        }
      },
    },
  })
  readonly blocks: Blocks;

  @Field(() => [Program], { nullable: true })
  readonly programs?: readonly Program[];
}

const parse = (multiRangeInts: string): Blocks => {
  const [first, ...rest] = csv(multiRangeInts).map(
    (rangeInts): Range<number> => {
      const [start, end = start] = rangeInts.split(/[-–]/);
      const range = mapRange({ start, end }, (str) => {
        const point = Number(str);
        if (!Number.isSafeInteger(point) || point < 1) {
          throw new Error(`Invalid range: ${rangeInts}`);
        }
        return point;
      });
      if (range.start > range.end) {
        throw new Error(`Invalid range: ${rangeInts}`);
      }
      return range;
    },
  );
  if (!first) {
    throw new Error('Ranges cannot be empty');
  }
  return [first, ...rest];
};
