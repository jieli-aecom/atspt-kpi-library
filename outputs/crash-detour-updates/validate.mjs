import fs from 'node:fs';
import assert from 'node:assert/strict';
import katex from 'katex';
import { kpiPoolConfigSchema, repairConfig } from '../../src/configSchema.ts';
import { readConfigImport } from '../../src/configImport.ts';
import { mergeImportedConfig } from '../../src/configMerge.ts';
const dir = new URL('./', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
const before = read('baseline.json'), after = read('ATSPT-library.import.json');
const changed = [5,72,100], get = n => after.kpis.find(k => k.displayNumber === n);
kpiPoolConfigSchema.parse(after);
assert.equal(after.kpis.length,98);
assert.equal(Math.max(...after.kpis.map(k=>k.displayNumber)),103);
for (const key of Object.keys(before).filter(k=>!['kpis','updatedAt'].includes(k))) assert.deepEqual(after[key],before[key]);
for (const k of before.kpis) if (!changed.includes(k.displayNumber)) assert.deepEqual(after.kpis.find(v=>v.id===k.id),k,k.name);
const imported = readConfigImport(JSON.stringify(after),'ATSPT-library.import.json',()=>{throw Error('Wrong route');});
const repaired = repairConfig(imported);
assert.deepEqual(repaired.warnings,[]);
assert.deepEqual(repaired.config,after);
const merged = mergeImportedConfig(before,repaired.config).config;
for (const n of changed) assert.deepEqual(merged.kpis.find(k=>k.id===get(n).id),get(n));
for (const n of changed) {
  const k=get(n);
  assert(!/VMTGR|624f354c/.test(JSON.stringify(k)));
  assert(k.sources.some(s=>s.kpiId===get(103).id));
  assert(k.prerequisite.kpis.includes(get(103).id));
  for(const s of k.sources){
    if(s.type==='kpi') assert(after.kpis.some(v=>v.id===s.kpiId));
    if(s.type==='dataField') assert(after.dataSources.find(t=>t.id===s.dataSourceId)?.fields.some(f=>f.id===s.fieldId));
    if(s.type==='variable') assert(after.variables.some(v=>v.id===s.variableId));
    if(s.type==='lookup') assert(after.lookups.some(v=>v.id===s.lookupId));
  }
  for(const g of k.description.formulas) for(const i of g.items){assert.equal(i.formula,i.leftExpression+' = '+i.rightExpression);katex.renderToString(i.formula,{throwOnError:true,strict:'ignore'});}
  for(const s of Object.values(k.spatialScales))if(s.formula)katex.renderToString(s.formula,{throwOnError:true,strict:'ignore'});
}
function visit(id,path=[]){assert(!path.includes(id),'Dependency cycle');for(const s of after.kpis.find(k=>k.id===id).sources.filter(s=>s.type==='kpi'))visit(s.kpiId,[...path,id]);}
changed.forEach(n=>visit(get(n).id));
const growth5=get(5).description.formulas[0].items[0],growth72=get(72).description.formulas[0].items[0];
assert.deepEqual(growth5,growth72);
assert.equal(growth5.rightExpression,'\\frac{\\sum_{Period}Volume_{Year,Period,Link}}{\\sum_{Period}BaseVolume_{Period,Link}}');
assert(get(5).description.formulas[0].items[1].rightExpression.endsWith('\\times VolumeGrowthFactor_{Year,Link}'));
assert(get(5).description.formulas[0].items[2].rightExpression.includes('\\sum_{idOf(Link)\\in\\{LinkIDs\\}_{Project}}'));
assert.equal(get(72).description.formulas[1].items[0].rightExpression,'\\sum_{Link\\in Zone}NBFatalitiesInjuries_{Year,Link}');
assert(get(72).description.formulas[1].items[1].rightExpression.startsWith('NBFatalitiesInjuries_{Year,Zone}-'));
assert(get(72).spatialScales.region.isBasicUnit);
const detour=get(100).description.formulas[1].items;
assert.equal(detour[0].rightExpression,'365\\times\\sum_{idOf(Link)\\in\\{LinkIDs\\}_{Project}}\\sum_{Period}Volume_{Year,Period,Link}');
assert.equal(detour[1].rightExpression,'GrossVolume_{Year,Project}-\\Delta Volume_{Year,Project}');
assert.equal(detour[2].rightExpression,'Volume_{Year,Project}\\times\\frac{SavedMinutes_{Project}}{60}');
for(const scale of ['corridor','subRegion','region'])assert(get(100).spatialScales[scale].formula.includes('\\Delta DetourVehHours_{Year,Project}'));

// Independent examples for the documented aggregation, including unequal period growth.
const sum=a=>a.reduce((s,v)=>s+v,0);
const factor=(base,year)=>{assert(base.length===year.length);assert(base.every(v=>v>0)&&year.every(v=>v>0),'Invalid anchors');return sum(year)/sum(base);};
assert.equal(factor([100,300,200,400],[100,300,200,400]),1);
assert.equal(factor([100,300],[200,300]),1.25); // Not the unweighted mean 1.5.
const base=[100,300,200,400], annualRate=0.025,years=10;
assert(Math.abs(factor(base,base.map(v=>v*(1+annualRate)**years))-(1+annualRate)**years)<1e-12);
assert.equal(factor([100,300],[50,150]),0.5);
assert.throws(()=>factor([0,0],[10,20]));
// Scale 10 crashes on one link by 1.25 and 20 on another by 0.5, then sum.
assert.equal(10*factor([100,300],[200,300])+20*factor([100,300],[50,150]),22.5);
// Zone baseline includes a link outside project areas: 22.5 + 7.5 - 4 benefit.
assert.equal(sum([12.5,10,7.5])-4,26);
// Joined project volumes: deduplicate link IDs, sum all periods, annualize once,
// subtract 365 already-annual removed trips once, then save six minutes per traversal.
const links=new Map([['A',[100,200,300,400]],['B',[50,50,50,50]]]);
const daily=sum([...new Set(['A','B','A'])].map(id=>sum(links.get(id))));
assert.equal(daily,1200);
assert.equal((daily*365-365)*6/60,43763.5);
assert.equal((daily*365)*0/60,0);
const result={passed:true,changedKpis:changed,kpiCount:98,newKpis:0,checks:['full schema','import and repair without warnings','merge fidelity','earlier changes retained','valid sources and acyclic dependencies','LaTeX rendering','same cumulative growth in both crash KPIs','weighted period growth','base-year identity and uniform-rate equivalence','declining traffic','invalid zero anchors','link-to-zone baseline aggregation','distinct link-project joins','single annualization and annual bike/ped deduction','project spatial totals']};
fs.writeFileSync(new URL('validation-results.json',dir),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
