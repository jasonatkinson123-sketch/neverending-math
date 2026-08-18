"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {correctChallengeAnswer} from "./math-input";

type Screen = "title" | "contents" | "warmupIntro" | "warmup" | "warmupComplete" | "challengeIntro" | "challenge" | "results" | "reward" | "study" | "rewards" | "settings";
type Outcome = "first" | "retry" | "reviewed";

const warmups = [
  ["7 × 8", 56], ["54 ÷ 6", 9], ["6 × 9", 54], ["72 ÷ 8", 9], ["12 × 4", 48],
  ["63 ÷ 7", 9], ["8 × 8", 64], ["48 ÷ 6", 8], ["9 × 7", 63], ["84 ÷ 12", 7],
] as const;

const questions = [
  { q: "8 × 7 = ?", answer: 56, shown: "8 × 7 = 56", hint: "Think of seven groups of eight." },
  { q: "96 ÷ 12 = ?", answer: 8, shown: "96 ÷ 12 = 8", hint: "What number times 12 makes 96?" },
  { q: "List the prime factors of 18.", answer: "factors", shown: "18 = 2 × 3 × 3", hint: "Keep breaking composite numbers into primes." },
  { q: "What is the greatest common factor of 18 and 24?", answer: 6, shown: "GCF(18, 24) = 6", hint: "Look for the largest factor shared by both numbers." },
  { q: "What is the least common multiple of 6 and 8?", answer: 24, shown: "LCM(6, 8) = 24", hint: "List multiples until the two lists meet." },
  { q: "−7 + (−5) = ?", answer: -12, shown: "−7 + (−5) = −12", hint: "Both numbers move left on the number line." },
  { q: "9 − (−4) = ?", answer: 13, shown: "9 − (−4) = 13", hint: "Subtracting a negative becomes addition." },
  { q: "(−3) × 6 = ?", answer: -18, shown: "(−3) × 6 = −18", hint: "A negative times a positive is negative." },
  { q: "What common denominator could be used for ⅓ and ¼?", answer: 12, shown: "A common denominator is 12.", hint: "Find the first shared multiple of 3 and 4." },
  { q: "10³ = ?", answer: 1000, shown: "10³ = 10 × 10 × 10 = 1,000", hint: "Multiply three tens." },
  { q: "√81 = ?", answer: 9, shown: "√81 = 9", hint: "Which whole number times itself makes 81?" },
  { q: "√50 is between which two whole numbers?", answer: "between", shown: "√50 is between 7 and 8.", hint: "Find the perfect squares on either side of 50." },
] as const;

function spokenNumber(raw: string) {
  const map: Record<string, number> = { zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90 };
  const numeric = Number(raw.trim().replace(/−/g,"-").replace(/,/g,""));
  if (!Number.isNaN(numeric)) return numeric;
  const cleaned = raw.toLowerCase().replace(/-/g," ").replace(/[^a-z0-9−+ ]/g," ").trim();
  let negative = false, total = 0, current = 0;
  for (const part of cleaned.split(/\s+/)) {
    if (part === "negative" || part === "minus") { negative = true; continue; }
    if (part === "hundred") { current = Math.max(1,current)*100; continue; }
    if (part === "thousand") { total += Math.max(1,current)*1000; current = 0; continue; }
    if (map[part] !== undefined) current += map[part];
  }
  return (negative ? -1 : 1) * (total + current);
}

