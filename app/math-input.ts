export function correctChallengeAnswer(index:number,raw:string,expected:number|string){
  const normalized=raw.toLowerCase().replace(/−/g,"-").trim();
  const compact=normalized.replace(/,/g,"").replace(/\s+/g,"").replace(/[×x·]/g,"*");
  if(index===2){
    const factorText=normalized.includes("=")?normalized.split("=").slice(1).join("="):normalized;
    const factors=factorText.match(/\d+/g)?.map(Number).sort((a,b)=>a-b)??[];
    return JSON.stringify(factors)===JSON.stringify([2,3,3]);
  }
  if(index===11){
    const nums=normalized.match(/-?\d+/g)?.map(Number)??[];
    return nums.length===2&&nums.includes(7)&&nums.includes(8);
  }
  return Number(compact)===expected;
}
