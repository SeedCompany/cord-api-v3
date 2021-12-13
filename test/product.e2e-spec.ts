import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import { times } from 'lodash';
import { CalendarDate } from '../src/common';
import { Powers, Role } from '../src/components/authorization';
import { Film } from '../src/components/film';
import {
  AnyProduct,
  ProducibleType,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../src/components/product';
import { ScriptureRange } from '../src/components/scripture/dto';
import { Story } from '../src/components/story';
import {
  createDerivativeProduct,
  createDirectProduct,
  createFilm,
  createLanguageEngagement,
  createSession,
  createStory,
  createTestApp,
  expectNotFound,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';
import { RawLanguageEngagement, RawProduct } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';

describe('Product e2e', () => {
  let app: TestApp;
  let engagement: RawLanguageEngagement;
  let story: Story;
  let film: Film;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(
      app,
      [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
      {
        roles: [Role.ProjectManager, Role.FieldOperationsDirector],
      }
    );
    story = await createStory(app);
    film = await createFilm(app);

    engagement = await createLanguageEngagement(app);
  });
  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('create & read product by id', async () => {
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        query product($id: ID!) {
          product(id: $id) {
            ...product
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );
    const actual: RawProduct = result.product;
    expect(actual.id).toBe(product.id);
    expect(actual.mediums.value).toEqual(product.mediums.value);
    expect(actual.purposes.value).toEqual(product.purposes.value);
    expect(actual.approach).toBe(product.approach);
    expect(actual.methodology.value).toBe(product.methodology.value);
  });

  it('create DirectScriptureProduct with unspecifiedScripture', async () => {
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      unspecifiedScripture: {
        totalVerses: 10,
        book: 'Matt',
      },
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        query product($id: ID!) {
          product(id: $id) {
            ...product
            ... on DirectScriptureProduct {
              unspecifiedScripture {
                value {
                  book
                  totalVerses
                }
                canRead
                canEdit
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );
    const actual: AnyProduct = result.product;
    expect(actual?.unspecifiedScripture?.value).toMatchObject({
      book: 'Matthew',
      totalVerses: 10,
    });
  });

  it('create product with scriptureReferences', async () => {
    const randomScriptureReferences = ScriptureRange.randomList();
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      scriptureReferences: randomScriptureReferences,
      plannedCompleteDate: CalendarDate.local(),
    });

    expect(product.scriptureReferences.value).toBeDefined();
    expect(product.scriptureReferences.value).toEqual(
      expect.arrayContaining(randomScriptureReferences)
    );
  });

  it('create DerivativeScriptureProduct with produces', async () => {
    const product = await createDerivativeProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        query product($id: ID!) {
          product(id: $id) {
            ...product
            ... on DerivativeScriptureProduct {
              produces {
                value {
                  id
                  __typename
                  scriptureReferences {
                    value {
                      start {
                        book
                        chapter
                        verse
                      }
                      end {
                        book
                        chapter
                        verse
                      }
                    }
                    canRead
                    canEdit
                  }
                }
                canRead
                canEdit
              }
              scriptureReferencesOverride {
                canRead
                canEdit
                value {
                  start {
                    book
                    chapter
                    verse
                  }
                  end {
                    book
                    chapter
                    verse
                  }
                }
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );
    const actual: AnyProduct = result.product;
    expect(actual.produces).toBeDefined();
    expect(actual.produces?.value).toBeDefined();
    expect(actual.produces?.value?.id).toBe(story.id);
    expect(actual.produces?.value?.__typename).toBe(ProducibleType.Story);
    expect(actual.produces?.value?.scriptureReferences?.value).toEqual(
      expect.arrayContaining(story.scriptureReferences.value)
    );
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(
        actual.produces?.value?.scriptureReferences?.value || []
      )
    );
    expect(actual.scriptureReferencesOverride?.value).toBeNull();
  });

  it('create DerivativeScriptureProduct with scriptureReferencesOverride', async () => {
    const randomScriptureReferences = ScriptureRange.randomList();
    const product = await createDerivativeProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: randomScriptureReferences,
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        query product($id: ID!) {
          product(id: $id) {
            ...product
            ... on DerivativeScriptureProduct {
              produces {
                value {
                  id
                  __typename
                  scriptureReferences {
                    value {
                      start {
                        book
                        chapter
                        verse
                      }
                      end {
                        book
                        chapter
                        verse
                      }
                    }
                    canRead
                    canEdit
                  }
                }
                canRead
                canEdit
              }
              scriptureReferencesOverride {
                value {
                  start {
                    book
                    chapter
                    verse
                  }
                  end {
                    book
                    chapter
                    verse
                  }
                }
                canRead
                canEdit
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );
    const actual: AnyProduct = result.product;
    expect(actual.scriptureReferencesOverride?.value).toBeDefined();
    expect(actual.scriptureReferencesOverride?.value).toEqual(
      expect.arrayContaining(randomScriptureReferences)
    );
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(randomScriptureReferences)
    );
    expect(actual.produces?.value?.scriptureReferences?.value).toEqual(
      expect.arrayContaining(story.scriptureReferences.value)
    );
  });

  it('update product', async () => {
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        mutation updateDirectScriptureProduct($id: ID!) {
          updateDirectScriptureProduct(input: { id: $id }) {
            product {
              ...product
            }
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );

    expect(result.updateDirectScriptureProduct.product.id).toBe(product.id);
  });

  it('update DirectScriptureProduct', async () => {
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      scriptureReferences: ScriptureRange.randomList(),
      plannedCompleteDate: CalendarDate.local(),
    });

    const updateProduct = {
      mediums: [ProductMedium.Video],
      purposes: [ProductPurpose.ChurchMaturity],
      methodology: ProductMethodology.OneStory,
      scriptureReferences: ScriptureRange.randomList(),
      unspecifiedScripture: {
        book: 'Matt',
        totalVerses: 10,
      },
    };

    const result = await app.graphql.query(
      gql`
        mutation updateDirectScriptureProduct(
          $input: UpdateDirectScriptureProduct!
        ) {
          updateDirectScriptureProduct(input: $input) {
            product {
              ...product
              ... on DirectScriptureProduct {
                unspecifiedScripture {
                  value {
                    book
                    totalVerses
                  }
                  canRead
                  canEdit
                }
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        input: {
          id: product.id,
          ...updateProduct,
        },
      }
    );

    const actual: AnyProduct = result.updateDirectScriptureProduct.product;
    expect(actual.mediums.value).toEqual(updateProduct.mediums);
    expect(actual.purposes.value).toEqual(updateProduct.purposes);
    expect(actual.methodology.value).toEqual(updateProduct.methodology);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(updateProduct.scriptureReferences)
    );
    expect(actual?.unspecifiedScripture?.value).toMatchObject({
      book: 'Matthew',
      totalVerses: 10,
    });
  });

  it('update DerivativeScriptureProduct', async () => {
    const product = await createDerivativeProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      plannedCompleteDate: CalendarDate.local(),
    });

    const updateProduces = film.id;

    const result = await app.graphql.query(
      gql`
        mutation updateDerivativeScriptureProduct(
          $input: UpdateDerivativeScriptureProduct!
        ) {
          updateDerivativeScriptureProduct(input: $input) {
            product {
              ...product
              ... on DerivativeScriptureProduct {
                produces {
                  value {
                    id
                    __typename
                    scriptureReferences {
                      value {
                        start {
                          book
                          chapter
                          verse
                        }
                        end {
                          book
                          chapter
                          verse
                        }
                      }
                      canRead
                      canEdit
                    }
                  }
                  canRead
                  canEdit
                }
                scriptureReferencesOverride {
                  value {
                    start {
                      book
                      chapter
                      verse
                    }
                    end {
                      book
                      chapter
                      verse
                    }
                  }
                  canRead
                  canEdit
                }
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        input: {
          id: product.id,
          produces: updateProduces,
        },
      }
    );

    const actual: AnyProduct = result.updateDerivativeScriptureProduct.product;
    expect(actual.produces).toBeDefined();
    expect(actual.produces?.value).toBeDefined();
    expect(actual.produces?.value?.id).toBe(film.id);
    expect(actual.produces?.value?.__typename).toBe(ProducibleType.Film);
    expect(actual.produces?.value?.scriptureReferences).toEqual(
      expect.arrayContaining(film.scriptureReferences.value)
    );
    expect(actual.scriptureReferencesOverride?.value).toBeNull();
  });

  it('update DerivativeScriptureProduct with scriptureReferencesOverride', async () => {
    const product = await createDerivativeProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: ScriptureRange.randomList(),
      plannedCompleteDate: CalendarDate.local(),
    });

    const override = ScriptureRange.randomList();

    const result = await app.graphql.query(
      gql`
        mutation updateDerivativeScriptureProduct(
          $input: UpdateDerivativeScriptureProduct!
        ) {
          updateDerivativeScriptureProduct(input: $input) {
            product {
              ...product
              ... on DerivativeScriptureProduct {
                produces {
                  value {
                    id
                    __typename
                    scriptureReferences {
                      value {
                        start {
                          book
                          chapter
                          verse
                        }
                        end {
                          book
                          chapter
                          verse
                        }
                      }
                      canRead
                      canEdit
                    }
                  }
                  canRead
                  canEdit
                }
                scriptureReferencesOverride {
                  value {
                    start {
                      book
                      chapter
                      verse
                    }
                    end {
                      book
                      chapter
                      verse
                    }
                  }
                  canRead
                  canEdit
                }
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        input: {
          id: product.id,
          scriptureReferencesOverride: override,
        },
      }
    );

    const actual: AnyProduct = result.updateDerivativeScriptureProduct.product;

    expect(actual.scriptureReferencesOverride?.value).toEqual(
      expect.arrayContaining(override)
    );
    expect(actual.scriptureReferences?.value).toEqual(
      expect.arrayContaining(override)
    );
    expect(actual.produces?.value?.scriptureReferences?.value).toEqual(
      expect.arrayContaining(story.scriptureReferences.value)
    );
  });

  it('update DerivativeScriptureProduct with scriptureReferencesOverride which is null', async () => {
    const product = await createDerivativeProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: ScriptureRange.randomList(),
      plannedCompleteDate: CalendarDate.local(),
    });

    const result = await app.graphql.query(
      gql`
        mutation updateDerivativeScriptureProduct(
          $input: UpdateDerivativeScriptureProduct!
        ) {
          updateDerivativeScriptureProduct(input: $input) {
            product {
              ...product
              ... on DerivativeScriptureProduct {
                produces {
                  value {
                    id
                    __typename
                    scriptureReferences {
                      value {
                        start {
                          book
                          chapter
                          verse
                        }
                        end {
                          book
                          chapter
                          verse
                        }
                      }
                      canRead
                      canEdit
                    }
                  }
                  canRead
                  canEdit
                }
                scriptureReferencesOverride {
                  value {
                    start {
                      book
                      chapter
                      verse
                    }
                    end {
                      book
                      chapter
                      verse
                    }
                  }
                  canRead
                  canEdit
                }
              }
            }
          }
        }
        ${fragments.product}
      `,
      {
        input: {
          id: product.id,
          scriptureReferencesOverride: null,
        },
      }
    );

    const actual: AnyProduct = result.updateDerivativeScriptureProduct.product;
    expect(actual.scriptureReferencesOverride?.value).toBeNull();
    expect(actual.produces?.value?.scriptureReferences?.value).toEqual(
      actual.scriptureReferences.value
    );
  });

  it.skip('delete product', async () => {
    const product = await createDirectProduct(app, {
      engagementId: engagement.id,
      plannedCompleteDate: CalendarDate.local(),
    });
    expect(product.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProduct($id: ID!) {
          deleteProduct(id: $id) {
            __typename
          }
        }
      `,
      {
        id: product.id,
      }
    );

    const actual: boolean | undefined = result.deleteProduct;
    expect(actual).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query product($id: ID!) {
            product(id: $id) {
              ...product
            }
          }
          ${fragments.product}
        `,
        {
          id: product.id,
        }
      )
    );
  });

  it('List view of products', async () => {
    // create 2 products
    const numProducts = 2;
    await Promise.all(
      times(numProducts).map(() =>
        createDirectProduct(app, {
          engagementId: engagement.id,
          plannedCompleteDate: CalendarDate.local(),
        })
      )
    );

    const { products } = await app.graphql.query(
      gql`
        query products {
          products {
            items {
              id
            }
            hasMore
            total
          }
        }
      `,
      {}
    );

    expect(products.items.length).toBeGreaterThanOrEqual(numProducts);
  });

  it('List view of DirectScriptureProducts', async () => {
    // create 2 products
    const numProducts = 2;
    await Promise.all(
      times(numProducts).map(() =>
        createDirectProduct(app, {
          engagementId: engagement.id,
          scriptureReferences: ScriptureRange.randomList(),
          plannedCompleteDate: CalendarDate.local(),
        })
      )
    );

    const { products } = await app.graphql.query(
      gql`
        query products {
          products {
            items {
              id
              scriptureReferences {
                value {
                  start {
                    book
                  }
                  end {
                    book
                  }
                }
              }
            }
            hasMore
            total
          }
        }
      `,
      {}
    );

    expect(products.items.length).toBeGreaterThanOrEqual(numProducts);
  });

  it('List view of DerivativeScriptureProducts', async () => {
    // create 2 products
    const numProducts = 2;
    await Promise.all(
      times(numProducts).map(() =>
        createDerivativeProduct(app, {
          engagementId: engagement.id,
          produces: story.id,
          scriptureReferencesOverride: ScriptureRange.randomList(),
          plannedCompleteDate: CalendarDate.local(),
        })
      )
    );

    const { products } = await app.graphql.query(
      gql`
        query products {
          products {
            items {
              id
              ... on DerivativeScriptureProduct {
                produces {
                  value {
                    __typename
                    id
                    scriptureReferences {
                      value {
                        start {
                          book
                        }
                        end {
                          book
                        }
                      }
                    }
                  }
                }
                scriptureReferencesOverride {
                  value {
                    start {
                      book
                    }
                    end {
                      book
                    }
                  }
                }
              }
            }
            hasMore
            total
          }
        }
      `,
      {}
    );

    expect(products.items.length).toBeGreaterThanOrEqual(numProducts);
  });

  it('should return list of products filtered by engagementId', async () => {
    // create 2 products
    const numProducts = 2;
    await Promise.all(
      times(numProducts).map(() =>
        createDirectProduct(app, {
          engagementId: engagement.id,
          plannedCompleteDate: CalendarDate.local(),
        })
      )
    );

    const { engagement: actual } = await app.graphql.query(
      gql`
        query engagement($id: ID!) {
          engagement(id: $id) {
            ... on LanguageEngagement {
              id
              products {
                items {
                  id
                }
              }
            }
          }
        }
      `,
      {
        id: engagement.id,
      }
    );

    expect(actual.products.items.length).toBeGreaterThanOrEqual(numProducts);
  });
});
