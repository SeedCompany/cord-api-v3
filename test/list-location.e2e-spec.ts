import { gql } from 'apollo-server-core';
import {
    createSession,
    createTestApp,
    TestApp,
  } from './utility';
  import { fragments } from './utility/fragments';
import { LocationListInput } from '../src/components/location/dto';
import { Order } from '../src/common/order.enum';



describe('Location e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    
  });

  afterAll(async () => {
    await app.close();
  });

  

  const listInput: LocationListInput = {

    count : 25,
    page: 1,
    sort: "name",
    filter : 
      { 
          name:"name",
          userIds: ["9gf-Ogtbw"],
          types: ['country'
        ]
      },
      order : Order.ASC
    
  };

  // LIST Location
  it('List view of location', async () => {
  
    const location  = await app.graphql.query(
    gql`
    query locationList($input:LocationListInput!)
    {
      locations(input:$input)
      {
       ...locationListOutput
      }
      
    }
    ${fragments.locationListOutput}
    `,
    {
        input: listInput
    }
    
    );

    const actual = location.locations.hasMore;
    expect(actual).toBeFalsy();
    expect(location.locations.total).toEqual(0);
  });
});
