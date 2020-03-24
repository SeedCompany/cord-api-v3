import { Injectable, NotImplementedException } from '@nestjs/common';
import { ISession } from '../../common';
import { ProductListInput, SecuredProductList } from '../product';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementListInput,
  EngagementListOutput,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

@Injectable()
export class EngagementService {
  async readOne(_id: string, _session: ISession): Promise<Engagement> {
    throw new NotImplementedException();
  }

  async list(
    _input: EngagementListInput,
    _session: ISession
  ): Promise<EngagementListOutput> {
    throw new NotImplementedException();
  }

  async listProducts(
    _engagement: LanguageEngagement,
    _input: ProductListInput,
    _session: ISession
  ): Promise<SecuredProductList> {
    throw new NotImplementedException();
  }

  async createLanguageEngagement(
    _input: CreateLanguageEngagement,
    _session: ISession
  ): Promise<LanguageEngagement> {
    throw new NotImplementedException();
  }

  async createInternshipEngagement(
    _input: CreateInternshipEngagement,
    _session: ISession
  ): Promise<InternshipEngagement> {
    throw new NotImplementedException();
  }

  async updateLanguageEngagement(
    _input: UpdateLanguageEngagement,
    _session: ISession
  ): Promise<LanguageEngagement> {
    throw new NotImplementedException();
  }

  async updateInternshipEngagement(
    _input: UpdateInternshipEngagement,
    _session: ISession
  ): Promise<InternshipEngagement> {
    throw new NotImplementedException();
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
