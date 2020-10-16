import { generate, isValid } from 'shortid';

export const generateId = async () => generate();

export const isValidId = isValid;
