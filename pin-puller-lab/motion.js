/* Normalized illustration coordinates, not physical dimensions or a dynamics model. */
(function(root){
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
  const phase=(p,a,b)=>ease((p-a)/(b-a));
  const stops=[0,.46,.66,1];
  function stateAt(progress){
    const p=clamp(progress),trigger=phase(p,.18,.46),unlock=phase(p,.46,.66),release=phase(p,.66,1);
    return {p,trigger,unlock,release,latch:44*trigger,ball:14*unlock,pin:14*unlock+98*release,stage:p<=.18?0:p<=.46?1:p<=.66?2:3};
  }
  function coil(x,y1,y2,radius,turns){
    const lead=Math.min(7,(y2-y1)*.1),a=y1+lead,b=y2-lead,steps=turns*2;
    let d=`M${x} ${y1} L${x} ${a}`;
    for(let i=0;i<=steps;i++)d+=` L${x+(i%2===0?-radius:radius)} ${a+(b-a)*i/steps}`;
    return d+` L${x} ${b} L${x} ${y2}`;
  }
  root.PinPullerMotion={stateAt,coil,stops};
})(typeof window!=='undefined'?window:globalThis);
