import { Injectable } from '@nestjs/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { type Command } from 'clipanion';
import { type AbstractClass } from 'type-fest';

export const CommandWatermark = createMetadataDecorator({
  types: ['class'],
  additionalDecorators: [Injectable()],
});

export const InjectableCommand = () => (cls: AbstractClass<Command>) =>
  CommandWatermark()(cls);
