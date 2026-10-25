const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
function setup(initial={}) {
 const saved=structuredClone(initial), listeners=[];
 const local={get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>saved[key]!==undefined).map(key=>[key,structuredClone(saved[key])])),set:async values=>{for(const [key,value]of Object.entries(values))saved[key]=structuredClone(value);},remove:async keys=>{for(const key of keys)delete saved[key];}};
 const context=vm.createContext({console,TextEncoder,URL,crypto:require('node:crypto').webcrypto,chrome:{storage:{local},runtime:{id:'extension',getURL:path=>'chrome-extension://extension/'+path,getManifest:()=>({version:'0.6.0'}),onMessage:{addListener:fn=>listeners.push(fn)}}},clearTimeout(){},cendojTimer:null,cendojEnqueue:task=>task()});
 vm.runInContext(source('cases.js'),context);
 vm.runInContext("const cendojRead=async()=>{const caseId=await activeCaseId();return {...(await readCaseValue('cendoj.session',caseId)||{rows:[],running:false}),caseId}};const cendojSave=state=>writeCaseValues(state.caseId,{'cendoj.session':state});",context);
 vm.runInContext(source('cases-backup.js'),context);
 vm.runInContext(source('cases-background.js'),context);
 const call=message=>new Promise(resolve=>listeners[0](message,{id:'extension',url:'chrome-extension://extension/sidepanel.html'},resolve));
 return {saved,run:code=>vm.runInContext(code,context),call};
}
test('migration preserves documents, CENDOJ and attached text; prompts stay global',async()=>{
 const f=setup({'promptLauncher.documents':[{name:'A',text:'private'}],'cendoj.session':{rows:[{roj:'R'}]},'cendoj.texts':{R:{text:'full'}},'promptLauncher.prompts':[{name:'common'}]});
 await f.run('initializeCases()');
 assert.equal(f.saved['case.initial.promptLauncher.documents'][0].text,'private');
 assert.equal(f.saved['case.initial.cendoj.session'].rows[0].roj,'R');
 assert.equal(f.saved['case.initial.cendoj.texts'].R.text,'full');
 assert.equal(f.saved['promptLauncher.prompts'][0].name,'common');
 assert.equal(f.saved['promptLauncher.documents'],undefined);
 await f.run('initializeCases()');assert.equal(f.saved['caseManager.v1'].cases.length,1);
});
test('case switching isolates data, stops search, pins writes, renames and deletes safely',async()=>{
 const f=setup({'promptLauncher.documents':[{name:'A'}],'cendoj.session':{rows:[{roj:'A'}],running:true}});
 const initial=await f.call({type:'cases:init'});assert.ok(initial.ok);
 const created=await f.call({type:'cases:create',name:'Segundo'});assert.ok(created.ok);
 const id=created.manager.activeId;
 assert.notEqual(id,'initial');assert.equal(f.saved['case.initial.cendoj.session'].running,false);
 await f.call({type:'cases:write',caseId:id,values:{'promptLauncher.documents':[{name:'B'}],'cendoj.session':{rows:[{roj:'B'}]}}});
 await f.call({type:'cases:switch',caseId:'initial'});
 // An upload started in B must stay in B even after switching to A.
 await f.call({type:'cases:write',caseId:id,values:{'promptLauncher.documents':[{name:'B upload'}]}});
 assert.equal(f.saved['case.initial.promptLauncher.documents'][0].name,'A');
 assert.equal(f.saved['case.'+id+'.promptLauncher.documents'][0].name,'B upload');
 assert.equal(f.saved['case.initial.cendoj.session'].rows[0].roj,'A');
 assert.equal(f.saved['case.'+id+'.cendoj.session'].rows[0].roj,'B');
 await f.call({type:'cases:rename',caseId:id,name:'Renombrado'});assert.equal(f.saved['caseManager.v1'].cases[1].name,'Renombrado');
 assert.equal((await f.call({type:'cases:delete',caseId:id})).ok,true);
 assert.equal(f.saved['case.'+id+'.promptLauncher.documents'],undefined);
 assert.equal((await f.call({type:'cases:write',caseId:id,values:{'cendoj.texts':{}}})).ok,false);
 assert.equal((await f.call({type:'cases:delete',caseId:'initial'})).ok,false);
});
test('uploads append without replacing earlier files or duplicating names',async()=>{
 const f=setup();await f.call({type:'cases:init'});
 await f.call({type:'cases:addDocuments',caseId:'initial',documents:[{name:'A',text:'first'}]});
 await f.call({type:'cases:addDocuments',caseId:'initial',documents:[{name:'A',text:'duplicate'},{name:'B',text:'second'}]});
 assert.equal(f.saved['case.initial.promptLauncher.documents'].length,2);
 assert.equal(f.saved['case.initial.promptLauncher.documents'][0].text,'first');
});
test('backup restores into a new case with documents, judgment text and source metadata',async()=>{
 const f=setup({'promptLauncher.documents':[{name:'case.txt',text:'Full document\nsecond line',ext:'txt',size:40}],'cendoj.session':{rows:[{roj:'STS 1',titulo:'Resolution',resumen:'summary',url_documento:'https://www.poderjudicial.es/search/AN/document'}],query:'query',limit:25,running:true,tabId:123,started:999},'cendoj.texts':{'STS 1':{text:'Full judgment',name:'judgment.pdf'}},'promptLauncher.prompts':[{name:'Shared'}]});
 await f.call({type:'cases:init'});
 const result=await f.call({type:'cases:backup',caseId:'initial'});assert.ok(result.ok);
 const backup=JSON.parse(JSON.stringify(result.backup));
 assert.equal(backup.version,1);assert.equal(backup.case.cendoj.rows[0].roj,'STS 1');
 assert.equal(backup.case.cendoj.tabId,undefined);assert.equal(backup.case.cendoj.running,undefined);
 const restored=await f.call({type:'cases:restore',backup});assert.ok(restored.ok);
 const id=restored.manager.activeId;
 assert.notEqual(id,'initial');assert.equal(restored.manager.cases.length,2);
 assert.equal(restored.manager.cases[1].name,'Expediente inicial (restaurado)');
 assert.deepEqual(f.saved['case.'+id+'.promptLauncher.documents'],backup.case.documents);
 assert.equal(f.saved['case.'+id+'.cendoj.texts']['STS 1'].text,'Full judgment');
 assert.equal(f.saved['case.'+id+'.cendoj.session'].running,false);
 assert.equal(f.saved['case.'+id+'.cendoj.session'].tabId,undefined);
 assert.equal(f.saved['case.initial.cendoj.session'].running,false);
 assert.equal(f.saved['case.initial.promptLauncher.documents'][0].name,'case.txt');
 assert.equal(f.saved['promptLauncher.prompts'][0].name,'Shared');
 const second=await f.call({type:'cases:restore',backup});assert.ok(second.ok);
 assert.equal(second.manager.cases[2].name,'Expediente inicial (restaurado 2)');
});
test('restore rejects malformed, unsupported, oversized and unsafe backups before writes',async()=>{
 const f=setup();await f.call({type:'cases:init'});
 const valid=(await f.call({type:'cases:backup',caseId:'initial'})).backup;
 const before=structuredClone(f.saved);
 const invalid=[{}, {...valid,version:99}, {...valid,case:{...valid.case,documents:[{name:'bad',text:42}]}}, {...valid,case:{...valid.case,cendoj:{...valid.case.cendoj,rows:[{url_documento:'javascript:alert(1)'}]}}}, {...valid,case:{...valid.case,documents:[{name:'big',text:'x'.repeat(8*1024*1024)}]}}];
 for(const backup of invalid){const result=await f.call({type:'cases:restore',backup});assert.equal(result.ok,false);assert.deepEqual(f.saved,before);}
});
test('a storage failure during restore leaves no partial case or overwritten data',async()=>{
 const f=setup();await f.call({type:'cases:init'});
 const backup=(await f.call({type:'cases:backup',caseId:'initial'})).backup;
 const before=structuredClone(f.saved);
 f.run("chrome.storage.local.set=async()=>{throw Error('QUOTA_BYTES quota exceeded')}");
 const result=await f.call({type:'cases:restore',backup});assert.equal(result.ok,false);
 assert.match(result.error,/quota/);assert.deepEqual(f.saved,before);
});
