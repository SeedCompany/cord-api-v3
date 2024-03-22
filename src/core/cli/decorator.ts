import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';
import { Command } from 'clipanion';
import { AbstractClass } from 'type-fest';

export const InjectableCommand = () => (cls: AbstractClass<Command>) =>
  applyDecorators(Injectable(), SetMetadata(Command, true))(cls);
