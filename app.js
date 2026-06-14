const D=window.CHEM_DATA;const $=s=>document.querySelector(s);
// Identity layer v0.13:
// - aliases are case-insensitive
// - capitalization / punctuation / spacing do not split profiles
// - first+middle+last variants bucket together by first+last, then school/section guards decide whether to merge or split
// - nickname/alternate-name rows are only merged through explicit aliases or source/location evidence
const RAW_NAME_ALIASES={
  "Lishan Prado":"Lishan Clement Prado",
  "Jeffery Yang":"Jeffrey Yang",
  "Jeffrye Yang":"Jeffrey Yang",
  "Jeffrye Yang":"Jeffrey Yang",
  "Wililam Wang":"William Wang",
  "Anant Asthana":"Anantshri Asthana",
  "Anantshiri Ashtana":"Anantshri Asthana",
  "Minguen Duan":"Mingwen Duan",
  "Junuri Jonathan Hai":"Jonathan Hai",
  "Junrui Jonathan Hai":"Jonathan Hai",
  "Aryan Morasa":"Arya Morasa",
  "Forest Young":"Forest Niu Young",
  "Victor Young":"Victor Niu Young",
  "Max Z":"Max Zhou",
  "Zhijia Zhang":"Wendy Zhijia Zhang",
  "Wendy Zhang":"Wendy Zhijia Zhang",
  "Wendy Zhijia Zhang":"Wendy Zhijia Zhang",
  "Camel high School 1":"Carmel High School 1",
  "Carmel School 1":"Carmel High School 1",
  "PRISMS":"Princeton International School of Mathematics and Science"
};
function aliasKey(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
const NAME_ALIASES={};Object.entries(RAW_NAME_ALIASES).forEach(([k,v])=>{NAME_ALIASES[aliasKey(k)]=v});
function titleName(raw){let s=String(raw||'').trim().replace(/\s+/g,' '); if(!s)return ''; return s.split(' ').map(w=>{if(/^[A-Z]{2,}$/.test(w)&&w.length<=3)return w; if(/^[A-Z]{2,}$/.test(w))return w[0]+w.slice(1).toLowerCase(); return w.split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):x).join('-')}).join(' ')}
function normName(n){const raw=String(n||'').trim(); const aliased=NAME_ALIASES[aliasKey(raw)]; return aliased||titleName(raw)}
function nameTokens(n){return aliasKey(normName(n)).split(' ').filter(Boolean)}
function nameBucket(n){const t=nameTokens(n); if(t.length>=2)return `${t[0]} ${t[t.length-1]}`; return t.join(' ')}
function nameVariantScore(n){const t=nameTokens(n); const display=normName(n); let score=t.length*10+display.length/100; if(NAME_ALIASES[aliasKey(n)]) score+=1000; return score}
function chooseDisplayName(rows){
  // Prefer an explicit alias target first. Otherwise use the longest full variant from known-location rows.
  const names=rows.map(r=>normName(r.name));
  const aliasTargets=rows.map(r=>NAME_ALIASES[aliasKey(r.name)]).filter(Boolean);
  if(aliasTargets.length){return aliasTargets.sort((a,b)=>nameVariantScore(b)-nameVariantScore(a))[0]}
  const known=rows.filter(r=>hasKnownSchool(r)||hasKnownSection(r)||hasKnownState(r));
  const pool=(known.length?known:rows).map(r=>normName(r.name));
  return pool.sort((a,b)=>nameVariantScore(b)-nameVariantScore(a))[0]||normName(rows[0]?.name||'')
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function sourceLink(id){return `<a class="src" target="_blank" href="${esc(D.source_urls[id]||'#')}">${esc(id)}</a>`}
function isThird(r){return (r.source_quality||'').toLowerCase().includes('third-party')||String(r.level||'').includes('third-party')}
function canonTeamName(s){s=String(s||'').trim().replace(/\*/g,''); s=s.replace(/\s+(Team\s*)?[A-D1-9]$/i,''); s=s.replace(/\s+B$/,'').replace(/\s+A$/,''); s=s.replace(/^PRISMS$/,'Princeton International School of Mathematics and Science'); s=s.replace(/^Saratoga High$/,'Saratoga High School'); s=s.replace(/^Basis Independent Silicon Valley$/i,'BASIS Independent Silicon Valley'); return s}
function isTeam(r){return String(r.level||'').includes('team') || (String(r.award||'').match(/Team Overall|Team Round|Director|Breaking|Topic|Lab|Speed|Food Chemistry|MOFs/) && normName(r.name)===r.school)}
function hasKnownLocationObj(x){return x && x.school && !['Not published','UNKNOWN',''].includes(x.school) && x.state && !['UNKNOWN',''].includes(x.state)}
function recName(r){return normName(r.name)}
function clean(s){return String(s||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()}
function normSection(s){let x=clean(s); return x.replace(/section$/,'').replace(/local section/g,'').replace(/\s+/g,' ').trim()}
function normSchool(s){let x=clean(s); x=x.replace(/\b(high school|hs|upper school|school|academy|institute|institution|college prep|preparatory|prep|the)\b/g,' '); x=x.replace(/\bprisms\b/g,'princeton international mathematics science'); x=x.replace(/\bbasis independent sv\b/g,'basis independent silicon valley'); x=x.replace(/\bmission sj\b/g,'mission san jose'); return x.replace(/\s+/g,' ').trim()}
function knownVal(v){return v && !['not published','unknown','na','n a',''].includes(clean(v))}
function hasKnownSection(r){return knownVal(r.section)}
function hasKnownSchool(r){return knownVal(r.school)}
function hasKnownState(r){return knownVal(r.state)}
function locSig(r){return clean(`${r.school||''}|${r.section||''}|${r.state||''}`)}
function schoolTokens(s){return new Set(normSchool(s).split(' ').filter(w=>w.length>2&&!['high','school','academy','prep'].includes(w)))}
function jaccard(a,b){let A=schoolTokens(a),B=schoolTokens(b); if(!A.size||!B.size)return 0; let inter=0; for(const x of A) if(B.has(x)) inter++; return inter/(A.size+B.size-inter)}
function sameSchoolFuzzy(a,b){if(!hasKnownSchool(a)||!hasKnownSchool(b))return false; const sa=normSchool(a.school), sb=normSchool(b.school); if(!sa||!sb)return false; if(sa===sb)return true; if(sa.includes(sb)&&sb.length>=8)return true; if(sb.includes(sa)&&sa.length>=8)return true; return jaccard(a.school,b.school)>=0.72}
function sameSectionFuzzy(a,b){if(!hasKnownSection(a)||!hasKnownSection(b))return false; const sa=normSection(a.section), sb=normSection(b.section); return !!sa && !!sb && (sa===sb || sa.includes(sb) || sb.includes(sa))}
function mergeableKnown(a,b){
  // Same first+last/name-bucket, then merge if school or ACS local section matches fuzzily.
  // This prevents same-name corruption but fixes school formatting/capitalization/middle-name drift.
  if(sameSectionFuzzy(a,b)) return true;
  if(sameSchoolFuzzy(a,b)) return true;
  if(hasKnownState(a)&&hasKnownState(b)&&clean(a.state)===clean(b.state)&&jaccard(a.school,b.school)>=0.55) return true;
  return false;
}
const FORCE_MERGE_NAMES=['Lishan Clement Prado','Anantshri Asthana','Mingwen Duan','Jonathan Hai','William Wang','Max Zhou','Adam Madni','Yash Shah','Jacky Cai','Daniel Ding','Alex Dong','Wendy Zhijia Zhang'];
const FORCE_MERGE=new Set(FORCE_MERGE_NAMES.map(nameBucket));
D.records.forEach((r,i)=>{r.__rid=i});
const PROFILE_KEY_BY_RID={};
const ambiguousNames=new Set();
function buildIdentityClusters(){
  const groups={};
  for(const r0 of D.records){const r={...r0,name:recName(r0)}; if(isTeam(r)) continue; const bucket=nameBucket(r0.name); (groups[bucket]??=[]).push(r0)}
  for(const [bucket, rows] of Object.entries(groups)){
    const parent={}; const find=x=>parent[x]===x?x:(parent[x]=find(parent[x])); const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
    for(const r of rows) parent[r.__rid]=r.__rid;
    if(FORCE_MERGE.has(bucket)){
      for(let i=1;i<rows.length;i++) union(rows[0].__rid,rows[i].__rid);
    } else {
      const knownRows=rows.filter(r=>hasKnownSchool(r)||hasKnownSection(r)||hasKnownState(r));
      for(let i=0;i<knownRows.length;i++) for(let j=i+1;j<knownRows.length;j++) if(mergeableKnown(knownRows[i],knownRows[j])) union(knownRows[i].__rid,knownRows[j].__rid);
      const knownRoots=[...new Set(knownRows.map(r=>find(r.__rid)))];
      const unknownRows=rows.filter(r=>!(hasKnownSchool(r)||hasKnownSection(r)||hasKnownState(r)));
      // If a no-school/no-section contest row like HMChO has only one plausible known profile, attach it there.
      if(knownRoots.length===1) for(const r of unknownRows) union(knownRoots[0],r.__rid);
      // If all rows are unknown-location-only, keep same-name rows together because no conflict exists.
      if(knownRows.length===0 && rows.length>1) for(let i=1;i<rows.length;i++) union(rows[0].__rid,rows[i].__rid);
    }
    const clusters={}; for(const r of rows){(clusters[find(r.__rid)]??=[]).push(r)}
    const roots=Object.keys(clusters);
    if(roots.length>1) ambiguousNames.add(chooseDisplayName(rows));
    for(const [root,cluster] of Object.entries(clusters)){
      const known=cluster.find(hasKnownLocationObj)||cluster.find(r=>hasKnownSchool(r)||hasKnownSection(r))||cluster[0];
      let suffix='';
      if(roots.length>1){suffix=`@@${clean(`${known.school||''}|${known.section||''}|${known.state||''}`)||root}`}
      const display=chooseDisplayName(cluster); const key=display+suffix;
      for(const r of cluster) PROFILE_KEY_BY_RID[r.__rid]=key;
    }
  }
}
buildIdentityClusters();
function profileKey(r){return PROFILE_KEY_BY_RID[r.__rid] || recName(r)}
function displayNameFromKey(key){return key.split('@@')[0]}
function prettyDisambig(key){if(!key.includes('@@'))return '';let k=bestKnownProfile(key);return ` · merged/split using school/local section: ${k.school}${k.state&&k.state!=='UNKNOWN'?', '+k.state:''}${k.section?' · '+k.section:''}`}
function bestKnownProfile(key){let rows=D.records.map(r=>({...r,name:recName(r),key:profileKey(r)})).filter(r=>r.key===key&&!isTeam(r));let known=rows.find(hasKnownLocationObj)||rows.find(r=>hasKnownSchool(r)||hasKnownSection(r))||rows[0]||{};return {key,name:displayNameFromKey(key),school:known.school||'Not published',state:known.state||'UNKNOWN',section:known.section||''} }
function dedupeScoringRows(rows){const m=new Map(); for(const r of rows){let key=[profileKey(r),r.year,r.competition,r.award,r.source,r.school,r.section].join('|'); if(!m.has(key)||(+r.points||0)>(+m.get(key).points||0)) m.set(key,r)} return [...m.values()]}
const tabs=document.querySelectorAll('nav button');tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));$('#'+b.dataset.tab).classList.add('active')});tabs[0].classList.add('active');
const comps=[...new Set(D.records.map(r=>r.competition))].sort();for(const id of ['comp','rankComp']) $('#'+id).innerHTML+=comps.map(c=>`<option>${esc(c)}</option>`).join('');
function personMap(opts={}){let map={};for(const r0 of D.records){let r={...r0,name:recName(r0)}; if(isTeam(r))continue; if(!opts.third && isThird(r))continue; if(opts.comp && r.competition!==opts.comp)continue; let k=profileKey(r); (map[k]??=[]).push(r)} for(const k in map) map[k]=dedupeScoringRows(map[k]); return map}
function aggregatePersonRows(opts={}){let map=personMap(opts); return Object.keys(map).map(key=>{let all=dedupeScoringRows(D.records.map(r=>({...r,name:recName(r)})).filter(r=>profileKey(r)===key&&!isTeam(r)));let scoring=map[key];let prof=bestKnownProfile(key);let total=scoring.reduce((a,r)=>a+(+r.points||0),0);return {key,name:prof.name,school:prof.school,state:prof.state,section:prof.section,known:hasKnownLocationObj(prof),points:total,events:all.length,official:all.filter(r=>!isThird(r)).length,third:all.filter(isThird).length,ambig:key.includes('@@')}}).sort((a,b)=>b.points-a.points||b.official-a.official||a.name.localeCompare(b.name)||String(a.school).localeCompare(String(b.school)))}
let GLOBAL=[];function recomputeGlobal(){GLOBAL=aggregatePersonRows({third:$('#includeThird').checked,comp:$('#rankComp').value}); GLOBAL.forEach((r,i)=>r.globalRank=i+1)}
function rankedFiltered(){let q=$('#rankQ').value.toLowerCase();return GLOBAL.filter(p=>($('#includeUnknown').checked||p.known)&&(`${p.name} ${p.school} ${p.state} ${p.section}`.toLowerCase().includes(q)))}
function renderStats(){let allKeys=new Set(D.records.filter(r=>!isTeam(r)).map(r=>profileKey(r)));let shown=rankedFiltered();let off=D.records.filter(r=>!isThird(r)).length;let third=D.records.filter(isThird).length;$('#stats').innerHTML=`<div class="stat"><b>${shown.length}</b><span>profiles shown</span></div><div class="stat"><b>${allKeys.size}</b><span>identity-safe profiles</span></div><div class="stat"><b>${ambiguousNames.size}</b><span>names split by school/section</span></div><div class="stat"><b>${off}</b><span>official/public rows</span></div><div class="stat"><b>${D.records.length}</b><span>total sourced rows</span></div>`}
function renderRanks(){let rows=rankedFiltered();$('#rankList').innerHTML=rows.map(r=>`<div class="rankrow" onclick="profileByKey('${esc(r.key)}')"><div class="ranknum">#${r.globalRank}</div><div><b>${esc(r.name)}</b>${r.ambig?'<div class="small warntext">split by source school/section</div>':''}</div><div class="loc">${esc(r.school)}${r.state&&r.state!=='UNKNOWN'?', '+esc(r.state):''}</div><div class="pts">${r.points}</div></div>`).join('')||'<p class="muted">No matching ranked profiles.</p>'}
function rerank(){recomputeGlobal();renderStats();renderRanks()}
function renderRecords(){const q=$('#q').value.toLowerCase(),c=$('#comp').value,usa=$('#usaOnly').checked;let rows=D.records.map(r=>({...r,name:recName(r)})).filter(r=>(!c||r.competition===c)&&(!usa||hasKnownLocationObj(r))&&JSON.stringify(r).toLowerCase().includes(q)).sort((a,b)=>b.year-a.year||(+b.points||0)-(+a.points||0));$('#recordList').innerHTML=rows.map(r=>`<div class="record" onclick="${isTeam(r)?`teamProfile('${esc(canonTeamName(r.name))}')`:`profileByKey('${esc(profileKey(r))}')`}"><div><b>${esc(r.name)}</b><div class="small">${esc(r.school)}${r.state&&r.state!=='UNKNOWN'?', '+esc(r.state):''}${r.section?' · '+esc(r.section):''}</div></div><div><span class="pill">${esc(r.competition)}</span><span class="pill">${r.year}</span></div><div>${esc(r.award)}<div class="small ${isThird(r)?'sourceThird':'sourceOfficial'}">${esc(r.source_quality||'')}</div></div><div>${r.points} CCP</div><div>${sourceLink(r.source)}</div></div>`).join('')||'<p class="muted">No matching records.</p>'}
function dedupeTeamRows(rows){const m=new Map(); for(const r of rows){let aw=String(r.award||'').replace(/ #?\d+$/,'').replace(/\s+\d+$/,''); let key=[r.year,r.competition,canonTeamName(r.name),aw,r.source].join('|'); if(!m.has(key)||(+r.points||0)>(+m.get(key).points||0)) m.set(key,r)} return [...m.values()]}
function teamRows(){let m={}; for(const r of D.records.filter(isTeam)){let k=canonTeamName(r.name); (m[k]??=[]).push(r)} return Object.entries(m).map(([name,rows])=>{let best=rows.find(hasKnownLocationObj)||rows[0];return {name,school:canonTeamName(best.school)||name,state:best.state||'',points:dedupeTeamRows(rows).reduce((a,r)=>a+(+r.points||0),0),rows:dedupeTeamRows(rows)}}).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name))}
function renderTeams(){let rows=teamRows();$('#teamList').innerHTML=rows.map((t,i)=>`<div class="teamrow" onclick="teamProfile('${esc(t.name)}')"><div><b>#${i+1} ${esc(t.name)}</b><div class="small">${t.rows.length} team placement rows</div></div><div>${esc(t.school)}${t.state&&t.state!=='UNKNOWN'?', '+esc(t.state):''}</div><div class="pts">${t.points} team CCP</div><div class="small">click for years, placements, sources</div></div>`).join('')}
function renderComps(){ $('#compCards').innerHTML=D.competitions.map(c=>`<div class="card"><h3>${esc(c.name)}</h3><p><span class="pill">${esc(c.status)}</span><span class="pill">Integrity ${esc(c.integrity)}</span></p><p class="small">${esc(c.scope)}</p><p>${esc(c.notes)}</p></div>`).join('')}
function renderSources(){ $('#sourceCards').innerHTML=Object.entries(D.sources).sort().map(([id,desc])=>`<div class="card"><h3>${esc(id)}</h3><p>${esc(desc)}</p>${sourceLink(id)}</div>`).join('')}
function renderCoverage(){let comps=[...new Set(D.coverage.map(c=>c.competition))];let years=[2023,2024,2025,2026];let html='<div class="coverage-table"><table><thead><tr><th>Competition</th>'+years.map(y=>`<th>${y}</th>`).join('')+'</tr></thead><tbody>';for(const comp of comps){html+=`<tr><th>${esc(comp)}</th>`;for(const y of years){let c=D.coverage.find(x=>x.competition===comp&&x.year===y);let txt=c?.status||'—';let cls=/Imported|Official|Partial|top teams|patched/i.test(txt)?'status-imported':/tracked|source/i.test(txt)?'status-tracked':'status-missing';html+=`<td><b class="${cls}">${esc(txt)}</b><br><span class="small">${esc(c?.notes||'')}</span><br>${c?.source?sourceLink(c.source):''}</td>`}html+='</tr>'}html+='</tbody></table></div>';$('#coverageGrid').innerHTML=html}
window.profileByKey=(key)=>{let rows=dedupeScoringRows(D.records.map(r=>({...r,name:recName(r)})).filter(r=>profileKey(r)===key&&!isTeam(r))).sort((a,b)=>b.year-a.year||(+b.points||0)-(+a.points||0));let prof=bestKnownProfile(key);let total=rows.reduce((a,r)=>a+(+r.points||0),0);let allRankRows=aggregatePersonRows({third:true}); allRankRows.forEach((r,i)=>r.globalRank=i+1); let currentRank=(GLOBAL.find(x=>x.key===key)||{}).globalRank; let allRank=allRankRows.find(x=>x.key===key); let rank=currentRank || (allRank ? allRank.globalRank : 'unranked');let byComp={};for(const r of rows){byComp[r.competition]=(byComp[r.competition]||0)+(+r.points||0)};$('#modal').className='modal';$('#modal').innerHTML=`<div class="inner"><button class="close" onclick="document.querySelector('#modal').className='';document.querySelector('#modal').innerHTML=''">Close</button><h2>#${rank} ${esc(prof.name)}</h2><p class="muted">Best-known school/location: ${esc(prof.school)}${prof.state&&prof.state!=='UNKNOWN'?', '+esc(prof.state):''}${prof.section?' · '+esc(prof.section):''} · ${total} total CCP${prettyDisambig(key)}. Campers are shown with a Study Camp row and a High Honors / camp-linked HH row when the imported data supports it.</p><div class="breakdown">${Object.entries(byComp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="card"><b>${esc(k)}</b><br>${v} CCP</div>`).join('')}</div><h3>Public record: events and placements</h3>${rows.map(r=>`<div class="event"><div><b>${r.year}</b></div><div><b>${esc(r.competition)}</b><br>${esc(r.award)}<br><span class="small">School on source row: ${esc(r.school)}${r.state&&r.state!=='UNKNOWN'?', '+esc(r.state):''} · ${esc(r.section||'')}</span><br><span class="small ${isThird(r)?'sourceThird':'sourceOfficial'}">${esc(r.source_quality||'')}</span><br><span class="small">${esc(r.notes||'')}</span></div><div>${r.points} CCP<br>${sourceLink(r.source)}</div></div>`).join('')}</div>`}
window.profileByName=(name)=>{let bk=nameBucket(name); let keys=[...new Set(D.records.map(r=>({...r,name:recName(r)})).filter(r=>(nameBucket(r.name)===bk||r.name===normName(name))&&!isTeam(r)).map(profileKey))]; profileByKey(keys[0]||normName(name))}
window.teamProfile=(name)=>{let rows=dedupeTeamRows(D.records.filter(isTeam).filter(r=>canonTeamName(r.name)===name||canonTeamName(r.school)===name)).sort((a,b)=>b.year-a.year||(+b.points||0)-(+a.points||0));let total=rows.reduce((a,r)=>a+(+r.points||0),0);$('#modal').className='modal';$('#modal').innerHTML=`<div class="inner"><button class="close" onclick="document.querySelector('#modal').className='';document.querySelector('#modal').innerHTML=''">Close</button><h2>${esc(name)}</h2><p class="muted">Grouped team/school profile across years and A/B/team-number naming variants · ${total} team CCP</p><h3>Team placements</h3>${rows.map(r=>`<div class="event"><div><b>${r.year}</b></div><div><b>${esc(r.competition)}</b><br>${esc(r.award)}<br><span class="small">Source row name: ${esc(r.name)} · ${esc(r.source_quality||'')}</span><br><span class="small">${esc(r.notes||'')}</span></div><div>${r.points} team CCP<br>${sourceLink(r.source)}</div></div>`).join('')}</div>`}
['rankQ','rankComp','includeThird','includeUnknown'].forEach(id=>$('#'+id).addEventListener('input',rerank));['q','comp','usaOnly'].forEach(id=>$('#'+id).addEventListener('input',renderRecords));
rerank();renderRecords();renderTeams();renderComps();renderSources();renderCoverage();
