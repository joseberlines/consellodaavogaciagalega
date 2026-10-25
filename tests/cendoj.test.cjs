const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const listener = { addListener() {} };
const context = vm.createContext({chrome:{storage:{local:{get:async()=>({})}},tabs:{onUpdated:listener},runtime:{onMessage:listener}},console,setTimeout,clearTimeout,URL,activeCaseId:async()=>'initial',readCaseValue:async()=>undefined,writeCaseValues:async()=>{}});
vm.runInContext(fs.readFileSync(__dirname+'/../cendoj-background.js','utf8'),context);
const run = code => vm.runInContext(code,context);
test('deduplication checks all identifiers and enforces limit',()=>{
 assert.equal(run("cendojMerge([{ecli:'A',roj:'R',posicion:1}],[{ecli:'B',roj:'R'},{ecli:'C'},{ecli:'D'}],2).length"),2);
 assert.equal(run("cendojMerge([],[{ecli:'A'},{ecli:'A'}],50).length"),1);
});
test('CSV uses BOM and neutralizes formulas',()=>{
 const csv=run("cendojCsv([{titulo:'=SUM(1)',resumen:'quote \" and newline\\n'}])");
 assert.ok(csv.startsWith('\ufeffposicion;'));
 assert.ok(csv.includes("'=SUM(1)"));
 assert.ok(csv.includes('quote "" and newline\n'));
});
test('only CENDOJ HTTPS search pages are accepted',()=>{
 assert.equal(run("cendojValidUrl('https://www.poderjudicial.es/search/indexAN.jsp')"),true);
 for(const url of ['http://www.poderjudicial.es/search/','https://www.poderjudicial.es.evil.test/search/','https://example.com/search/']) assert.equal(run('cendojValidUrl('+JSON.stringify(url)+')'),false);
});
