import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error build helper is a plain Node.js module
import {packagingEnv} from '../scripts/package-ci.mjs';

test('missing signing secrets are omitted instead of becoming an empty certificate path',()=>{
  const source={CSC_LINK:'',CSC_KEY_PASSWORD:'',APPLE_ID:' ',PATH:'keep'};
  const env=packagingEnv(source);
  assert.equal('CSC_LINK' in env,false);assert.equal('APPLE_ID' in env,false);
  assert.equal(env.CSC_IDENTITY_AUTO_DISCOVERY,'false');assert.equal(env.PATH,'keep');
  assert.equal(source.CSC_LINK,'');
});
test('configured signing credentials remain available to electron-builder',()=>{
  const env=packagingEnv({CSC_LINK:'certificate.p12',CSC_KEY_PASSWORD:'password',APPLE_ID:'account'});
  assert.equal(env.CSC_LINK,'certificate.p12');assert.equal(env.CSC_KEY_PASSWORD,'password');
  assert.equal(env.APPLE_ID,'account');assert.equal(env.CSC_IDENTITY_AUTO_DISCOVERY,undefined);
});
