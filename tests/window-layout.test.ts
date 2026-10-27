import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWindow } from '../src/shared/window-layout';
test('window remains on a negative-coordinate secondary monitor',()=>{
 const placement=fitWindow({x:-1800,y:50,width:1200,height:800,maximized:true},[{x:0,y:0,width:1920,height:1080},{x:-1920,y:0,width:1920,height:1080}]);assert.deepEqual(placement.bounds,{x:-1800,y:50,width:1200,height:800});assert.equal(placement.maximized,true);
});
test('disconnected monitor positions and oversized windows fit the remaining display',()=>{
 const placement=fitWindow({x:5000,y:100,width:3000,height:2000},[{x:0,y:0,width:1366,height:768}]);assert.deepEqual(placement.bounds,{x:0,y:0,width:1366,height:768});
});
test('small screens override minimum size without positioning off screen',()=>{
 const placement=fitWindow({},[{x:0,y:0,width:800,height:600}]);assert.equal(placement.minWidth,800);assert.equal(placement.minHeight,600);assert.equal(placement.bounds.width,800);assert.equal(placement.bounds.height,600);
});
