/* Offline, deterministic game rules. No eval and no network. */
(function (g) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const ids = xs => (xs || []).map(x => x.id);
  const grants = x => !x ? [] : Array.isArray(x) ? x : typeof x === 'object' ? x.random || [] : [x];
  function ordered(data) {
    const result = [], pending = (data.derivedStats || []).slice(), seen = new Set();
    const targets = new Set(pending.map(r => r.target));
    if (targets.size !== pending.length) throw Error('같은 스탯에 계산 규칙이 두 개 있습니다.');
    while (pending.length) {
      const i = pending.findIndex(r => [r.source,r.bonus].filter(Boolean).every(k => !targets.has(k) || seen.has(k)));
      if (i < 0) throw Error('스탯 계산에 순환 관계가 있습니다. A→B→A 연결을 풀어주세요.');
      const r = pending.splice(i,1)[0]; result.push(r); seen.add(r.target);
    }
    return result;
  }
  function requirement(r,s) {
    if (!r) return [];
    const reasons = [];
    if (r.item && !s.inventory.includes(r.item)) reasons.push('필요 아이템: '+r.item);
    if (r.skill && !s.skills.includes(r.skill)) reasons.push('필요 스킬: '+r.skill);
    if (r.class && s.classId !== r.class) reasons.push('필요 직업: '+r.class);
    Object.entries(r.statAtLeast || {}).forEach(([k,v]) => { if ((s.stats[k] || 0) < v) reasons.push(k+' '+v+' 이상 필요'); });
    return reasons;
  }
  function validate(d) {
    const errors = [], warnings = [];
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {errors:['게임 데이터는 객체여야 합니다.'],warnings};
    if (!d.stats || typeof d.stats !== 'object' || Array.isArray(d.stats)) errors.push('stats는 숫자 값을 가진 객체여야 합니다.');
    if (!d.scenes || typeof d.scenes !== 'object' || Array.isArray(d.scenes)) errors.push('scenes는 객체여야 합니다.');
    ['items','skills','classes','derivedStats','statEndings'].forEach(k => { if (d[k] !== undefined && !Array.isArray(d[k])) errors.push(k+'는 배열이어야 합니다.'); });
    if (errors.length) return {errors,warnings};
    const stats = Object.keys(d.stats), scenes = Object.keys(d.scenes);
    const stat = (k,label) => { if (!stats.includes(k)) errors.push(label+': 없는 스탯 '+k); };
    const num = (v,label) => { if (!finite(v)) errors.push(label+': 유한한 숫자가 필요합니다.'); };
    const fx = (obj,label) => { Object.entries(obj || {}).forEach(([k,v]) => {stat(k,label);num(v,label);if ((d.derivedStats||[]).some(r=>r.target===k)) errors.push(label+': 계산 스탯 '+k+' 대신 원본 스탯을 바꾸세요.');}); };
    const refs = {};
    ['items','skills','classes'].forEach(k => {
      refs[k] = ids(d[k]);
      if (new Set(refs[k]).size !== refs[k].length || refs[k].some(x=>!x || typeof x!=='string')) errors.push(k+': ID는 비어 있지 않은 고유 문자열이어야 합니다.');
    });
    const req = (r,label) => { if(!r)return; [['item','items'],['skill','skills'],['class','classes']].forEach(([k,p]) => {if(r[k]&&!refs[p].includes(r[k]))errors.push(label+': 없는 '+k+' '+r[k]);});Object.entries(r.statAtLeast||{}).forEach(([k,v])=>{stat(k,label);num(v,label);}); };
    Object.entries(d.stats).forEach(([k,v]) => num(v,k));
    if (!scenes.includes(d.startScene)) errors.push('시작 씬이 없습니다.');
    Object.entries(d.statBounds||{}).forEach(([k,b])=>{stat(k,'범위');if(b.min!==undefined)num(b.min,k);if(b.max!==undefined)num(b.max,k);if(b.min>b.max)errors.push(k+': 최솟값이 최댓값보다 큽니다.');});
    (d.derivedStats||[]).forEach(r=>{stat(r.target,'계산 대상');stat(r.source,'계산 원본');if(r.bonus)stat(r.bonus,'더할 스탯');num(r.factor,'배율');num(r.offset,'상수');});
    try { ordered(d); } catch(e) { errors.push(e.message); }
    (d.items||[]).forEach(x=>fx(x.effect,'아이템 '+x.id));
    (d.classes||[]).forEach(x=>fx(x.startingStats,'직업 '+x.id));
    (d.skills||[]).forEach(x=>req(x.requires,'스킬 '+x.id));
    Object.entries(d.endings||{}).forEach(([k,e])=>{if(!scenes.includes(e.sceneId))errors.push('엔딩 '+k+': 없는 씬');});
    (d.statEndings||[]).forEach(r=>{stat(r.stat,'자동 엔딩');num(r.value,'엔딩 기준');if(!['lte','lt','gte','gt','eq'].includes(r.op))errors.push('잘못된 엔딩 비교 연산');if(!own(d.endings||{},r.endingId))errors.push('자동 엔딩의 대상이 없습니다.');});
    scenes.forEach(sid=>{
      const s=d.scenes[sid];
      if(!s || !Array.isArray(s.choices)){errors.push(sid+': choices 배열이 필요합니다.');return;}
      if(!s.choices.length && !Object.values(d.endings||{}).some(e=>e.sceneId===sid))warnings.push(sid+': 선택지도 엔딩도 없어 진행이 멈춥니다.');
      s.choices.forEach((c,i)=>{
        const label=sid+' 선택 '+(i+1);
        if(!scenes.includes(c.next))errors.push(label+': 다음 씬이 없습니다.');
        if(!c.label)errors.push(label+': 문구가 없습니다.');
        req(c.requires,label);(c.requiresAll||[]).forEach(r=>req(r,label));fx(c.effects,label);
        [['grantItem','items'],['grantSkill','skills']].forEach(([k,p])=>grants(c[k]).forEach(id=>{if(!refs[p].includes(id))errors.push(label+': 없는 지급 대상 '+id);}));
        (c.dynamicEffects||[]).forEach(r=>{stat(r.target,label);stat(r.source,label);num(r.factor,label);num(r.offset,label);if((d.derivedStats||[]).some(x=>x.target===r.target))errors.push(label+': 계산 스탯에 직접 효과를 줄 수 없습니다.');});
      });
    });
    const visited=new Set(), queue=[d.startScene,...(d.statEndings||[]).map(r=>(d.endings||{})[r.endingId]?.sceneId)];
    while(queue.length){const k=queue.shift();if(visited.has(k)||!d.scenes[k])continue;visited.add(k);(d.scenes[k].choices||[]).forEach(c=>queue.push(c.next));}
    scenes.filter(k=>!visited.has(k)).forEach(k=>warnings.push(k+': 시작/자동 엔딩에서 구조상 연결되지 않았습니다.'));
    return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  }
  function create(data) {
    const d=copy(data), checked=validate(d);
    if(checked.errors.length)throw Error(checked.errors.join('\n'));
    const rules=ordered(d);let state,logs=[];
    function log(s){logs.push(s);if(logs.length>120)logs.shift();}
    function reconcile(){
      const bound=k=>{const b=(d.statBounds||{})[k]||{};state.stats[k]=Math.max(b.min??-Infinity,Math.min(b.max??Infinity,state.stats[k]));};
      Object.keys(state.stats).forEach(bound);
      rules.forEach(r=>{state.stats[r.target]=state.stats[r.source]*r.factor+r.offset+(r.bonus?state.stats[r.bonus]:0);if(!finite(state.stats[r.target]))throw Error('스탯 계산 결과가 너무 큽니다.');bound(r.target);});
    }
    function ending(){
      for(const r of d.statEndings||[]){const v=state.stats[r.stat],n=r.value;const hit={lte:v<=n,lt:v<n,gte:v>=n,gt:v>n,eq:v===n}[r.op];if(hit){state.sceneId=d.endings[r.endingId].sceneId;log('자동 엔딩: '+(d.endings[r.endingId].title||r.endingId));return;}}
    }
    function reset(){state={started:false,sceneId:d.startScene,classId:null,classChosen:false,stats:copy(d.stats),inventory:[],skills:[],rng:12345};logs=[];reconcile();}
    function start(classId){reset();if((d.classes||[]).length&&!ids(d.classes).includes(classId))throw Error('직업을 선택하세요.');state.started=true;state.classChosen=true;state.classId=classId||null;const c=(d.classes||[]).find(x=>x.id===classId);if(c)Object.assign(state.stats,c.startingStats||{});reconcile();ending();log('게임 시작');}
    function reasons(c){return [...requirement(c.requires,state),...(c.requiresAll||[]).flatMap(r=>requirement(r,state))];}
    function random(){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
    function resolve(x){return x&&x.random ? (x.random.length?[x.random[Math.floor(random()*x.random.length)]]:[]) : grants(x);}
    function effect(f){Object.entries(f||{}).forEach(([k,v])=>{state.stats[k]+=v;if(!finite(state.stats[k]))throw Error('스탯 결과가 너무 큽니다.');});}
    function choose(index){
      if(Object.values(d.endings||{}).some(e=>e.sceneId===state.sceneId))return false;
      const c=d.scenes[state.sceneId].choices[index];if(!c)return false;
      const why=reasons(c);if(why.length){log('실행 불가: '+why.join(', '));return false;}
      const before=copy(state), oldLogs=logs.slice();
      try{
        log('선택: '+c.label);effect(c.effects);
        (c.dynamicEffects||[]).forEach(r=>{const amount=before.stats[r.source]*r.factor+r.offset;effect({[r.target]:amount});log(r.target+' 변화 '+amount+' (행동 전 '+r.source+' '+before.stats[r.source]+')');});
        resolve(c.grantItem).forEach(id=>{if(state.inventory.includes(id)){log('이미 보유: '+id+' · 효과 재적용 안 함');return;}state.inventory.push(id);const it=d.items.find(x=>x.id===id);effect(it.effect);log('첫 획득 효과: '+it.name);});
        reconcile();
        resolve(c.grantSkill).forEach(id=>{const skill=d.skills.find(x=>x.id===id),why=requirement(skill.requires,state);if(why.length){log('스킬 획득 불가: '+skill.name+' · '+why.join(', '));return;}if(!state.skills.includes(id)){state.skills.push(id);log('스킬 획득: '+skill.name);}});
        Object.keys(state.stats).forEach(k=>{if(before.stats[k]!==state.stats[k])log(k+': '+before.stats[k]+' → '+state.stats[k]);});
        state.sceneId=c.next;ending();log('이동: '+state.sceneId);return true;
      }catch(e){state=before;logs=oldLogs;throw e;}
    }
    function restore(s,test=false){
      if(!s||!own(d.scenes,s.sceneId))throw Error('저장/테스트 씬이 현재 게임에 없습니다.');
      if(s.classId&&!ids(d.classes).includes(s.classId))throw Error('직업이 현재 게임에 없습니다.');
      if((d.classes||[]).length&&!s.classId)throw Error('직업이 필요합니다.');
      const stats=Object.assign({},d.stats,s.stats);
      if(Object.keys(stats).some(k=>!own(d.stats,k)||!finite(stats[k])))throw Error('스탯 값이 잘못되었습니다.');
      for(const [key,pool]of [['inventory','items'],['skills','skills']])if(!Array.isArray(s[key])||s[key].some(id=>!ids(d[pool]).includes(id)))throw Error('보유 목록이 현재 게임과 맞지 않습니다.');
      const old=state,oldLogs=logs;
      try{state={started:true,classChosen:true,sceneId:s.sceneId,classId:s.classId||null,stats,inventory:[...new Set(s.inventory)],skills:[...new Set(s.skills)],rng:Number.isInteger(s.rng)?s.rng>>>0:12345};logs=[];reconcile();if(test)ending();log(test?'테스트 상태 적용 · 보유 아이템 효과는 재적용하지 않음':'저장 상태 불러옴');}
      catch(e){state=old;logs=oldLogs;throw e;}
    }
    reset();
    return {start,choose,reset,restore,reasons,getState:()=>copy(state),getLogs:()=>logs.slice(),data:d};
  }
  g.GameRules={create,validate,requirement};
})(typeof window==='undefined'?globalThis:window);
