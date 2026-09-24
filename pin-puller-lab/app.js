(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const {stateAt,coil,stops}=window.PinPullerMotion;
  const parts=[
    {id:'pin',name:'Pin',ref:'12',color:'#3d71bd',category:'MOVES DOWN',text:'The hollow pin holds the retained part. Once the balls clear its inner shoulder, the main spring pulls it down into the housing.'},
    {id:'main-spring',name:'Main spring',ref:'22',color:'#b77910',category:'STORES THE RELEASE ENERGY',text:'This compressed spring supplies the retraction force. Its two zigzags are the left and right sides of one spring seen in section.'},
    {id:'balls',name:'Locking balls',ref:'28 / 30',color:'#c56627',category:'MOVE INWARD',text:'These balls block the pin’s bevelled shoulder. They stay in fixed guide holes and move inward when the latch recess makes room.'},
    {id:'latch',name:'Latch',ref:'38',color:'#8154b5',category:'OPENS THE WAY',text:'The SMA wire pulls this latch down. Its narrow recess lines up with the balls, giving them space to move inward.'},
    {id:'wire',name:'SMA wire',ref:'50',color:'#c45562',category:'THE ELECTRICAL TRIGGER',text:'Electrical heating makes this shape-memory-alloy wire contract and pull the latch down. Its contraction is exaggerated so you can see it.'},
    {id:'reset-spring',name:'Reset spring',ref:'58',color:'#ab4f90',category:'COMPRESSES DURING RELEASE',text:'This smaller spring opposes the latch movement and compresses during triggering. It helps re-arm the real mechanism later; resetting is not shown here.'},
    {id:'keeper',name:'Ball keeper',ref:'34',color:'#25897d',category:'STAYS FIXED',text:'This fixed tube guides the latch and holds the balls in side holes. Only the balls slide inward; the keeper stays attached to the housing.'},
    {id:'housing',name:'Housing',ref:'16',color:'#8291a5',category:'STAYS FIXED',text:'The outer body supports the main spring and the fixed ball keeper. It stays attached to the surrounding structure throughout release.'}
  ];
  const stages=[
    {name:'Locked',title:'Ready, but held.',text:'The main spring is compressed. The two balls block the pin’s inner shoulder, stopping it from retracting.',key:'The latch keeps the balls pushed outward.'},
    {name:'Trigger',title:'The wire pulls the latch.',text:'Electrical heating contracts the SMA wire. It draws the latch downward, bringing the narrow recess toward the balls.',key:'The wire moves the latch. The main spring will move the pin.'},
    {name:'Unlock',title:'The balls move inward.',text:'The recess makes room. As the pin begins to move, its bevel nudges the balls inward through their fixed guide holes.',key:'The balls clear the pin’s inner shoulder.'},
    {name:'Release',title:'The spring retracts the pin.',text:'With the balls clear, the main spring expands and drives the pin down. The retained part is free once the tip clears it.',key:'The keeper stays fixed while the pin slides around it.'}
  ];
  let progress=0,playing=false,frame=0,lastTime=0,selected=null,activeStage=-1;
  const duration=18000;
  const set=(id,name,value)=>$(id).setAttribute(name,String(value));
  const visible=(id,yes)=>$(id).style.opacity=yes?'1':'0';
  const leader=(prefix,x,y,labelX,labelY,elbowX)=>{
    set(prefix+'-leader','d',`M${labelX} ${labelY} H${elbowX} L${x} ${y}`);
    set(prefix+'-dot','cx',x);set(prefix+'-dot','cy',y);
  };
  function selectPart(id){
    const part=parts.find(p=>p.id===id);if(!part)return;
    selected=id;
    document.querySelectorAll('[data-part]').forEach(el=>{const on=el.dataset.part===id;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on));});
    document.querySelectorAll('[data-label]').forEach(el=>el.classList.toggle('selected',el.dataset.label===id));
    $('part-category').textContent=part.category;
    $('part-title').textContent=part.name+' · '+part.ref;
    $('part-description').textContent=part.text;
    $('part-detail').style.borderColor=part.color;
  }
  for(const part of parts){
    const b=document.createElement('button');b.className='part-button';b.dataset.part=part.id;b.style.setProperty('--part-color',part.color);b.setAttribute('aria-pressed','false');
    const swatch=document.createElement('span');swatch.className='swatch';swatch.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=part.name;b.append(swatch,label);$('parts-list').append(b);
  }
  document.querySelectorAll('[data-part]').forEach(el=>{
    el.addEventListener('click',()=>selectPart(el.dataset.part));
    if(el.tagName.toLowerCase()==='g')el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPart(el.dataset.part)}});
  });
  function draw(){
    const s=stateAt(progress);
    set('moving-pin','transform',`translate(0 ${s.pin})`);
    set('moving-latch','transform',`translate(0 ${s.latch})`);
    set('left-ball','cx',-38+s.ball);set('right-ball','cx',38-s.ball);
    const left=coil(-103,201,350+s.pin,8,8),right=coil(103,201,350+s.pin,8,8);
    set('main-spring-left','d',left);set('main-spring-right','d',right);
    set('spring-hit-left','d',`M-103 201V${350+s.pin}`);set('spring-hit-right','d',`M103 201V${350+s.pin}`);
    const reset=coil(0,444+s.latch,554,17,7);set('reset-coil','d',reset);set('reset-hit','d',`M0 ${444+s.latch}V554`);
    const wire=`M0 ${442+s.latch}V600`;set('sma-wire','d',wire);set('wire-hit','d',wire);
    set('sma-wire','stroke',s.p>.18?'#e04c43':'#b45a70');
    visible('latch-arrow',s.p>.18&&s.p<=.46);set('latch-arrow','transform',`translate(0 ${s.latch})`);
    visible('ball-arrows',s.p>.46&&s.p<=.66);
    set('left-ball-arrow','d',`M${-58+s.ball} 348H${-40+s.ball}`);set('right-ball-arrow','d',`M${58-s.ball} 348H${40-s.ball}`);
    visible('pin-arrow',s.p>.66);set('pin-arrow','transform',`translate(0 ${s.pin*.30})`);
    visible('release-clearance',s.pin>91);
    leader('pin',366,82+s.pin,145,108,265);
    leader('main',310,272+s.pin*.42,195,266,246);
    leader('balls',472-s.ball,320,620,331,595);
    leader('latch',401,381+s.latch,153,412,269);
    leader('reset',404,(444+s.latch+554)/2,196,511,276);
    leader('wire',420,580,620,571,590);
    $('progress').value=Math.round(s.p*1000);$('progress').style.setProperty('--progress',`${s.p*100}%`);
    $('progress').setAttribute('aria-valuetext',`${stages[s.stage].name}, ${Math.round(s.p*100)} percent through the illustration`);
    $('previous').disabled=s.p<=0;$('next').disabled=s.p>=1;
    if(s.stage!==activeStage){
      activeStage=s.stage;const stage=stages[s.stage];
      $('stage-kicker').textContent=`0${s.stage+1} / ${stage.name.toUpperCase()}`;
      $('stage-title').textContent=stage.title;$('stage-description').textContent=stage.text;$('stage-key').textContent=stage.key;
      document.querySelectorAll('[data-stage]').forEach(el=>{const i=Number(el.dataset.stage);el.classList.toggle('active',i===s.stage);el.classList.toggle('visited',i<s.stage);if(i===s.stage)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
      $('announcement').textContent=`Stage ${s.stage+1}: ${stage.name}. ${stage.title}`;
    }
  }
  function updatePlay(){
    $('play-text').textContent=playing?'Pause':progress>=1?'Play again':'Play release';
    $('play-icon').innerHTML=playing?'<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>':'<path d="m8 5 11 7-11 7Z"/>';
    $('play').setAttribute('aria-label',playing?'Pause release animation':progress>=1?'Replay release animation':'Play release animation');
  }
  function pause(){playing=false;cancelAnimationFrame(frame);lastTime=0;updatePlay()}
  function tick(time){
    if(!playing)return;if(!lastTime)lastTime=time;
    progress=Math.min(1,progress+Math.min(time-lastTime,80)/duration);lastTime=time;draw();
    if(progress>=1){pause();return;}frame=requestAnimationFrame(tick);
  }
  function togglePlay(){if(playing){pause();return;}if(progress>=1){progress=0;draw();}playing=true;lastTime=0;updatePlay();frame=requestAnimationFrame(tick)}
  function seek(value){pause();progress=Math.max(0,Math.min(1,value));draw();updatePlay()}
  function step(direction){
    const target=direction>0?stops.find(p=>p>progress+.001):[...stops].reverse().find(p=>p<progress-.001);
    if(target!==undefined)seek(target);
  }
  $('play').addEventListener('click',togglePlay);
  $('previous').addEventListener('click',()=>step(-1));$('next').addEventListener('click',()=>step(1));
  $('restart').addEventListener('click',()=>{seek(0);$('announcement').textContent='Illustration returned to the start. A physical reset is not shown.'});
  $('progress').addEventListener('input',e=>seek(Number(e.target.value)/1000));
  $('labels-toggle').addEventListener('change',e=>{$('diagram-labels').style.display=e.target.checked?'':'none'});
  document.querySelectorAll('[data-stage]').forEach(el=>el.addEventListener('click',()=>seek(stops[Number(el.dataset.stage)])));
  document.addEventListener('keydown',e=>{
    if(e.target.closest('button,input,a,[role="button"]'))return;
    if(e.key===' '){e.preventDefault();togglePlay()}
    if(e.key==='ArrowRight'){e.preventDefault();step(1)}
    if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause()});
  draw();updatePlay();
})();
