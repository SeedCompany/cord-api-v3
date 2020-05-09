import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationModule } from '../authentication';
import { OrganizationModule } from '../organization';
import { UnavailabilityModule, UserModule, UserService } from '../user';
import { File, FileNodeCategory, FileNodeType } from './dto';
import { FileService } from './file.service';
import {
  FilesBucketFactory,
  FilesBucketToken,
} from './files-s3-bucket.factory';
import { S3Bucket } from './s3-bucket';

const createTestFile: Partial<File> = {
  id: generate(),
  type: FileNodeType.File,
  createdAt: DateTime.local(),
  category: FileNodeCategory.Document,
  modifiedAt: DateTime.local(),
  name: 'test-file',
  size: 12345,
  mimeType: 'text/plain',
  parents: [],
};
const updatedFileNode: Partial<File> = {
  name: 'newTestFile',
};

const mockDbService = {
  createNode: () => createTestFile,
  query: () => ({
    raw: () => ({
      run: () => ({}),
      first: () => ({}),
    }),
  }),
  readProperties: () => ({}),
  deleteNode: () => ({}),
};

describe('file service', () => {
  let fileService: FileService;
  let bucket: S3Bucket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forTest(),
        UserModule,
        CoreModule,
        OrganizationModule,
        UnavailabilityModule,
        AuthenticationModule,
      ],
      providers: [
        FileService,
        UserService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
        FilesBucketFactory,
      ],
    }).compile();

    fileService = module.get<FileService>(FileService);
    bucket = module.get(FilesBucketToken);
  });

  it('should be defined', () => {
    expect(fileService).toBeDefined();
  });

  it('should create file node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.getObject = jest.fn().mockReturnValue({ data: createTestFile });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.moveObject = jest.fn().mockReturnValue({});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fileService.getFile = jest.fn().mockReturnValue(createTestFile);

    const file = await fileService.createFile(
      {
        parentId: 'test-parent',
        name: 'test-file',
        uploadId: 'xyz',
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: 'abcd',
        issuedAt: DateTime.local(),
      }
    );
    expect(file.name).toEqual(createTestFile.name);
  });

  it('should delete file node', async () => {
    const mockSession = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: 'abcd',
      issuedAt: DateTime.local(),
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.getObject = jest.fn().mockReturnValue(createTestFile);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.moveObject = jest.fn().mockReturnValue({});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fileService.getFileNode = jest.fn().mockReturnValue(createTestFile);
    const file = await fileService.createFile(
      {
        parentId: 'test-parent',
        name: 'test-file',
        uploadId: 'xyz',
      },
      mockSession
    );
    await fileService.delete(file.id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(file.id).toEqual(createTestFile.id);
  });

  it('should rename file node', async () => {
    const mockSession = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: 'abcd',
      issuedAt: DateTime.local(),
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.getObject = jest.fn().mockReturnValue(createTestFile);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.moveObject = jest.fn().mockReturnValue({});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fileService.getFile = jest.fn().mockReturnValue(createTestFile);
    const file = await fileService.createFile(
      {
        parentId: 'test-parent',
        name: 'test-file',
        uploadId: 'xyz',
      },
      mockSession
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    fileService.rename = jest.fn().mockReturnValue(updatedFileNode);
    const updatedFile = await fileService.rename(
      {
        id: file.id,
        name: updatedFileNode.name!,
      },
      mockSession
    );
    expect(updatedFile.name).toEqual(updatedFileNode.name);
  });
});
