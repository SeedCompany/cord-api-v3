import { gql } from 'apollo-server-core';
import { times } from 'lodash';
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
  createFilm,
  createLanguageEngagement,
  createSession,
  createStory,
  createTestApp,
  createUser,
  expectNotFound,
  fragments,
  TestApp,
} from './utility';
import { createProduct } from './utility/create-product';
import { RawLanguageEngagement, RawProduct } from './utility/fragments';

describe('Product e2e', () => {
  let app: TestApp;
  let engagement: RawLanguageEngagement;
  let story: Story;
  let film: Film;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    story = await createStory(app);
    film = await createFilm(app);
    engagement = await createLanguageEngagement(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create & read product by id', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
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

  it('create product with scriptureReferences', async () => {
    const randomScriptureReferences = ScriptureRange.randomList();
    const product = await createProduct(app, {
      engagementId: engagement.id,
      scriptureReferences: randomScriptureReferences,
    });

    expect(product.scriptureReferences.value).toBeDefined();
    expect(product.scriptureReferences.value).toEqual(
      expect.arrayContaining(randomScriptureReferences)
    );
  });

  it('create DerivativeScriptureProduct with produces', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
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
    const product = await createProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: randomScriptureReferences,
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
    const product = await createProduct(app, {
      engagementId: engagement.id,
    });

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($id: ID!) {
          updateProduct(input: { product: { id: $id } }) {
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

    expect(result.updateProduct.product.id).toBe(product.id);
  });

  it('update DirectScriptureProduct', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
      scriptureReferences: ScriptureRange.randomList(),
    });

    const updateProduct = {
      mediums: [ProductMedium.Video],
      purposes: [ProductPurpose.ChurchMaturity],
      methodology: ProductMethodology.OneStory,
      scriptureReferences: ScriptureRange.randomList(),
    };

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($input: UpdateProductInput!) {
          updateProduct(input: $input) {
            product {
              ...product
            }
          }
        }
        ${fragments.product}
      `,
      {
        input: {
          product: {
            id: product.id,
            mediums: updateProduct.mediums,
            purposes: updateProduct.purposes,
            methodology: updateProduct.methodology,
            scriptureReferences: updateProduct.scriptureReferences,
          },
        },
      }
    );

    const actual: AnyProduct = result.updateProduct.product;
    expect(actual.mediums.value).toEqual(updateProduct.mediums);
    expect(actual.purposes.value).toEqual(updateProduct.purposes);
    expect(actual.methodology.value).toEqual(updateProduct.methodology);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(updateProduct.scriptureReferences)
    );
  });

  it('update DerivativeScriptureProduct', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
    });

    const updateProduces = film.id;

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($input: UpdateProductInput!) {
          updateProduct(input: $input) {
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
          product: {
            id: product.id,
            produces: updateProduces,
          },
        },
      }
    );

    const actual: AnyProduct = result.updateProduct.product;
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
    const product = await createProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: ScriptureRange.randomList(),
    });

    const override = ScriptureRange.randomList();

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($input: UpdateProductInput!) {
          updateProduct(input: $input) {
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
          product: {
            id: product.id,
            scriptureReferencesOverride: override,
          },
        },
      }
    );

    const actual: AnyProduct = result.updateProduct.product;

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
    const product = await createProduct(app, {
      engagementId: engagement.id,
      produces: story.id,
      scriptureReferencesOverride: ScriptureRange.randomList(),
    });

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($input: UpdateProductInput!) {
          updateProduct(input: $input) {
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
          product: {
            id: product.id,
            scriptureReferencesOverride: null,
          },
        },
      }
    );

    const actual: AnyProduct = result.updateProduct.product;
    expect(actual.scriptureReferencesOverride?.value).toBeNull();
    expect(actual.produces?.value?.scriptureReferences?.value).toEqual(
      actual.scriptureReferences.value
    );
  });

  it('delete product', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
    });
    expect(product.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProduct($id: ID!) {
          deleteProduct(id: $id)
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
        createProduct(app, {
          engagementId: engagement.id,
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
        createProduct(app, {
          engagementId: engagement.id,
          scriptureReferences: ScriptureRange.randomList(),
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
        createProduct(app, {
          engagementId: engagement.id,
          produces: story.id,
          scriptureReferencesOverride: ScriptureRange.randomList(),
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
        createProduct(app, {
          engagementId: engagement.id,
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
