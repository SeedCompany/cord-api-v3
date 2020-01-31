import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import CordApiV3 = require('../lib/cord-api-v3-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CordApiV3.CordApiV3Stack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
