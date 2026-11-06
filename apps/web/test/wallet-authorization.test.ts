import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { users, wallets, walletMembers, syncMutations, accounts, creditCards, creditCardInvoices, userCredentials } from '@packages/shared/db/schema';
const require = createRequire(new URL('../package.json', import.meta.url));
test("replayed writes cannot disclose another wallet or regain revoked access", async () => {
const pg = new PGlite();
const dir = path.resolve(import.meta.dirname, '../../../packages/shared/drizzle');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.join(dir,f),'utf8'));
const db = drizzle(pg);
let verificationCount=0; let release: (() => void) | undefined;
let gate: Promise<void> | undefined;
const cache = new Map();
function load(file: string): any {
 file=path.resolve(import.meta.dirname, '..', file);if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=(name: string):any=>{
  if(name==='server-only')return {};
  if(name==='@/lib/server/db')return {getDb:()=>db};
    if(name==='@/lib/server/auth/session')return {startSession:async()=>{throw Error('unexpected sign-in')}};
  if(name==='@/lib/server/auth/password')return {verifyPassword:async()=>{verificationCount++;if(verificationCount===10)release?.();await gate;return {ok:false}},verifyDummyPassword:async()=>{}};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
  return require(name);
 };
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(localRequire,mod,mod.exports);
 return mod.exports;
}
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try {
 await db.insert(users).values([{id:id(1),name:'Synthetic actor',email:'actor@example.invalid'},{id:id(2),name:'Synthetic victim',email:'victim@example.invalid'}]);
 await db.insert(wallets).values([{id:id(3),name:'Actor wallet',currencyCode:'EUR'},{id:id(4),name:'Other wallet',currencyCode:'EUR'}]);
 await db.insert(walletMembers).values([{id:id(5),walletId:id(3),userId:id(1),role:'OWNER'},{id:id(6),walletId:id(4),userId:id(2),role:'OWNER'}]);
 await db.insert(syncMutations).values({mutationId:id(7),walletId:id(3),userId:id(1),entity:'wallets',entityId:id(3),op:'CREATE',changes:{},status:'ACCEPTED'});
 const members=load('lib/server/members.ts');const actor={userId:id(1),deviceId:null};
 assert.equal((await members.listMembers(id(1),id(4))).ok,false);
 for(const [name,args] of [['changeMemberRole',[actor,id(4),id(99),{mutationId:id(7),role:'VIEWER'}]],['removeMember',[actor,id(4),id(99),{mutationId:id(7)}]],['revokeInvite',[actor,id(4),id(99),{mutationId:id(7)}]]] as const){
  const result=await members[name](...args);assert.deepEqual(result,{ok:false,error:'notFound',retryAfterSeconds:undefined},name);
 }
 await db.insert(accounts).values({id:id(10),walletId:id(4),name:'Synthetic payment account',type:'CASH'});
 await db.insert(creditCards).values({id:id(11),walletId:id(4),paymentAccountId:id(10),name:'Synthetic card',brand:'VISA',closingDay:15,dueDay:5});
 await db.insert(creditCardInvoices).values({id:id(12),walletId:id(4),creditCardId:id(11),referenceYear:2026,referenceMonth:11,openingDate:'2026-10-16',closingDate:'2026-11-15',dueDate:'2026-12-05'});
 const cardModule=load('lib/server/cards.ts');const invoice=await cardModule.reopenInvoice(actor,id(4),id(11),id(12),{mutationId:id(7)});assert.deepEqual(invoice,{ok:false,error:'notFound',retryAfterSeconds:undefined});
 const walletModule=load('lib/server/wallets.ts');
 await db.insert(walletMembers).values({id:id(8),walletId:id(4),userId:id(1),role:'VIEWER',removedAt:new Date()});
 const replay=await walletModule.updateWallet(actor,id(4),{mutationId:id(7),name:'unused'});assert.deepEqual(replay,{ok:false,error:'notFound',retryAfterSeconds:undefined});
 const ownReplay=await members.removeMember(actor,id(3),id(99),{mutationId:id(7)});
 assert.equal(ownReplay.ok,true);
 // A fresh mutation must also fail, and none of these rejected calls may write.
 const denied=await members.changeMemberRole(actor,id(4),id(6),{mutationId:id(90),role:'VIEWER'});
 assert.deepEqual(denied,{ok:false,error:'notFound',retryAfterSeconds:undefined});
 const unchanged=await pg.query<{role:string;removed_at:string|null}>('select role, removed_at from wallet_members where id=$1',[id(6)]);
 assert.equal(unchanged.rows[0].role,'OWNER');assert.equal(unchanged.rows[0].removed_at,null);
 const invoiceState=await pg.query<{status:string}>('select status from credit_card_invoices where id=$1',[id(12)]);
 assert.equal(invoiceState.rows[0].status,'OPEN');
 const entryModule=load('lib/server/entries.ts');
 for(const name of ['listEntries','listEntryRows','getEntrySummary']){
   assert.deepEqual(await entryModule[name](id(1),id(4),{from:'2026-01-01',to:'2026-12-31'}),{ok:false,error:'notFound',retryAfterSeconds:undefined});
 }
 // Exercise the real login counter with synchronized bad-password results.
 await db.insert(userCredentials).values({userId:id(2),passwordHash:'synthetic-unused',pepperVersion:1});
 gate=new Promise<void>(r=>release=r);
 const auth=load('lib/server/auth/service.ts');
 await Promise.all(Array.from({length:10},()=>auth.signIn({email:'victim@example.invalid',password:'synthetic-wrong'},{ip:'192.0.2.1',userAgent:null})));
 const failed=await pg.query<{failed_login_count:number;locked_until:string|null}>('select failed_login_count, locked_until from users where id=$1',[id(2)]);
 assert.equal(failed.rows[0].failed_login_count,10);
 assert.notEqual(failed.rows[0].locked_until,null);
} finally {await pg.close();}

});
