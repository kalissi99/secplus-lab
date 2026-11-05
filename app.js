/* Sec+ Lab — application de révision CompTIA Security+ SY0-701 (vanilla JS, sans build) */
(() => {
"use strict";

const DOMAINS = {
  1:{name:"Concepts généraux de sécurité", en:"General Security Concepts", w:12, color:"var(--d1)"},
  2:{name:"Menaces, vulnérabilités & atténuations", en:"Threats, Vulnerabilities & Mitigations", w:22, color:"var(--d2)"},
  3:{name:"Architecture de sécurité", en:"Security Architecture", w:18, color:"var(--d3)"},
  4:{name:"Opérations de sécurité", en:"Security Operations", w:28, color:"var(--d4)"},
  5:{name:"Gestion & supervision du programme", en:"Security Program Management & Oversight", w:20, color:"var(--d5)"},
};
const DIDS = [1,2,3,4,5];
const INTERVALS = [0,1,2,4,7,15]; // jours par boîte Leitner
const DAY = 86400000;
const EXAM_Q = 90, EXAM_MIN = 90, PASS = 750;

const hash = s => { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const CARDS = (window.FLASHCARDS||[]).map(([d,front,back]) => ({id:"c"+hash(front), d, front, back}));
const QS = (window.QUIZ||[]).map(([d,q,o,a,e]) => ({id:"q"+hash(q), d, q, o, a, e}));
const QBYID = Object.fromEntries(QS.map(q=>[q.id,q]));

// ── Stockage ─────────────────────────────
const KEY = "secplus.v1";
const blank = () => ({cards:{}, missed:{}, history:[], examDate:"", theme:"dark"});
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)||"{}")); } catch { S = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

// ── Utilitaires ──────────────────────────
const $ = (sel, el=document) => el.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = a => { a = a.slice(); for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const app = $("#app");
const cardState = id => S.cards[id] || {box:0, due:0, seen:false};
const isDue = c => cardState(c.id).due <= Date.now();
const mastered = c => cardState(c.id).box >= 3;
const pct = (a,b) => b ? Math.round(a*100/b) : 0;
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

function applyTheme(){ document.documentElement.classList.toggle("light", S.theme==="light"); }
$("#themeBtn").onclick = () => { S.theme = S.theme==="light"?"dark":"light"; save(); applyTheme(); };
applyTheme();

let cleanup = null; // supprime les écouteurs clavier / timers de la vue précédente
function setView(fn){ if (cleanup) { cleanup(); cleanup = null; } fn(); window.scrollTo(0,0); }

// ── Routeur ──────────────────────────────
let pending = null; // quiz à lancer directement depuis l'accueil
const goQuiz = opts => { pending = opts; if (location.hash === "#/quiz") route(); else location.hash = "#/quiz"; };
function route(){
  const r = (location.hash.replace(/^#\/?/,"").split("?")[0]) || "";
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === (r||"home")));
  if (r === "flashcards") setView(renderFlashSetup);
  else if (r === "quiz") setView(() => { if (pending){ const p = pending; pending = null; startQuiz(p); } else renderQuizSetup(); });
  else setView(renderHome);
}
window.addEventListener("hashchange", route);

// ══════════════ ACCUEIL ══════════════
function renderHome(){
  const seen = CARDS.filter(c=>cardState(c.id).seen).length;
  const mast = CARDS.filter(mastered).length;
  const due = CARDS.filter(c=>cardState(c.id).seen && isDue(c)).length;
  const missed = Object.keys(S.missed).filter(id=>QBYID[id]).length;
  const hist = S.history.slice(-8).reverse();
  let cd = "";
  if (S.examDate){
    const days = Math.ceil((new Date(S.examDate+"T08:00") - Date.now())/DAY);
    cd = days > 0 ? `<div class="big">J-${days}</div><div class="muted">avant ton examen (${new Date(S.examDate).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})})</div>`
       : days === 0 ? `<div class="big">Jour J 💪</div><div class="muted">Bonne chance !</div>` : `<div class="big">✓</div><div class="muted">Date d'examen passée</div>`;
  } else cd = `<div class="muted">Indique ta date d'examen pour voir le compte à rebours.</div>`;

  app.innerHTML = `
  <section class="hero">
    <div class="panel">
      <h1>Révise ton Security+<br><span style="color:var(--accent)">SY0-701</span> efficacement.</h1>
      <p>${CARDS.length} flashcards et ${QS.length} questions réparties sur les 5 domaines officiels. Questions en anglais comme à l'examen, explications en français. Les cartes que tu connais reviennent moins souvent (répétition espacée).</p>
      <div class="row">
        <a class="btn primary" href="#/flashcards">▶ Flashcards</a>
        <a class="btn" href="#/quiz">Quiz rapide</a>
        <button class="btn" id="goExam">⏱ Examen blanc</button>
      </div>
    </div>
    <div class="panel countdown">
      ${cd}
      <label class="small muted" style="margin-top:.6rem">Date de l'examen : <input type="date" id="examDate" value="${esc(S.examDate)}"></label>
    </div>
  </section>

  <section class="grid cols3" style="margin-bottom:1.5rem">
    <div class="panel stat"><div class="n">${mast}<span class="muted" style="font-size:1rem"> / ${CARDS.length}</span></div><div class="l">cartes maîtrisées (boîte ≥ 3)</div><div class="bar"><i style="width:${pct(mast,CARDS.length)}%"></i></div></div>
    <div class="panel stat"><div class="n">${due}</div><div class="l">cartes à revoir aujourd'hui · ${seen} déjà vues</div></div>
    <div class="panel stat"><div class="n">${missed}</div><div class="l">questions ratées à retravailler</div>${missed?`<button class="btn" style="margin-top:.6rem" id="goErrors">Refaire mes erreurs</button>`:""}</div>
  </section>

  <section class="grid cols2">
    <div class="panel">
      <h3>Progression par domaine</h3>
      ${DIDS.map(d=>{
        const cs = CARDS.filter(c=>c.d===d), m = cs.filter(mastered).length;
        const qd = domainAccuracy(d);
        return `<div class="domain"><span class="dot" style="background:${DOMAINS[d].color}"></span>
          <div><div><b>${d}.</b> ${DOMAINS[d].name} <span class="muted small">· ${DOMAINS[d].w} %</span></div>
          <div class="small muted">${DOMAINS[d].en}</div>
          <div class="bar"><i style="width:${pct(m,cs.length)}%;background:${DOMAINS[d].color}"></i></div></div>
          <div class="small muted" style="text-align:right">${m}/${cs.length} cartes<br>${qd===null?"— quiz":qd+" % quiz"}</div></div>`;}).join("")}
    </div>
    <div class="panel">
      <h3>Derniers résultats</h3>
      ${hist.length ? `<table class="hist"><tr><th>Date</th><th>Mode</th><th>Score</th></tr>${hist.map(h=>`<tr><td>${new Date(h.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}</td><td>${h.mode==="exam"?"Examen blanc":h.mode==="errors"?"Erreurs":"Quiz"}</td><td>${h.correct}/${h.total} · ${pct(h.correct,h.total)} %${h.mode==="exam"?` · <b class="${h.scaled>=PASS?"pass":"fail"}">${h.scaled}</b>`:""}</td></tr>`).join("")}</table>`
        : `<p class="muted">Aucun quiz pour l'instant. Lance un quiz rapide pour voir tes points faibles.</p>`}
      <p class="small muted" style="margin-top:1rem">Examen réel : 90 questions max, 90 minutes, score de 100 à 900, réussite à 750. Le score de l'examen blanc est une estimation linéaire.</p>
      <button class="btn" id="resetBtn" style="margin-top:.4rem;font-size:.8rem">Réinitialiser ma progression</button>
    </div>
  </section>`;

  $("#examDate").onchange = e => { S.examDate = e.target.value; save(); renderHome(); };
  $("#goExam").onclick = () => goQuiz({mode:"exam", domains:DIDS});
  const ge = $("#goErrors"); if (ge) ge.onclick = () => goQuiz({mode:"errors", domains:DIDS, count:999});
  let armed = false;
  $("#resetBtn").onclick = e => {
    if (!armed){ armed = true; e.target.textContent = "Confirmer : tout effacer ?"; e.target.classList.add("bad"); return; }
    const {examDate, theme} = S; S = blank(); S.examDate = examDate; S.theme = theme; save(); renderHome();
  };
}
function domainAccuracy(d){
  let c=0,t=0; S.history.forEach(h=>{ const x=h.byDomain&&h.byDomain[d]; if(x){c+=x[0];t+=x[1];} });
  return t ? pct(c,t) : null;
}

// ══════════════ FLASHCARDS ══════════════
let fcPrefs = {domains:new Set(DIDS), mode:"due"};
function renderFlashSetup(){
  const pool = () => CARDS.filter(c=>fcPrefs.domains.has(c.d));
  const count = m => { const p = pool(); return m==="due" ? p.filter(c=>!cardState(c.id).seen || isDue(c)).length : m==="hard" ? p.filter(c=>cardState(c.id).seen && cardState(c.id).box<=1).length : p.length; };
  const draw = () => {
    app.innerHTML = `
    <div class="panel">
      <h2>Flashcards</h2>
      <p class="muted">Clique sur la carte (ou <kbd>Espace</kbd>) pour la retourner, puis indique si tu la connaissais. Les cartes sues reviennent dans 1, 2, 4, 7 puis 15 jours.</p>
      <label class="field">Domaines
        <div class="chips">${DIDS.map(d=>`<button class="chip ${fcPrefs.domains.has(d)?"on":""}" data-d="${d}"><span class="cd" style="background:${DOMAINS[d].color}"></span>${d}. ${DOMAINS[d].name}</button>`).join("")}</div>
      </label>
      <label class="field">Mode
        <div class="seg">
          <button data-m="due" class="${fcPrefs.mode==="due"?"on":""}">À réviser (${count("due")})</button>
          <button data-m="hard" class="${fcPrefs.mode==="hard"?"on":""}">Difficiles (${count("hard")})</button>
          <button data-m="all" class="${fcPrefs.mode==="all"?"on":""}">Toutes (${count("all")})</button>
        </div>
      </label>
      <button class="btn primary" id="startFc" ${count(fcPrefs.mode)?"":"disabled"}>Commencer</button>
      ${count(fcPrefs.mode)?"":`<span class="muted small" style="margin-left:.6rem">Rien à réviser ici pour l'instant 🎉 — choisis « Toutes ».</span>`}
    </div>`;
    app.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{ const d=+b.dataset.d; fcPrefs.domains.has(d)?fcPrefs.domains.delete(d):fcPrefs.domains.add(d); if(!fcPrefs.domains.size) fcPrefs.domains.add(d); draw(); });
    app.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{ fcPrefs.mode=b.dataset.m; draw(); });
    $("#startFc").onclick = () => {
      let p = pool();
      if (fcPrefs.mode==="due") p = p.filter(c=>!cardState(c.id).seen || isDue(c));
      if (fcPrefs.mode==="hard") p = p.filter(c=>cardState(c.id).seen && cardState(c.id).box<=1);
      // cartes déjà vues et en retard d'abord, puis nouvelles
      const seenFirst = shuffle(p.filter(c=>cardState(c.id).seen)), fresh = shuffle(p.filter(c=>!cardState(c.id).seen));
      runFlash([...seenFirst, ...fresh]);
    };
  };
  draw();
}

function runFlash(deck){
  let i = 0, flipped = false, known = 0, again = 0;
  const total = deck.length;
  const draw = () => {
    if (i >= deck.length){
      app.innerHTML = `<div class="panel" style="text-align:center">
        <h2>Session terminée ✓</h2>
        <p class="muted">${total} cartes · <span class="pass">${known} sues</span> · <span class="fail">${again} à revoir</span></p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="#/flashcards" id="again">Nouvelle session</a><a class="btn" href="#/quiz">Passer au quiz</a><a class="btn" href="#/">Accueil</a></div></div>`;
      $("#again").onclick = e => { e.preventDefault(); setView(renderFlashSetup); };
      return;
    }
    const c = deck[i], st = cardState(c.id);
    app.innerHTML = `
    <div class="q-head"><div class="row"><span class="pill" style="border-color:${DOMAINS[c.d].color}">D${c.d}</span><span class="muted small">${DOMAINS[c.d].name}</span></div>
      <div class="row"><span class="muted small">Boîte</span><div class="boxes">${[1,2,3,4,5].map(b=>`<i class="${st.box>=b?"f":""}"></i>`).join("")}</div><span class="muted small">${Math.min(i+1,deck.length)} / ${deck.length}</span></div></div>
    <div class="progress"><i style="width:${pct(i,deck.length)}%"></i></div>
    <div class="fc-wrap"><div class="fc ${flipped?"flipped":""}" id="card">
      <div class="face front"><span class="dlabel">${DOMAINS[c.d].en}</span><div class="term">${esc(c.front)}</div><div class="hint">Cliquer ou <kbd>Espace</kbd> pour retourner</div></div>
      <div class="face back"><span class="dlabel">${esc(c.front)}</span><div class="def">${esc(c.back)}</div><div class="hint"><kbd>1</kbd> à revoir · <kbd>2</kbd> je savais</div></div>
    </div></div>
    <div class="row" style="justify-content:center">
      <button class="btn bad" id="no" ${flipped?"":"disabled"}>✗ À revoir <kbd>1</kbd></button>
      <button class="btn" id="flip">↻ Retourner</button>
      <button class="btn ok" id="yes" ${flipped?"":"disabled"}>✓ Je savais <kbd>2</kbd></button>
    </div>
    <div class="row" style="justify-content:center;margin-top:1rem"><button class="btn" id="quit" style="font-size:.85rem">Terminer la session</button></div>`;
    const flip = () => { flipped = !flipped; $("#card").classList.toggle("flipped", flipped); $("#yes").disabled = $("#no").disabled = !flipped; };
    $("#card").onclick = flip; $("#flip").onclick = flip;
    $("#yes").onclick = () => grade(true); $("#no").onclick = () => grade(false);
    $("#quit").onclick = () => { deck = deck.slice(0,i); draw(); };
  };
  const grade = ok => {
    const c = deck[i], st = cardState(c.id);
    if (ok){ const box = Math.min(5, st.box+1); S.cards[c.id] = {box, due: Date.now()+INTERVALS[box]*DAY, seen:true}; known++; }
    else { S.cards[c.id] = {box:0, due: Date.now(), seen:true}; again++; if (deck.length - i < 200) deck.push(c); }
    save(); i++; flipped = false; draw();
  };
  const onKey = e => {
    if (e.target.tagName==="INPUT") return;
    if (e.code==="Space"){ e.preventDefault(); $("#flip") && $("#flip").click(); }
    else if (e.key==="1" && $("#no") && !$("#no").disabled) $("#no").click();
    else if (e.key==="2" && $("#yes") && !$("#yes").disabled) $("#yes").click();
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => document.removeEventListener("keydown", onKey);
  draw();
}

// ══════════════ QUIZ ══════════════
let qPrefs = {domains:new Set(DIDS), count:20, mode:"practice"};
function renderQuizSetup(){
  const missedN = Object.keys(S.missed).filter(id=>QBYID[id]).length;
  const draw = () => {
    const avail = QS.filter(q=>qPrefs.domains.has(q.d)).length;
    app.innerHTML = `
    <div class="panel">
      <h2>Quiz</h2>
      <label class="field">Mode
        <div class="seg">
          <button data-m="practice" class="${qPrefs.mode==="practice"?"on":""}">Entraînement</button>
          <button data-m="exam" class="${qPrefs.mode==="exam"?"on":""}">Examen blanc</button>
          <button data-m="errors" class="${qPrefs.mode==="errors"?"on":""}" ${missedN?"":"disabled"}>Mes erreurs (${missedN})</button>
        </div>
        <span class="small muted" style="font-weight:400">${
          qPrefs.mode==="practice" ? "Correction et explication immédiates après chaque question." :
          qPrefs.mode==="exam" ? `Conditions réelles : ${EXAM_Q} questions pondérées comme l'examen (D1 12 %, D2 22 %, D3 18 %, D4 28 %, D5 20 %), chrono ${EXAM_MIN} min, correction à la fin.` :
          "Uniquement les questions que tu as ratées. Une bonne réponse les retire de la liste."}</span>
      </label>
      ${qPrefs.mode==="practice" ? `
      <label class="field">Domaines
        <div class="chips">${DIDS.map(d=>`<button class="chip ${qPrefs.domains.has(d)?"on":""}" data-d="${d}"><span class="cd" style="background:${DOMAINS[d].color}"></span>${d}. ${DOMAINS[d].name}</button>`).join("")}</div>
      </label>
      <label class="field">Nombre de questions
        <div class="seg">${[10,20,30,50].map(n=>`<button data-n="${n}" class="${qPrefs.count===n?"on":""}">${n}</button>`).join("")}<button data-n="999" class="${qPrefs.count===999?"on":""}">Toutes (${avail})</button></div>
      </label>` : ""}
      <button class="btn primary" id="go">Commencer</button>
    </div>`;
    app.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{ qPrefs.mode=b.dataset.m; draw(); });
    app.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{ const d=+b.dataset.d; qPrefs.domains.has(d)?qPrefs.domains.delete(d):qPrefs.domains.add(d); if(!qPrefs.domains.size) qPrefs.domains.add(d); draw(); });
    app.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{ qPrefs.count=+b.dataset.n; draw(); });
    $("#go").onclick = () => startQuiz({mode:qPrefs.mode, domains:[...qPrefs.domains], count:qPrefs.count});
  };
  draw();
}

function buildExam(){
  const out = [];
  DIDS.forEach(d => {
    const want = Math.round(EXAM_Q * DOMAINS[d].w / 100);
    out.push(...shuffle(QS.filter(q=>q.d===d)).slice(0, want));
  });
  return shuffle(out);
}

function startQuiz({mode, domains, count}){
  if (cleanup) { cleanup(); cleanup = null; }
  let list;
  if (mode==="exam") list = buildExam();
  else if (mode==="errors") list = shuffle(Object.keys(S.missed).map(id=>QBYID[id]).filter(Boolean));
  else list = shuffle(QS.filter(q=>domains.includes(q.d))).slice(0, count);
  if (!list.length){ renderQuizSetup(); return; }
  // ordre des options mélangé pour chaque question
  const items = list.map(q => ({q, order: shuffle(q.o.map((_,k)=>k)), pick:null, flag:false}));
  const exam = mode==="exam";
  let i = 0, ended = false, confirmSubmit = false;
  let left = EXAM_MIN*60, timer = null;
  if (exam) timer = setInterval(() => { left--; const t=$("#timer"); if (t){ t.textContent = fmtTime(Math.max(0,left)); t.classList.toggle("low", left<600);} if (left<=0) finish(); }, 1000);

  const draw = () => {
    const it = items[i], q = it.q, locked = !exam && it.pick!==null;
    const answered = items.filter(x=>x.pick!==null).length;
    app.innerHTML = `
    <div class="q-head">
      <div class="row"><span class="pill" style="border-color:${DOMAINS[q.d].color}">D${q.d}</span><span class="muted small">Question ${i+1} / ${items.length}</span></div>
      <div class="row">${exam?`<span class="timer ${left<600?"low":""}" id="timer">${fmtTime(left)}</span>`:`<span class="muted small">${items.filter(x=>x.pick!==null && x.order[x.pick]===x.q.a).length} bonnes réponses</span>`}</div>
    </div>
    <div class="progress"><i style="width:${pct(exam?answered:i,items.length)}%"></i></div>
    <div class="panel">
      <div class="question">${esc(q.q)}</div>
      <div class="opts">${it.order.map((k,pos)=>{
        let cls = "";
        if (exam && it.pick===pos) cls = "sel";
        if (locked){ if (k===q.a) cls="right"; else if (it.pick===pos) cls="wrong"; }
        return `<button class="opt ${cls}" data-p="${pos}" ${locked?"disabled":""}><span class="k">${"ABCD"[pos]}</span><span>${esc(q.o[k])}</span></button>`;}).join("")}</div>
      ${locked?`<div class="expl"><b class="${it.order[it.pick]===q.a?"pass":"fail"}">${it.order[it.pick]===q.a?"✓ Correct":"✗ Incorrect — réponse : "+esc(q.o[q.a])}</b><br>${esc(q.e)}</div>`:""}
    </div>
    <div class="row" style="justify-content:space-between;margin-top:1rem">
      <div class="row">
        ${exam?`<button class="btn" id="prev" ${i?"":"disabled"}>← Précédente</button><button class="btn" id="flag">${it.flag?"★ Marquée":"☆ Marquer"}</button>`:`<button class="btn" id="quitQ">Arrêter</button>`}
      </div>
      <div class="row">
        ${exam?`<button class="btn ${confirmSubmit?"bad":""}" id="submit">${confirmSubmit?`Confirmer (${items.length-answered} sans réponse)`:"Terminer l'examen"}</button>`:""}
        <button class="btn primary" id="next" ${(!exam && !locked)?"disabled":""}>${i===items.length-1?(exam?"Dernière":"Voir le résultat"):"Suivante →"}</button>
      </div>
    </div>
    ${exam?`<div class="navgrid">${items.map((x,k)=>`<button data-g="${k}" class="${x.pick!==null?"ans":""} ${x.flag?"flag":""} ${k===i?"cur":""}">${k+1}</button>`).join("")}</div>
      <p class="small muted">Raccourcis : <kbd>1</kbd>–<kbd>4</kbd> répondre · <kbd>←</kbd>/<kbd>→</kbd> naviguer · <kbd>M</kbd> marquer</p>`
      :`<p class="small muted">Raccourcis : <kbd>1</kbd>–<kbd>4</kbd> répondre · <kbd>Entrée</kbd> suivante</p>`}`;

    app.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>answer(+b.dataset.p));
    $("#next").onclick = () => { if (i < items.length-1){ i++; confirmSubmit=false; draw(); } else if (!exam) finish(); };
    if (exam){
      $("#prev").onclick = () => { if(i){ i--; draw(); } };
      $("#flag").onclick = () => { it.flag = !it.flag; draw(); };
      $("#submit").onclick = () => { if (!confirmSubmit){ confirmSubmit = true; draw(); } else finish(); };
      app.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ i=+b.dataset.g; draw(); });
    } else $("#quitQ").onclick = () => { const done = items.filter(x=>x.pick!==null); if (done.length) finish(done); else { setView(renderQuizSetup); } };
  };
  const answer = pos => {
    const it = items[i];
    if (!exam && it.pick!==null) return;
    it.pick = pos; draw();
  };
  const onKey = e => {
    if (ended) return;
    const n = parseInt(e.key,10);
    if (n>=1 && n<=4){ const b = app.querySelector(`[data-p="${n-1}"]`); if (b && !b.disabled) answer(n-1); }
    else if (e.key==="Enter" || (exam && e.key==="ArrowRight")){ const b=$("#next"); if (b && !b.disabled) b.click(); }
    else if (exam && e.key==="ArrowLeft"){ const b=$("#prev"); if (b && !b.disabled) b.click(); }
    else if (exam && (e.key==="m"||e.key==="M")) $("#flag").click();
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => { document.removeEventListener("keydown", onKey); if (timer) clearInterval(timer); };

  function finish(subset){
    if (ended) return; ended = true;
    if (timer) clearInterval(timer);
    const done = subset || items;
    const byDomain = {};
    let correct = 0;
    done.forEach(x => {
      const ok = x.pick!==null && x.order[x.pick]===x.q.a;
      x.ok = ok; if (ok) correct++;
      byDomain[x.q.d] = byDomain[x.q.d] || [0,0]; byDomain[x.q.d][1]++; if (ok) byDomain[x.q.d][0]++;
      if (!ok && x.pick!==null) S.missed[x.q.id] = (S.missed[x.q.id]||0)+1; // les questions sans réponse ne comptent pas comme erreurs à retravailler
      else if (mode==="errors" || S.missed[x.q.id]) delete S.missed[x.q.id];
    });
    const scaled = Math.round(100 + 800*correct/done.length);
    S.history.push({date:Date.now(), mode, correct, total:done.length, scaled, byDomain});
    if (S.history.length > 100) S.history = S.history.slice(-100);
    save();
    renderResults(done, {mode, correct, scaled, byDomain, timeUsed: exam ? EXAM_MIN*60-Math.max(0,left) : null});
  }
  draw();
}

function renderResults(done, r){
  const total = done.length, p = pct(r.correct,total), exam = r.mode==="exam";
  const passed = exam ? r.scaled >= PASS : p >= 80;
  let onlyWrong = true;
  const draw = () => {
    const rows = done.filter(x => !onlyWrong || !x.ok);
    app.innerHTML = `
    <section class="grid cols2" style="margin-bottom:1.5rem">
      <div class="panel" style="text-align:center">
        <div class="score-ring" style="background:conic-gradient(${passed?"var(--ok)":"var(--bad)"} ${p*3.6}deg, var(--line) 0)">
          <div class="in"><div><div class="big" style="font-size:2.2rem;color:var(--text)">${exam?r.scaled:p+" %"}</div><div class="small muted">${exam?"/ 900 (estimation)":r.correct+" / "+total}</div></div></div>
        </div>
        <h2 style="margin-top:1rem" class="${passed?"pass":"fail"}">${passed?(exam?"Réussi ✓":"Très bien !"):(exam?"Pas encore — continue !":"À retravailler")}</h2>
        <p class="muted">${r.correct} bonnes réponses sur ${total}${r.timeUsed!==null?` · temps utilisé ${fmtTime(r.timeUsed)}`:""}${exam?` · seuil ${PASS}`:""}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="retry">Nouveau quiz</button><a class="btn" href="#/flashcards">Flashcards</a></div>
      </div>
      <div class="panel">
        <h3>Par domaine</h3>
        ${DIDS.filter(d=>r.byDomain[d]).map(d=>{const [c,t]=r.byDomain[d]; return `<div class="domain"><span class="dot" style="background:${DOMAINS[d].color}"></span><div>${d}. ${DOMAINS[d].name}<div class="bar"><i style="width:${pct(c,t)}%;background:${pct(c,t)>=80?"var(--ok)":pct(c,t)>=60?"var(--warn)":"var(--bad)"}"></i></div></div><div class="small">${c}/${t} · ${pct(c,t)} %</div></div>`;}).join("")}
      </div>
    </section>
    <div class="panel">
      <div class="row" style="justify-content:space-between"><h3>Correction</h3>
        <div class="seg"><button data-f="1" class="${onlyWrong?"on":""}">Erreurs (${done.filter(x=>!x.ok).length})</button><button data-f="0" class="${!onlyWrong?"on":""}">Toutes</button></div></div>
      ${rows.length ? rows.map(x=>`<div class="review-item">
        <div class="row"><span class="pill" style="border-color:${DOMAINS[x.q.d].color}">D${x.q.d}</span><b class="${x.ok?"pass":"fail"}">${x.ok?"✓":"✗"}</b></div>
        <p style="margin:.5rem 0;font-weight:500">${esc(x.q.q)}</p>
        ${!x.ok?`<div class="small fail">Ta réponse : ${x.pick===null?"(aucune)":esc(x.q.o[x.order[x.pick]])}</div>`:""}
        <div class="small pass">Bonne réponse : ${esc(x.q.o[x.q.a])}</div>
        <div class="small muted" style="margin-top:.35rem">${esc(x.q.e)}</div></div>`).join("") : `<p class="muted">Aucune erreur 🎉</p>`}
    </div>`;
    $("#retry").onclick = () => setView(renderQuizSetup);
    app.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ onlyWrong = b.dataset.f==="1"; draw(); });
  };
  draw(); window.scrollTo(0,0);
}

route();
})();
