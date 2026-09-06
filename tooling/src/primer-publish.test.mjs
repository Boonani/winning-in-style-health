import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPrimerPublisher} from './primer-publish.mjs';

test('publisher queues exactly one fixed service without shell input',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cube-publish-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const calls=[];let active='inactive';
 const publisher=createPrimerPublisher({stateRoot:dir,service:async args=>{calls.push(args);if(args[0]==='start'){active='activating';return '';}return active;}});
 assert.equal((await publisher.status()).state,'idle');
 const [a,b]=await Promise.allSettled([publisher.start(),publisher.start()]);
 assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
 assert.equal([a,b].find(x=>x.status==='rejected').reason.status,409);
 assert.equal((await publisher.status()).state,'running');
 assert.deepEqual(calls.find(args=>args[0]==='start'),['start','--no-block','cube-primer-publish.service']);
});

test('interrupted publication reports a recoverable failure',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cube-publish-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'publish.json'),JSON.stringify({state:'running',phase:'Pushing'}));
 const publisher=createPrimerPublisher({stateRoot:dir,service:async()=> 'inactive'});
 assert.equal((await publisher.status()).state,'failed');
 assert.match((await publisher.status()).phase,/draft is intact/);
});

test('missing systemd service cannot claim successful publication',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cube-publish-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const publisher=createPrimerPublisher({stateRoot:dir,service:async()=>{throw new Error('not available');}});
 assert.equal((await publisher.status()).state,'unavailable');
 await assert.rejects(publisher.start(),error=>error.status===503);
});
