import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutSchema,overlayPreset } from '../src/shared/overlay-layout';
import { studioSchema } from '../src/shared/studio';
test('old saved overlay settings migrate without losing preferences',()=>{const studio=studioSchema.parse({overlay:{fontSize:36,maxComments:12,lifetime:60,showPlatform:false}});assert.equal(studio.overlay.fontSize,36);assert.equal(studio.overlay.showPlatform,false);assert.equal(studio.overlay.layout.widgets.comments.limit,5);assert.equal(studio.overlay.layout.hideGifts,true);});
test('presets stay within canvas and do not share mutable state',()=>{for(const key of ['game','chat','song'])assert.ok(layoutSchema.safeParse(overlayPreset(key)).success);const song=overlayPreset('song');assert.equal(song.widgets.setlist.enabled,true);assert.equal(song.widgets.queue.enabled,false);song.widgets.comments.x=0;assert.equal(overlayPreset('game').widgets.comments.x,68);assert.equal(layoutSchema.safeParse({...song,widgets:{...song.widgets,comments:{...song.widgets.comments,x:99}}}).success,false);});
