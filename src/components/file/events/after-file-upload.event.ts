import { File, FileVersion } from '../dto';

/**
 * Emitted as the last step of the file upload process.
 * Feel free to throw to abort mutation.
 */
export class AfterFileUploadEvent {
  constructor(readonly file: File, readonly newVersion: FileVersion) {}
}
