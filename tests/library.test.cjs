const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
class Element {
 constructor(){this.children=[];this.value='';this.hidden=false;this.textContent='';this.attributes={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,fn){this[k]=fn;}
 focus(){}
}
function fixture(saved){
 const elements={};let change;
 const chrome={runtime:{sendMessage:async()=>({ok:true})},storage:{local:{get:async()=>saved,set:async values=>Object.assign(saved,values)},onChanged:{addListener:fn=>change=fn}}};
 const context=vm.createContext({console,URL,chrome,navigator:{clipboard:{writeText:async()=>{}}},document:{getElementById:id=>elements[id]||=(new Element()),createElement:()=>new Element(),documentElement:{style:{setProperty(){}}}}});
 vm.runInContext(source('shared.js'),context);vm.runInContext("const DOCS_STORAGE_KEY='promptLauncher.documents';",context);
 vm.runInContext(source('library.js'),context);
 return {elements,context,change:updates=>change(updates,'local')};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('reader navigates full prompts/documents/CENDOJ safely and updates live',async()=>{
 const full='Documento completo\n'.repeat(1000);
 const f=fixture({'promptLauncher.prompts':[{name:'Prompt',text:'Texto del prompt',includes:[]}],'promptLauncher.documents':[{name:'caso.txt',text:full}],'cendoj.session':{rows:[{titulo:'Sentencia',roj:'STS 1/2026',resumen:'Resumen disponible',url_documento:'javascript:alert(1)'}]}});
 await flush();
 const sections=f.elements.libraryList.children;
 assert.equal(sections.length,3);
 sections[1].children[1].children[0].children[0].onclick();
 assert.equal(f.elements.readerText.textContent,full);
 assert.equal(f.elements.readerArticle.hidden,false);
 sections[2].children[1].children[0].children[0].onclick();
 assert.equal(f.elements.readerText.textContent,'Resumen disponible');
 assert.equal(f.elements.readerSource.hidden,true);
 assert.match(f.elements.readerNotice.textContent,/no la sentencia íntegra/);
 f.change({'cendoj.texts':{newValue:{'STS 1/2026':{text:'Sentencia íntegra'}}}});
 assert.equal(f.elements.readerText.textContent,'Sentencia íntegra');
 f.elements.librarySearch.value='caso';f.elements.librarySearch.input();
 assert.equal(f.elements.libraryList.children[0].children[1].children.length,0);
 assert.equal(f.elements.libraryList.children[1].children[1].children.length,1);
});
test('defaults preserve uploaded prompts, install once, and stay deleted',async()=>{
 const saved={'promptLauncher.prompts':[{name:'Propio',text:'Original'}]};
 const context=vm.createContext({chrome:{storage:{local:{get:async()=>saved,set:async values=>Object.assign(saved,values)}}}});
 vm.runInContext(source('shared.js'),context);
 await vm.runInContext('installDefaultCasePrompts()',context);
 assert.equal(saved['promptLauncher.prompts'].length,3);
 assert.equal(saved['promptLauncher.prompts'][0].name,'Propio');
 await vm.runInContext('installDefaultCasePrompts()',context);
 assert.equal(saved['promptLauncher.prompts'].length,3);
 saved['promptLauncher.prompts']=[];
 await vm.runInContext('installDefaultCasePrompts()',context);
 assert.equal(saved['promptLauncher.prompts'].length,0);
});