export default function Home() {
  const [screen,setScreen] = useState<Screen>("title");
  const [warmIndex,setWarmIndex] = useState(0), [warmAttempts,setWarmAttempts] = useState(0);
  const [questionIndex,setQuestionIndex] = useState(0), [attempts,setAttempts] = useState(0);
  const [answer,setAnswer] = useState(""), [feedback,setFeedback] = useState(""), [detail,setDetail] = useState("");
  const [typing,setTyping] = useState(false), [listening,setListening] = useState(false), [voiceChecking,setVoiceChecking] = useState(false);
  const [outcomes,setOutcomes] = useState<(Outcome|null)[]>(Array(12).fill(null));
  const [complete,setComplete] = useState(false), [bellEarned,setBellEarned] = useState(false), [bellPlaced,setBellPlaced] = useState(false);
  const [inspectBell,setInspectBell] = useState(false), [sound,setSound] = useState(true), [voice,setVoice] = useState(true), [loaded,setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const challengeQuestionRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const voiceResultTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const rewardOpeningRef = useRef(false);
  const speechSupported = useMemo(()=> typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),[]);

  useEffect(()=>{
    if (new URLSearchParams(location.search).get("reset") === "1") {
      localStorage.removeItem("neverending-math-day1");
      history.replaceState({},"",location.pathname);
    }
    const saved = localStorage.getItem("neverending-math-day1");
    if (saved) try { const s=JSON.parse(saved); setComplete(!!s.complete); setBellEarned(!!s.bellEarned); setBellPlaced(!!s.bellPlaced); setSound(s.sound!==false); setVoice(s.voice!==false); } catch {}
    setLoaded(true);
  },[]);
  useEffect(()=>{ if(loaded) localStorage.setItem("neverending-math-day1",JSON.stringify({complete,bellEarned,bellPlaced,sound,voice})); },[loaded,complete,bellEarned,bellPlaced,sound,voice]);
  useEffect(()=>{ if(typing) inputRef.current?.focus(); },[typing,warmIndex,questionIndex]);
  useLayoutEffect(()=>{
    if(screen!=="challenge"||!challengeQuestionRef.current)return;
    const el=challengeQuestionRef.current;
    const fitQuestion=()=>{
      el.style.fontSize="";
      let size=parseFloat(getComputedStyle(el).fontSize);
      const minimum=Math.max(12,el.clientWidth*.022);
      el.style.fontSize=`${size}px`;
      while(size>minimum&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)){
        size-=1;
        el.style.fontSize=`${size}px`;
      }
    };
    fitQuestion();
    const observer=new ResizeObserver(fitQuestion);
    observer.observe(el);
    return()=>observer.disconnect();
  },[screen,questionIndex]);
  useEffect(()=>()=>{
    if(recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    if(voiceResultTimerRef.current) clearTimeout(voiceResultTimerRef.current);
    if(rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
    try{recognitionRef.current?.abort();}catch{}
  },[]);

  function tone(kind:"tap"|"right"|"wrong"|"bell"|"place") {
    if(!sound) return; const AC=window.AudioContext||(window as any).webkitAudioContext; if(!AC) return;
    const ctx=new AC(), osc=ctx.createOscillator(), gain=ctx.createGain(); const f={tap:240,right:660,wrong:120,bell:880,place:180};
    osc.frequency.value=f[kind]; osc.type=(kind==="bell"||kind==="right")?"sine":"triangle"; gain.gain.setValueAtTime(kind==="bell"?.09:.045,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+(kind==="bell"?1.5:.28)); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+(kind==="bell"?1.5:.3));
  }
  function go(next:Screen){
    tone("tap");
    if(recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    if(voiceResultTimerRef.current) clearTimeout(voiceResultTimerRef.current);
    try{recognitionRef.current?.abort();}catch{}
    recognitionRef.current=null; setListening(false); setVoiceChecking(false); setFeedback(""); setDetail(""); setAnswer(""); setScreen(next);
  }
  function startDay(){ rewardOpeningRef.current=false;if(rewardTimerRef.current)clearTimeout(rewardTimerRef.current);setWarmIndex(0);setWarmAttempts(0);setQuestionIndex(0);setAttempts(0);setOutcomes(Array(12).fill(null));setAnswer("");setFeedback("");setDetail("");setTyping(false);go("warmupIntro"); }

  function finishWarm(ok:boolean, heard?:string){
    if(ok){tone("right");setFeedback("✓  CORRECT");setDetail(heard?`I heard “${heard}.”`:"");setTimeout(()=>{if(warmIndex===9)setScreen("warmupComplete");else{setWarmIndex(i=>i+1);setWarmAttempts(0);setFeedback("");setDetail("");setAnswer("");}},700);}
    else if(warmAttempts===0){tone("wrong");setWarmAttempts(1);setFeedback("TRY ONCE MORE");setDetail(heard?`I heard “${heard}.”`:"");}
    else{tone("tap");setFeedback(`${warmups[warmIndex][0]} = ${warmups[warmIndex][1]}`);setDetail("Keep that fact for next time.");setTimeout(()=>{if(warmIndex===9)setScreen("warmupComplete");else{setWarmIndex(i=>i+1);setWarmAttempts(0);setFeedback("");setDetail("");setAnswer("");}},1250);}
  }
  function submitWarm(raw=answer){if(raw.trim())finishWarm(spokenNumber(raw)===warmups[warmIndex][1],raw);}
  function listen(){
    if(listening||voiceChecking||recognitionRef.current)return;
    if(!window.isSecureContext){setTyping(true);setFeedback("VOICE INPUT REQUIRES A SECURE CONNECTION");setDetail("Type the answer instead.");return;}
    if(!voice){setTyping(true);setFeedback("VOICE INPUT IS TURNED OFF");setDetail("Enable voice in Settings, or type the answer.");return;}
    if(!speechSupported){setTyping(true);setFeedback("VOICE INPUT IS NOT SUPPORTED IN THIS BROWSER");setDetail("Type the answer instead.");return;}
    const R=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!R){setTyping(true);setFeedback("VOICE INPUT IS NOT SUPPORTED IN THIS BROWSER");setDetail("Type the answer instead.");return;}
    const r=new R(); recognitionRef.current=r; let received=false; let timedOut=false; let failed=false;
    r.lang="en-US"; r.continuous=false; r.interimResults=false; r.maxAlternatives=1;
    const finishSession=()=>{if(recognitionTimerRef.current)clearTimeout(recognitionTimerRef.current);recognitionTimerRef.current=null;recognitionRef.current=null;setListening(false);};
    r.onstart=()=>{
      setListening(true);setFeedback("LISTENING…");setDetail("Say the number clearly.");
      recognitionTimerRef.current=setTimeout(()=>{timedOut=true;try{r.abort();}catch{}setTyping(true);setFeedback("I COULDN’T HEAR AN ANSWER");setDetail("Type the answer, or tap the microphone to try again.");},9000);
    };
    r.onresult=(e:any)=>{
      received=true;const heard=String(e.results?.[0]?.[0]?.transcript||"").trim();finishSession();
      if(!heard){setTyping(true);setFeedback("I COULDN’T HEAR AN ANSWER");setDetail("Type the answer, or tap the microphone to try again.");return;}
      setVoiceChecking(true);setFeedback(`I HEARD “${heard}”`);setDetail("Checking your answer…");
      voiceResultTimerRef.current=setTimeout(()=>{voiceResultTimerRef.current=null;setVoiceChecking(false);finishWarm(spokenNumber(heard)===warmups[warmIndex][1],heard);},550);
    };
    r.onerror=(e:any)=>{
      if(received)return;failed=true;const code=String(e.error||"");finishSession();setTyping(true);
      if(code==="not-allowed"||code==="service-not-allowed"){setFeedback("MICROPHONE PERMISSION WAS DENIED");setDetail("Allow microphone access in your browser, or type the answer.");}
      else if(code==="no-speech"){setFeedback("I COULDN’T HEAR AN ANSWER");setDetail("Type the answer, or tap the microphone to try again.");}
      else if(code==="network"){setFeedback("VOICE SERVICE IS CURRENTLY UNAVAILABLE");setDetail("Your answer was not counted. Type it instead.");}
      else if(code==="audio-capture"){setFeedback("NO MICROPHONE WAS FOUND");setDetail("Check the microphone, or type the answer.");}
      else if(code==="aborted"&&timedOut){setFeedback("I COULDN’T HEAR AN ANSWER");setDetail("Type the answer, or tap the microphone to try again.");}
      else if(code==="aborted"){setFeedback("LISTENING STOPPED");setDetail("Tap the microphone to try again, or type the answer.");}
      else{setFeedback("VOICE SERVICE IS CURRENTLY UNAVAILABLE");setDetail("Your answer was not counted. Type it instead.");}
    };
    r.onend=()=>{if(!received){finishSession();if(!failed&&!timedOut){setTyping(true);setFeedback("I COULDN’T HEAR AN ANSWER");setDetail("Type the answer, or tap the microphone to try again.");}}};
    try{r.start();}catch{finishSession();setTyping(true);setFeedback("VOICE SERVICE IS CURRENTLY UNAVAILABLE");setDetail("Type the answer instead.");}
  }
  function record(outcome:Outcome){const next=[...outcomes];next[questionIndex]=outcome;setOutcomes(next);setTimeout(()=>{if(questionIndex===11)setScreen("results");else{setQuestionIndex(i=>i+1);setAttempts(0);setAnswer("");setFeedback("");setDetail("");}},750);}
  function submitQuestion(){
    if(!answer.trim())return; if(correctChallengeAnswer(questionIndex,answer,questions[questionIndex].answer)){tone("right");setFeedback("✓  CORRECT");setDetail("");record(attempts===0?"first":"retry");}
    else if(attempts===0){tone("wrong");setAttempts(1);setFeedback("NOT QUITE — TRY ONCE MORE");setDetail(questions[questionIndex].hint);setAnswer("");}
    else{tone("wrong");setFeedback("LET’S REVIEW IT");setDetail(questions[questionIndex].shown);setOutcomes(p=>{const n=[...p];n[questionIndex]="reviewed";return n;});}
  }
  function continueReviewed(){if(questionIndex===11)setScreen("results");else{setQuestionIndex(i=>i+1);setAttempts(0);setAnswer("");setFeedback("");setDetail("");}}
  function skipQuestion(){tone("tap");setFeedback("SAVED FOR REVIEW");setDetail(questions[questionIndex].shown);setOutcomes(p=>{const n=[...p];n[questionIndex]="reviewed";return n;});}
  function saveRewardProgress(nextComplete:boolean,nextPlaced:boolean){
    localStorage.setItem("neverending-math-day1",JSON.stringify({complete:nextComplete,bellEarned:true,bellPlaced:nextPlaced,sound,voice}));
  }
  function awardBellAndOpenReward(){
    if(rewardOpeningRef.current)return;
    rewardOpeningRef.current=true;
    if(rewardTimerRef.current)clearTimeout(rewardTimerRef.current);
    rewardTimerRef.current=null;
    saveRewardProgress(complete,bellPlaced);setBellEarned(true);tone(bellEarned?"tap":"bell");setScreen("reward");
  }
  function continueToCollection(){
    saveRewardProgress(true,bellPlaced);setComplete(true);setBellEarned(true);setInspectBell(false);tone("tap");setScreen("rewards");
  }
  function goHomeAfterReward(){
    saveRewardProgress(true,bellPlaced);setComplete(true);setBellEarned(true);setInspectBell(false);tone("tap");setScreen("title");
  }
  function openStudyFromCollection(){
    saveRewardProgress(true,bellPlaced);setComplete(true);setInspectBell(false);tone("tap");setScreen("study");
  }
  function placeBellInStudy(){
    if(!bellEarned||bellPlaced)return;
    saveRewardProgress(true,true);setComplete(true);setBellPlaced(true);setInspectBell(false);tone("place");
  }
  useEffect(()=>{
    if(screen!=="results")return;
    rewardOpeningRef.current=false;
    rewardTimerRef.current=setTimeout(awardBellAndOpenReward,2500);
    return()=>{if(rewardTimerRef.current)clearTimeout(rewardTimerRef.current);rewardTimerRef.current=null;};
    // The timer intentionally starts only when the Results screen is entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen]);
  const counts={first:outcomes.filter(o=>o==="first").length,retry:outcomes.filter(o=>o==="retry").length,reviewed:outcomes.filter(o=>o==="reviewed").length};
  const warmFactSize=warmups[warmIndex][0].length>=7?"fact-long":warmups[warmIndex][0].length>=6?"fact-medium":"fact-short";
  const challengeIsExpression=[0,1,5,6,7,9,10].includes(questionIndex);
  const formatExample=questionIndex===2?"FORMAT EXAMPLE: 2 × 2 × 5":questionIndex===11?"FORMAT EXAMPLE: 4 AND 5":"";
  const imageScreen=(name:string,children:React.ReactNode,alt:string)=><div className={`stage image-stage ${name}`} role="region" aria-label={alt}><img src={`/assets/${name}.png`} alt="" draggable={false}/>{children}</div>;

  return <main className="game-shell"><div className="grain" aria-hidden="true"/>
    {screen==="title"&&imageScreen("title",<>{complete&&<div className="completion-mark">DAY 1 COMPLETE</div>}<button className="hotspot start-hotspot" onClick={()=>go("contents")} aria-label="Start Neverending Math"/></>,"Neverending Math title screen")}
    {screen==="contents"&&imageScreen("contents",<><button className="hotspot daily-hotspot" onClick={startDay} aria-label={complete?"Replay Day 1":"Begin Daily Challenge"}/><button className="hotspot rewards-hotspot" onClick={()=>go("rewards")} aria-label="Open rewards collection"/><button className="hotspot settings-hotspot" onClick={()=>go("settings")} aria-label="Open settings"/>{complete&&<div className="daily-status">✓ COMPLETE · TAP TO REPLAY</div>}<button className="corner-back" onClick={()=>go("title")}>← TITLE</button></>,"Neverending Math contents")}
    {screen==="warmupIntro"&&<section className="stage image-stage art-transition-stage warm-transition-stage" aria-label="Warm-up introduction"><img src="/assets/warmup-clean.png" alt="" draggable={false}/><div className="warm-transition-copy"><p>TEN QUICK FACTS.</p><p>SAY EACH ANSWER ALOUD.</p></div><button className="art-chalk-button warm-transition-button" onClick={()=>go("warmup")}>BEGIN →</button></section>}
    {screen==="warmupComplete"&&<section className="stage image-stage art-transition-stage warm-transition-stage" aria-label="Warm-up complete"><img src="/assets/warmup-clean.png" alt="" draggable={false}/><div className="warm-transition-copy complete"><h1>WARM-UP COMPLETE</h1><p>THE DAILY CHALLENGE IS READY.</p></div><button className="art-chalk-button warm-transition-button" onClick={()=>go("challengeIntro")}>CONTINUE →</button></section>}
    {screen==="challengeIntro"&&<section className="stage image-stage art-transition-stage challenge-transition-stage" aria-label="Daily Challenge introduction"><img src="/assets/challenge-clean.png" alt="" draggable={false}/><div className="challenge-transition-copy"><p className="challenge-day">DAY 1</p><h1>DAILY CHALLENGE</h1><p className="challenge-total">12 QUESTIONS</p><p className="challenge-intro-note">Take your time. Difficult questions are meant to be worked out.</p></div><button className="art-chalk-button challenge-transition-button" onClick={()=>go("challenge")}>BEGIN →</button></section>}
    {screen==="warmup"&&<section className="stage image-stage warm-art-stage" aria-label="Neverending Math voice warm-up"><img src="/assets/warmup-clean.png" alt="" draggable={false}/><p className="warm-live-count">{warmIndex+1} OF 10</p><div className={`warm-live-problem ${warmFactSize}`}>{warmups[warmIndex][0]}</div><button className={`mic-hotspot ${listening?"listening":""}`} onClick={listen} disabled={listening||voiceChecking} aria-label={listening?"Listening for your answer":voiceChecking?"Checking your spoken answer":"Tap to speak your answer"}/><div className="voice-state" aria-live="polite"><strong>{feedback||"TAP TO SPEAK"}</strong><span>{detail}</span></div>{!typing&&<button className="warm-type-link" onClick={()=>{setTyping(true);setFeedback("");setDetail("");}}>TYPE INSTEAD</button>}{typing&&<form className="warm-type-form" onSubmit={e=>{e.preventDefault();submitWarm();}}><input ref={inputRef} value={answer} onChange={e=>setAnswer(e.target.value)} inputMode="numeric" aria-label="Warm-up answer"/><button>CHECK →</button></form>}</section>}
    {screen==="challenge"&&<section className="stage image-stage challenge-art-stage" aria-label={`Daily Challenge question ${questionIndex+1} of 12`}><img src="/assets/challenge-clean.png" alt="" draggable={false}/><p className="challenge-live-count">QUESTION {questionIndex+1} OF 12</p><p className="challenge-live-rule">— DAILY CHALLENGE —</p><div ref={challengeQuestionRef} className={`challenge-live-question ${challengeIsExpression?"challenge-expression":"challenge-sentence"}`}>{questions[questionIndex].q}</div><form className="challenge-answer-form" onSubmit={e=>{e.preventDefault();submitQuestion();}}><label htmlFor="main-answer">YOUR ANSWER</label><input id="main-answer" ref={inputRef} value={answer} onChange={e=>setAnswer(e.target.value)} autoFocus autoComplete="off" inputMode={questionIndex===2||questionIndex===11?"text":"numeric"} aria-describedby={formatExample?"answer-format":undefined} disabled={outcomes[questionIndex]==="reviewed"}/>{formatExample&&<p id="answer-format" className="challenge-format-example">{formatExample}</p>}{outcomes[questionIndex]==="reviewed"?<button type="button" onClick={continueReviewed}>CONTINUE →</button>:<button type="submit">CHECK ANSWER →</button>}</form>{outcomes[questionIndex]!=="reviewed"&&<button className="challenge-skip" onClick={skipQuestion}>SKIP</button>}<div className="challenge-feedback" aria-live="polite"><strong>{feedback}</strong><span>{detail}</span></div></section>}
    {screen==="results"&&<section className="stage chalk-stage results-stage"><p className="eyebrow">NEVERENDING MATH</p><h1>TODAY’S WORK<br/>IS COMPLETE</h1><div className="score-grid"><p><b>{counts.first}</b>CORRECT</p><p><b>{counts.retry}</b>SOLVED WITH<br/>ANOTHER TRY</p><p><b>{counts.reviewed}</b>REVIEWED</p></div><div className="completion-list"><span>✓ WARM-UP COMPLETE</span><span>✓ DAILY CHALLENGE COMPLETE</span></div>{counts.reviewed>0&&<p className="review-note">A few ideas have been left on the board for another day.</p>}<p className="room-notice">The room has noticed your work.</p><button className="chalk-button results-reward-button" onClick={awardBellAndOpenReward}>{bellEarned?"VIEW DAY 1 OBJECT →":"RECEIVE TODAY’S OBJECT →"}</button></section>}
    {screen==="reward"&&imageScreen("reward-clean",<><div className="reward-glow" aria-hidden="true"/><button className="reward-choice reward-continue" onClick={continueToCollection}>CONTINUE TO OBJECTS COLLECTION →</button><button className="reward-choice reward-home" onClick={goHomeAfterReward}>GO HOME</button></>,"Day 1 object awarded: Old Brass School Bell")}
    {screen==="study"&&imageScreen("study-empty",<>{bellEarned&&!bellPlaced&&<button className="study-bell-silhouette" onClick={placeBellInStudy} aria-label="Place the Old Brass School Bell"/>}{bellPlaced&&<><img className="study-bell-art" src="/assets/study-bell-cutout.png" alt=""/><button className="study-bell-inspect" onClick={()=>setInspectBell(v=>!v)} aria-label="Inspect Old Brass School Bell"/></>}{inspectBell&&bellPlaced&&<div className="object-label"><strong>OLD BRASS SCHOOL BELL</strong><span>Found on Day 1</span></div>}<button className="hotspot study-back-hotspot" onClick={()=>{setInspectBell(false);go("rewards");}} aria-label="Return to objects collection"/><button className="study-home" onClick={()=>{setComplete(true);tone("tap");setScreen("title");}}>GO HOME</button></>,bellPlaced?"The Study with the Old Brass School Bell placed on the desk":"The empty Study with chalk silhouettes for objects")}
    {screen==="rewards"&&imageScreen("rewards",<><div className="locked-collection-grid" aria-hidden="true"/>{bellEarned&&<div className="earned-bell-art" aria-hidden="true"/>}<div className="found-count">{bellEarned?"1 / 30 FOUND":"0 / 30 FOUND"}</div>{bellEarned&&<button className="reward-bell-hotspot" onClick={()=>setInspectBell(v=>!v)} aria-label="Old Brass School Bell"/>}{bellEarned&&inspectBell&&<><div className="collection-label"><strong>OLD BRASS SCHOOL BELL</strong><span>Found on Day 1</span></div><button className="collection-study-button" onClick={openStudyFromCollection}>{bellPlaced?"VIEW IN THE STUDY →":"PLACE IN THE STUDY →"}</button></>}<button className="hotspot rewards-back" onClick={()=>{setInspectBell(false);go("contents");}} aria-label="Back to contents"/></>,bellEarned?"Objects collection with one of thirty objects found":"Objects collection with thirty locked silhouettes")}
    {screen==="settings"&&imageScreen("settings",<><div className="settings-controls"><button onClick={()=>setVoice(v=>!v)}>VOICE: {voice?"ON":"OFF"}</button><button onClick={()=>setSound(v=>!v)}>SOUND: {sound?"ON":"OFF"}</button></div><button className="hotspot settings-back" onClick={()=>go("contents")} aria-label="Back to contents"/><button className="hotspot settings-save" onClick={()=>{tone("right");setFeedback("SETTINGS SAVED");setTimeout(()=>go("contents"),550);}} aria-label="Save settings"/>{feedback&&<div className="save-notice">SETTINGS SAVED</div>}</>,"Parent settings")}
  </main>;
}
