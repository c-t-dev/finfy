import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { users, wallets, walletMembers, syncMutations, accounts, creditCards, creditCardInvoices, userCredentials, categories, transactions } from '@packages/shared/db/schema';
const require = createRequire(new URL('../package.json', import.meta.url));
test("whole-purchase edits redistribute, reschedule and protect paid invoices", async () => {
const pg = new PGlite();
const dir = path.resolve(import.meta.dirname, '../../../packages/shared/drizzle');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.join(dir,f),'utf8'));
const db = drizzle(pg);
// Production uses postgres-js arrays; adapt PGlite raw results without mocking commands.
const transaction = db.transaction.bind(db);
db.transaction = ((callback: any, config: any) => transaction(async (tx: any) => {
 const execute = tx.execute.bind(tx);
 tx.execute = async (...args: any[]) => (await execute(...args)).rows;
 return callback(tx);
}, config)) as typeof db.transaction;
const cache = new Map();
function load(file: string): any {
 file=path.resolve(import.meta.dirname, '..', file);if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=(name: string):any=>{
  if(name==='server-only')return {};
  if(name==='@/lib/server/db')return {getDb:()=>db};


  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
  return require(name);
 };
 vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(localRequire,mod,mod.exports);
 return mod.exports;
}
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

try {
 await db.insert(users).values({id:id(1),name:'Synthetic actor',email:'edit@example.invalid'});
 await db.insert(wallets).values({id:id(3),name:'Synthetic wallet',currencyCode:'EUR'});
 await db.insert(walletMembers).values({id:id(5),walletId:id(3),userId:id(1),role:'OWNER'});
 await db.insert(accounts).values({id:id(10),walletId:id(3),name:'Synthetic account',type:'CASH'});
 await db.insert(creditCards).values({id:id(11),walletId:id(3),paymentAccountId:id(10),name:'Synthetic card',brand:'VISA',closingDay:15,dueDay:5});
 const category = (await db.select().from(categories)).find((row:any)=>row.kind==='EXPENSE')!;
 const cards=load('lib/server/cards.ts'); const actor={userId:id(1),deviceId:null};
 const created=await cards.createPurchase(actor,id(3),id(11),{id:id(20),mutationId:id(21),categoryId:category.id,description:'Synthetic purchase',amountMinor:10000,transactionDate:'2026-01-10',installments:3,notes:null,tagIds:[]});
 assert.equal(created.ok,true,JSON.stringify(created));
 const read=()=>cards.getPurchase(id(1),id(3),id(11),id(20));
 let current=await read(); assert.equal(current.ok,true,JSON.stringify(current));
 const versions=()=>current.value.purchases.map((row:any)=>({id:row.id,version:row.version}));
 const stale=versions();
 const edit=await cards.updatePurchase(actor,id(3),id(11),current.value.purchases[1].id,{mutationId:id(22),baseVersions:versions(),amountMinor:12001,transactionDate:'2026-01-31'});
 assert.equal(edit.ok,true,JSON.stringify(edit));
 current=await read();
 assert.deepEqual(current.value.purchases.map((row:any)=>row.amountMinor),[4001,4000,4000]);
 assert.deepEqual(current.value.purchases.map((row:any)=>row.transactionDate),['2026-01-31','2026-02-28','2026-03-31']);
 assert.deepEqual(current.value.purchases.map((row:any)=>row.id),created.value.map((row:any)=>row.id));
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(23),baseVersions:stale,amountMinor:13000})).error,'versionConflict');
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(24),baseVersions:versions(),amountMinor:2})).error,'invalidInput');
 const invoiceIds=current.value.purchases.map((row:any)=>row.invoiceId);
 await pg.query('update credit_cards set closing_day=31 where id=$1',[id(11)]);
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(25),baseVersions:versions(),amountMinor:15000})).ok,true);
 current=await read(); assert.deepEqual(current.value.purchases.map((row:any)=>row.invoiceId),invoiceIds);
 const replay=await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(25),baseVersions:stale,amountMinor:15000});assert.equal(replay.ok,true);

 const duplicate=versions(); duplicate[1]=duplicate[0];
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(28),baseVersions:duplicate,amountMinor:18000})).error,'versionConflict');
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(29),baseVersions:versions(),transactionDate:'2026-04-30'})).ok,true);
 current=await read();
 assert.deepEqual(current.value.purchases.map((row:any)=>row.amountMinor),[5000,5000,5000]);
 assert.deepEqual(current.value.purchases.map((row:any)=>row.transactionDate),['2026-04-30','2026-05-30','2026-06-30']);
 const single=await cards.createPurchase(actor,id(3),id(11),{id:id(30),mutationId:id(31),categoryId:category.id,description:'Synthetic single',amountMinor:900,transactionDate:'2026-09-10',installments:1,notes:null,tagIds:[]});
 assert.equal(single.ok,true);
 await pg.query("update credit_card_invoices set status='PAID' where id=$1",[single.value[0].invoiceId]);
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(32),baseVersions:versions(),transactionDate:'2026-09-10'})).error,'invoicePaid');
 await pg.query("update credit_card_invoices set status='OPEN' where id=$1",[single.value[0].invoiceId]);
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(30),{mutationId:id(33),baseVersions:[{id:id(30),version:single.value[0].version}],amountMinor:1500,transactionDate:'2026-10-10'})).ok,true);
 assert.equal((await cards.getPurchase(id(1),id(3),id(11),id(30))).value.purchases[0].amountMinor,1500);
 await pg.query("update credit_card_invoices set status='PAID' where id=$1",[current.value.purchases[0].invoiceId]);
 const before=await pg.query('select id,amount_minor,transaction_date,version from transactions order by id');
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(26),baseVersions:versions(),transactionDate:'2026-06-01'})).error,'invoicePaid');
 assert.deepEqual((await pg.query('select id,amount_minor,transaction_date,version from transactions order by id')).rows,before.rows);
 assert.equal((await cards.updatePurchase(actor,id(3),id(11),id(20),{mutationId:id(27),description:'Updated synthetic description'})).ok,true);
 assert.equal((await cards.getPurchase(id(1),id(99),id(11),id(20))).ok,false);
} finally {await pg.close();}

});
