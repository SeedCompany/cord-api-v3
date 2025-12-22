import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AbstractGraphQLDriver } from '@nestjs/graphql';
import { CachedGetter } from '@seedcompany/common';
import { type Driver } from './driver';

@Injectable()
export class Yoga {
  constructor(private readonly moduleRef: ModuleRef) {}

  get getEnveloped() {
    return this.driver.yoga.getEnveloped;
  }

  @CachedGetter() private get driver() {
    return this.moduleRef.get<Driver>(AbstractGraphQLDriver, {
      strict: false,
    });
  }
}
