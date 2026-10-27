import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlayViewUrl} from '../src/shared/overlay-url';
test('each OBS view replaces the existing view instead of appending a second query',()=>{
 for(const view of ['comments','gifts','pinned','queue','poll','setlist']){
  const result=overlayViewUrl('http://127.0.0.1:11280/overlay?view=comments',view);const url=new URL(result);
  assert.deepEqual(url.searchParams.getAll('view'),[view]);assert.equal(url.pathname,'/overlay');assert.equal(result.includes('?view=comments?'),false);
 }
 assert.equal(overlayViewUrl('http://127.0.0.1:11280/overlay?view=comments'),'http://127.0.0.1:11280/overlay');assert.equal(overlayViewUrl('', 'poll'),'');
});

