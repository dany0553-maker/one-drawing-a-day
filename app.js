(function(){
"use strict";
var CFG=window.APP_CONFIG||{};

var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var pad=function(n){return String(n).padStart(2,"0")};
var ymd=function(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
var parse=function(s){var p=s.split("-").map(Number);return new Date(p[0],p[1]-1,p[2],12)};
var dayDiff=function(a,b){return Math.round((parse(b)-parse(a))/864e5)};
var fLong=new Intl.DateTimeFormat("he-IL",{weekday:"long",day:"numeric",month:"long"});
var fShort=new Intl.DateTimeFormat("he-IL",{day:"numeric",month:"long"});
var fMonth=new Intl.DateTimeFormat("he-IL",{month:"long",year:"numeric"});
var fCm=new Intl.DateTimeFormat("he-IL",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
var fmtLong=function(s){return fLong.format(parse(s))};
var fmtShort=function(s){return fShort.format(parse(s))};

var REACTS=["❤️","😍","🔥","👏","🤯"];
var COL={b:"var(--p0)",p:"var(--p1)",y:"var(--p2)",g:"var(--p3)",r:"var(--red)"};
var KINDS=["tri","circ","dia","half","sq","zig"];
var PALETTE=["#2aa1f0","#f58aa0","#f7b928","#35b872","#a58bff","#ff8a3d","#f0443c","#14b8a6","#a3e635","#e879f9","#b4783c","#64748b"];
var SHAPES=["tri","circ","dia","half","sq","zig"];
var BUCKET="drawings";
var START=/^\d{4}-\d{2}-\d{2}$/.test(CFG.START_DATE||"")?CFG.START_DATE:null;

var S={sb:null,uid:null,view:"boot",
  authMode:"login",authEmail:"",
  drawings:[],byId:{},names:{},starts:{},looks:{},order:[],first:null,authStart:"",
  loaded:false,err:"",lastLoad:0,
  tab:"days",filter:"all",month:null,
  lb:null,editing:false,pendingDel:null,reacting:false,pick:null,focusC:false,startModal:false,
  sheet:false,prefDate:null,ch:null,authShape:"",authColor:"",setShape:"",setColor:"",asked:false,gal:false};
var now=new Date();S.month={y:now.getFullYear(),m:now.getMonth()};
var U={items:[],busy:false,msg:"",msg2:""};

/* ---------- shapes ---------- */
function shape(kind,color,size){
  var st="fill:"+color;
  var p={
    tri:'<path d="M3 25 14 3 25 25Z"/>',
    circ:'<circle cx="14" cy="14" r="11"/>',
    dia:'<path d="M14 2 26 14 14 26 2 14Z"/>',
    half:'<path d="M2 24a12 12 0 0 1 24 0Z"/>',
    sq:'<rect x="4" y="4" width="20" height="20" rx="3" transform="rotate(12 14 14)"/>',
    zig:'<path d="M2 20 8 8 14 20 20 8 26 20" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'
  }[kind];
  if(kind==="zig")st="fill:none;stroke:"+color;
  return '<svg class="shape" viewBox="0 0 28 28" width="'+size+'" height="'+size+'" aria-hidden="true" style="'+st+'">'+p+'</svg>';
}
function strip(){
  var seq=[["tri","b"],["circ","y"],["dia","r"],["half","p"],["zig","g"],["sq","b"],["tri","p"],["circ","g"],["dia","y"],["half","r"]];
  return '<div class="strip" aria-hidden="true">'+seq.map(function(x){return shape(x[0],COL[x[1]],28)}).join("")+'</div>';
}
function pIndex(uid){return Math.max(0,Math.min(S.order.indexOf(uid),5))}
function hasLook(uid){return !!(S.looks[uid]&&S.looks[uid].k&&S.looks[uid].c)}
function kindOf(uid){return hasLook(uid)?S.looks[uid].k:KINDS[pIndex(uid)]}
function pColor(uid){return hasLook(uid)?S.looks[uid].c:"var(--p"+pIndex(uid)+")"}
function marker(uid,size){return shape(kindOf(uid),pColor(uid),size||14)}
function pickerHTML(kind,color,idp){
  var sh=SHAPES.map(function(k){return '<button type="button" class="pk-s" data-act="pk-shape" data-v="'+k+'" data-g="'+idp+'" aria-pressed="'+(k===kind)+'" aria-label="צורה">'+shape(k,color||"var(--fg)",26)+'</button>'}).join("");
  var co=PALETTE.map(function(c){return '<button type="button" class="pk-c" data-act="pk-color" data-v="'+c+'" data-g="'+idp+'" aria-pressed="'+(c===color)+'" aria-label="צבע" style="background:'+c+'"></button>'}).join("");
  return '<div class="picker" id="pk-'+idp+'"><div class="pk-prev">'+shape(kind||"tri",color||"#a4a9b8",44)+'</div><div class="pk-row">'+sh+'</div><div class="pk-row">'+co+'</div></div>';
}
function rndPick(a){return a[Math.floor(Math.random()*a.length)]}
function takenLooks(){var t={};Object.keys(S.looks).forEach(function(u){if(u!==S.uid&&hasLook(u))t[S.looks[u].k+S.looks[u].c]=1});return t}
function promptFor(date){
  var P=window.PROMPTS||[];if(!P.length)return "";
  var base=START||"2026-08-26";
  var n=dayDiff(base,date);
  return P[((n%P.length)+P.length)%P.length];
}
function nameOf(uid){var n=S.names[uid];if(n)return n;return uid===S.uid?"אני":"חבר/ה"}

/* ---------- personal start dates ---------- */
function firstOf(uid){var m=null;S.drawings.forEach(function(d){if(d.uid===uid&&(!m||d.date<m))m=d.date});return m}
function startOf(uid){
  var base=S.starts[uid]||START||null;
  var f=firstOf(uid);
  if(!base)return f||ymd(new Date());
  return (f&&f<base)?f:base;
}
function dayNum(uid,date){return Math.max(1,dayDiff(startOf(uid),date)+1)}
function missingDays(uid){
  var t=ymd(new Date()),n=0,d=parse(startOf(uid));
  while(ymd(d)<t){if(!S.byId[ymd(d)+"_"+uid])n++;d.setDate(d.getDate()+1)}
  return n;
}
function emptyText(){
  var t=ymd(new Date()),st=S.uid?startOf(S.uid):t;
  if(st<t)return "התחלת ב-"+fmtShort(st)+". אפשר להעלות את כל הציורים מהימים שעברו, ולבחור תאריך לכל ציור.";
  return "העלו את הציור הראשון שלכם והוא יופיע כאן, ליד הציורים של החבר/ה.";
}

/* ---------- images ---------- */
var urlCache={};
function pub(path){
  if(!path||!S.sb)return "";
  if(!urlCache[path])urlCache[path]=S.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return urlCache[path];
}
function thumbUrl(d){return pub(d.thumb||d.path)}
function imgTag(d,alt,full){
  return '<img src="'+esc(full?pub(d.path):thumbUrl(d))+'" alt="'+esc(alt)+'" loading="'+(full?"eager":"lazy")+'" decoding="async">';
}

/* ---------- data helpers ---------- */
function compute(){
  S.byId={};
  S.drawings.forEach(function(d){S.byId[d.id]=d});
  var set=new Set(S.drawings.map(function(d){return d.uid}));
  Object.keys(S.names).forEach(function(k){set.add(k)});
  if(S.uid)set.add(S.uid);
  S.order=Array.from(set).sort();
  var min=null;
  S.order.forEach(function(u){var s=startOf(u);if(!min||s<min)min=s});
  S.first=min;
  if(S.filter!=="all"&&!set.has(S.filter))S.filter="all";
}
function visible(){if(S.gal&&S.uid)return S.drawings.filter(function(d){return d.uid===S.uid});return S.drawings.filter(function(d){return S.filter==="all"||d.uid===S.filter})}
function lbList(){
  return visible().slice().sort(function(a,b){
    if(a.date===b.date)return S.order.indexOf(a.uid)-S.order.indexOf(b.uid);
    return a.date<b.date?1:-1;
  });
}
function count(uid){return S.drawings.filter(function(d){return d.uid===uid}).length}
function daysWord(n){return n===1?"יום אחד":n+" ימים"}
function canUpload(){return !!(S.sb&&S.uid)}

/* ---------- main render ---------- */
function render(){
  var fab=$("#fab");
  if(S.view==="setup"||S.view==="offline"||S.view==="auth"||S.view==="boot"){
    var body=S.view==="setup"?setupHTML():S.view==="offline"?offlineHTML():S.view==="auth"?authHTML():'<div class="note-box">טוען…</div>';
    $("#app").innerHTML='<header class="top"><span class="sticker">המחברת</span></header>'+body;
    fab.hidden=true;
    return;
  }
  compute();
  if(S.gal){$("#app").innerHTML=galHTML();fab.hidden=!(S.loaded&&canUpload())||S.sheet||!!S.lb;if(S.lb)renderLb();return}
  var html=headerHTML();
  if(S.err){
    html+='<div class="note-box">לא הצלחנו לטעון את הציורים כרגע. בדקו את החיבור לאינטרנט. <button class="linkbtn" data-act="reload">לנסות שוב</button></div>';
  }
  if(!S.loaded&&!S.err){
    html+='<div class="note-box">טוען את הספר…</div>';
  }else if(S.loaded){
    html+=streaksHTML()+todayHTML()+yearHTML()+controlsHTML()+(S.tab==="days"?daysHTML():calHTML());
  }
  $("#app").innerHTML=html;
  fab.hidden=!(S.loaded&&canUpload())||S.sheet||!!S.lb;
  if(S.lb)renderLb();
}

function galHTML(){
  var mine=S.drawings.filter(function(d){return d.uid===S.uid}).sort(function(a,b){return a.date<b.date?1:-1});
  var cells=mine.map(function(d){
    return '<button class="gcell" data-act="open" data-id="'+esc(d.id)+'" aria-label="'+esc(fmtShort(d.date))+'">'+imgTag(d,fmtShort(d.date))+
      '<span class="gd">'+esc(fmtShort(d.date))+'</span><span class="gn">יום '+dayNum(S.uid,d.date)+'</span></button>';
  }).join("");
  return '<header class="top2"><div class="top-r"><span class="sticker">המחברת שלי</span>'+
    '<p class="sub"><b>'+mine.length+'</b> ציורים</p></div>'+
    '<button type="button" class="sticker home" data-act="gal-close" aria-label="חזרה לבית"><svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M5 16 16 5l11 11M8 14v12h16V14" fill="none" stroke="#1d2230" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></header>'+
    (mine.length?'<div class="ggrid">'+cells+'</div>':'<div class="note-box">עוד אין ציורים. העלה את הראשון.</div>');
}
function setupHTML(){
  return '<div class="setup"><h2>עוד לא חיברנו מאגר</h2><p>פתחו את הקובץ <code>config.js</code> ומלאו את <code>SUPABASE_URL</code> ואת <code>SUPABASE_ANON_KEY</code>. ההוראות בקובץ README.</p></div>';
}
function offlineHTML(){
  return '<div class="setup"><h2>אין חיבור</h2><p>לא הצלחנו לטעון את רכיבי האפליקציה. בדקו את החיבור לאינטרנט ופתחו שוב.</p><button class="btn primary" data-act="reload">לנסות שוב</button></div>';
}
function authHTML(){
  var su=S.authMode==="signup";
  if(su&&!S.authShape){S.authShape=rndPick(SHAPES);S.authColor=rndPick(PALETTE)}
  return '<form class="auth" id="auth-form" novalidate><h2>'+(su?"פתיחת חשבון":"כניסה")+'</h2>'+
    (su?'<div class="field"><label for="a-name">איך לקרוא לך?</label><input id="a-name" name="name" type="text" autocomplete="nickname" maxlength="30"></div>'+
      '<div class="field"><label for="a-start">מתי התחלת לצייר בספר?</label><input id="a-start" name="start" type="date" max="'+ymd(new Date())+'" value="'+esc(S.authStart||ymd(new Date()))+'"><span class="hint">אם התחלת לפני היום, אחרי ההרשמה תוכל להעלות את הציורים הקודמים.</span></div>'+
      '<div class="field"><label>בחרו צורה וצבע שיסמנו אותך</label>'+pickerHTML(S.authShape,S.authColor,"auth")+'</div>':'')+
    '<div class="field"><label for="a-email">אימייל</label><input id="a-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" value="'+esc(S.authEmail)+'" dir="ltr"></div>'+
    '<div class="field"><label for="a-pw">סיסמה</label><input id="a-pw" name="password" type="password" autocomplete="'+(su?"new-password":"current-password")+'" dir="ltr"></div>'+
    '<p class="msg" id="auth-msg" role="alert"></p>'+
    '<button class="btn primary" type="submit" id="auth-go">'+(su?"יצירת חשבון":"כניסה")+'</button>'+
    '<button class="linkbtn" type="button" data-act="authmode">'+(su?"כבר יש לי חשבון":"אין לי חשבון עדיין")+'</button></form>';
}

function headerHTML(){
  var nm=S.uid?nameOf(S.uid):"";
  var dn=S.uid?dayNum(S.uid,ymd(new Date())):"";
  return '<header class="top2"><div class="top-r"><button type="button" class="sticker" data-act="gal-open" aria-label="הציורים שלי">המחברת של '+esc(nm)+' ›</button>'+
    '<p class="sub"><span><b>'+(S.uid?count(S.uid):0)+'</b> ציורים</span><button class="linkbtn" data-act="start-open">ההגדרות שלי</button><button class="linkbtn" data-act="logout">התנתקות</button></p></div>'+
    '<div class="stamp2" aria-label="יום '+dn+'"><div><b>'+dn+'</b><span>יום</span></div></div></header>';
}

/* ---------- streaks ---------- */
var MILES=[7,14,30,50,100,200,365];
var WD=["א","ב","ג","ד","ה","ו","ש"];
function streakInfo(uid){
  var set=new Set(S.drawings.filter(function(d){return d.uid===uid}).map(function(d){return d.date}));
  var today=ymd(new Date());
  var base=new Date();base.setHours(12,0,0,0);
  var drewToday=set.has(today);
  var c=new Date(base);if(!drewToday)c.setDate(c.getDate()-1);
  var cur=0;
  while(set.has(ymd(c))){cur++;c.setDate(c.getDate()-1)}
  var best=0,run=0,prev=null;
  Array.from(set).sort().forEach(function(s){
    run=(prev&&dayDiff(prev,s)===1)?run+1:1;
    if(run>best)best=run;
    prev=s;
  });
  var week=[];
  for(var i=6;i>=0;i--){
    var x=new Date(base);x.setDate(x.getDate()-i);
    var s2=ymd(x);
    week.push({date:s2,on:set.has(s2),today:i===0,dow:x.getDay()});
  }
  return {cur:cur,best:Math.max(best,cur),week:week,drewToday:drewToday};
}
function weekHTML(uid,info,big){
  var k=kindOf(uid),c=pColor(uid);
  return info.week.map(function(w){
    var inner;
    if(w.on)inner=shape(k,c,big?32:18);
    else inner='<span class="ring'+(w.today?' today':'')+'"></span>';
    if(!big)return inner;
    return '<div class="sk-wd'+(w.today?' is-today':'')+'">'+inner+(w.today?'היום':WD[w.dow])+'</div>';
  }).join("");
}
function bigStreakHTML(uid){
  var me=uid===S.uid;
  var i=streakInfo(uid),c=pColor(uid);
  var next=MILES.filter(function(m){return m>i.cur})[0];
  var badge=(i.cur>=7&&MILES.indexOf(i.cur)>=0)?'<span class="sk-badge">הגעת ל-'+i.cur+'</span>':'';
  var risk="";
  if(!i.drewToday){
    if(me)risk='<div class="sk-risk">'+(i.cur>0?'עוד לא ציירת היום. הרצף בסכנה.':'עוד לא ציירת היום. ציור היום מתחיל רצף חדש.')+'</div>';
    else risk='<div class="sk-risk soft">עוד לא '+esc(nameOf(uid))+' צייר/ה היום.</div>';
  }
  var left=next?next-i.cur:0;
  var bar=next?'<div class="sk-bar"><div class="sk-row"><span>עוד '+(left===1?'יום אחד':left+' ימים')+' ליעד של '+next+'</span><span dir="ltr">'+i.cur+' / '+next+'</span></div><div class="sk-track"><div class="sk-fill" style="width:'+Math.round(i.cur/next*100)+'%;background:'+c+'"></div></div></div>':'';
  return '<section class="sk-card">'+
    '<div class="sk-who">'+marker(uid,16)+'<span>'+esc(nameOf(uid))+'</span>'+(me?'<em class="me-tag">אני</em>':'')+'</div>'+
    '<div class="sk-main"><span class="sk-num" style="color:'+c+'">'+i.cur+'</span><span class="sk-lbl">'+(i.cur===1?'יום ברצף':'ימים ברצף')+'</span>'+badge+'</div>'+
    risk+'<div class="sk-week">'+weekHTML(uid,i,true)+'</div>'+bar+
    '<div class="sk-best">השיא: '+daysWord(i.best)+' · '+count(uid)+' ציורים</div></section>';
}
function rowStreakHTML(uid){
  var i=streakInfo(uid),c=pColor(uid);
  return '<div class="sk-r"><div class="sk-nm">'+marker(uid,14)+'<span>'+esc(nameOf(uid))+'</span></div>'+
    '<div class="sk-n" style="color:'+c+'">'+i.cur+'<small>'+(i.cur===1?'יום':'ימים')+'</small></div>'+
    '<div class="sk-mini">'+weekHTML(uid,i,false)+'</div></div>';
}
function skCard(uid){
  var i=streakInfo(uid),c=pColor(uid),me=uid===S.uid;
  var dots=i.week.map(function(w){return '<i style="background:'+(w.on?c:'var(--surface2)')+'"></i>'}).join("");
  var risk=(!i.drewToday)?'<div class="skc-r">'+(me?'עוד לא ציירת':'עוד לא היום')+'</div>':'<div class="skc-r ok">ציירת היום</div>';
  if(!i.drewToday&&!me)risk='<div class="skc-r">עוד לא היום</div>';
  if(i.drewToday&&!me)risk='<div class="skc-r ok">צייר/ה היום</div>';
  return '<div class="skc'+(me?' me':'')+'"><div class="skc-n">'+marker(uid,16)+'<span>'+esc(nameOf(uid))+'</span></div>'+
    '<div class="skc-num" style="color:'+c+'">'+i.cur+'</div><div class="skc-l">'+(i.cur===1?'יום ברצף':'ימים ברצף')+'</div>'+
    '<div class="skc-d">'+dots+'</div>'+risk+'</div>';
}
function streaksHTML(){
  if(!S.order.length)return "";
  var arr=S.order.map(function(u){return {u:u,c:streakInfo(u).cur}})
    .sort(function(a,b){return b.c-a.c||S.order.indexOf(a.u)-S.order.indexOf(b.u)});
  return '<div class="skrow">'+arr.map(function(o){return skCard(o.u)}).join("")+'</div>';
}

function todayHTML(){
  var t=ymd(new Date());
  var mine=S.uid?S.byId[t+"_"+S.uid]:null;
  var all=S.order.filter(function(u){return startOf(u)<=t});
  var done=all.filter(function(u){return !!S.byId[t+"_"+u]});
  var miss=S.uid?missingDays(S.uid):0;
  var chips=all.map(function(u){var sent=!!S.byId[t+"_"+u];return '<span class="fchip'+(sent?' on':'')+'">'+marker(u,14)+esc(nameOf(u))+'</span>'}).join("");
  var thumb=mine?'<button class="thumb" data-act="open" data-id="'+esc(mine.id)+'" aria-label="פתיחת הציור של היום">'+imgTag(mine,"הציור של היום")+'</button>':"";
  return '<section class="note"><span class="tape"></span>'+
    '<div class="p">'+esc(promptFor(t))+'</div>'+
    '<div class="note-acts"><button class="nbtn" data-act="pick">'+(mine?"החלפת הציור":"העלאת ציור")+'</button>'+thumb+'</div>'+
    (miss>0?'<button class="linkbtn dk" data-act="pick">יש '+(miss===1?'יום אחד':miss+' ימים')+' בלי ציור. להוסיף?</button>':'')+'</section>'+
    '<div class="fchips" aria-label="מי ציירו היום">'+chips+'</div>'+
    (all.length?'<div class="fcount">'+done.length+' מתוך '+all.length+' ציירו היום</div>':'');
}

function yearHTML(){
  if(!S.first)return "";
  var t=ymd(new Date());
  var start=parse(S.first);
  var off=start.getDay();
  var n=S.order.length;
  var cells="";
  for(var k=0;k<off;k++)cells+='<i class="yc blank"></i>';
  var done=0;
  for(var i=0;i<365;i++){
    var d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i,12);
    var s=ymd(d);
    var who=S.order.filter(function(u){return S.byId[s+"_"+u]});
    var part=S.order.filter(function(u){return startOf(u)<=s});
    var cls="yc"+(s>t?" future":"");
    if(who.length){
      done++;
      var col=(part.length>1&&who.length===part.length)?"var(--p2)":pColor(who[0]);
      cells+='<button class="'+cls+'" style="background:'+col+'" data-act="openday" data-date="'+s+'" aria-label="'+esc(fmtShort(s))+'"></button>';
    }else cells+='<i class="'+cls+'"></i>';
  }
  var legend=S.order.map(function(u){return '<span><i style="background:'+pColor(u)+'"></i>'+esc(nameOf(u))+'</span>'}).join("");
  if(n>1)legend+='<span><i style="background:var(--p2)"></i>כולם ציירו</span>';
  return '<section class="year"><div class="year-head"><h3>השנה שלכם</h3><span>'+done+' ימים עם ציור מתוך 365</span></div>'+
    '<div class="yg">'+cells+'</div><div class="legend">'+legend+'</div></section>';
}

function controlsHTML(){
  var chips=S.order.length>1?('<button class="chip" data-act="filter" data-u="all" aria-pressed="'+(S.filter==="all")+'">הכל</button>'+
    S.order.map(function(u){return '<button class="chip" data-act="filter" data-u="'+esc(u)+'" aria-pressed="'+(S.filter===u)+'">'+marker(u,14)+esc(nameOf(u))+'</button>'}).join("")):"";
  return '<section class="controls"><div class="ctl-row"><div class="seg" role="group" aria-label="תצוגה">'+
    '<button data-act="tab" data-t="days" aria-pressed="'+(S.tab==="days")+'">ימים</button>'+
    '<button data-act="tab" data-t="cal" aria-pressed="'+(S.tab==="cal")+'">לוח שנה</button></div>'+
    '<span class="spacer"></span>'+
    ''+
    '</div>'+(chips?'<div class="ctl-row">'+chips+'</div>':'')+'</section>';
}

function emptyHTML(){
  return '<div class="empty-state"><div class="cluster">'+shape("tri",COL.b,44)+shape("circ",COL.y,36)+shape("dia",COL.r,44)+shape("half",COL.p,36)+shape("sq",COL.g,40)+'</div>'+
    '<h2>הדף הראשון מחכה</h2><p>'+esc(emptyText())+'</p>'+
    '<button class="btn primary" data-act="pick">העלאת ציור</button></div>';
}

function qrHTML(d){
  var counts={},mine=(S.uid&&d.reactions)?d.reactions[S.uid]:"";
  Object.keys(d.reactions||{}).forEach(function(k){var e=d.reactions[k];if(e)counts[e]=(counts[e]||0)+1});
  var id=esc(d.id);
  var chips=Object.keys(counts).map(function(e){
    return '<button class="qc'+(mine===e?' me':'')+'" data-act="qreact" data-id="'+id+'" data-e="'+e+'" aria-pressed="'+(mine===e)+'">'+e+'<small>'+counts[e]+'</small></button>';
  }).join("");
  var open=S.pick===d.id;
  var picker=open?'<div class="qpick">'+REACTS.map(function(e){return '<button class="qc'+(mine===e?' me':'')+'" data-act="qreact" data-id="'+id+'" data-e="'+e+'" aria-label="תגובה '+e+'">'+e+'</button>'}).join("")+'</div>':"";
  var nc=(d.comments||[]).length;
  return '<div class="qr" data-id="'+id+'"><div class="qrow">'+chips+
    (canUpload()?'<button class="qc add" data-act="qpick" data-id="'+id+'" aria-label="'+(open?"סגירה":"הוספת אימוג׳י")+'">'+(open?'×':'☺ +')+'</button>':'')+
    '<button class="qc" data-act="open" data-focus="c" data-id="'+id+'" aria-label="תגובות">💬'+(nc?'<small>'+nc+'</small>':'')+'</button></div>'+picker+'</div>';
}
function refreshQr(d){
  var el=document.querySelector('.qr[data-id="'+d.id+'"]');
  if(el)el.outerHTML=qrHTML(d);
}

function slotHTML(date,uid){
  var d=S.byId[date+"_"+uid];
  var t=ymd(new Date());
  if(!d){
    if(uid===S.uid&&canUpload()&&date<=t&&date>=startOf(uid))
      return '<button class="slot empty add" data-act="add" data-date="'+date+'"><span class="plus" aria-hidden="true">+</span><span>להוסיף ציור</span></button>';
    return '<div class="slot empty">'+(date===t?"עוד לא העלו":"לא צויר")+'</div>';
  }
  return '<div class="tile"><button class="slot" data-act="open" data-id="'+esc(d.id)+'" aria-label="'+esc("ציור של "+nameOf(uid)+", "+fmtShort(date))+'">'+
    imgTag(d,"ציור של "+nameOf(uid))+
    '<span class="who">'+marker(uid,12)+'<b>'+esc(nameOf(uid))+'</b></span><span class="dayn">יום '+dayNum(uid,date)+'</span></button>'+
    qrHTML(d)+'</div>';
}

function daysHTML(){
  var vis=visible();
  if(!vis.length)return emptyHTML();
  var dates=Array.from(new Set(vis.map(function(d){return d.date}))).sort().reverse();
  var persons=S.filter==="all"?S.order:[S.filter];
  var t=ymd(new Date());
  return '<section class="feed">'+dates.map(function(date){
    var ps=persons.filter(function(u){return startOf(u)<=date});
    var mn=(S.uid&&startOf(S.uid)<=date)?'יום '+dayNum(S.uid,date)+' שלך':'';
    return '<article class="day"><div class="day-head"><h3>'+esc(fmtLong(date))+(date===t?'<span class="tag-today">היום</span>':'')+'</h3><span class="dn">'+mn+'</span></div>'+
      '<div class="slots" style="--n:'+Math.min(ps.length,3)+'">'+ps.map(function(u){return slotHTML(date,u)}).join("")+'</div></article>';
  }).join("")+'</section>';
}

function calHTML(){
  var y=S.month.y,m=S.month.m;
  var first=new Date(y,m,1,12);
  var days=new Date(y,m+1,0).getDate();
  var t=ymd(new Date());
  var persons=S.filter==="all"?S.order:[S.filter];
  var h='<div class="cal-nav"><button class="icon" data-act="month" data-d="-1" aria-label="חודש קודם">›</button><h3>'+esc(fMonth.format(first))+'</h3><button class="icon" data-act="month" data-d="1" aria-label="חודש הבא">‹</button></div><div class="cal">';
  ["א","ב","ג","ד","ה","ו","ש"].forEach(function(x){h+='<div class="dow">'+x+'</div>'});
  for(var i=0;i<first.getDay();i++)h+='<div class="cell blank"></div>';
  for(var d=1;d<=days;d++){
    var s=y+"-"+pad(m+1)+"-"+pad(d);
    var ds=persons.map(function(u){return S.byId[s+"_"+u]}).filter(Boolean);
    var cls="cell"+(s===t?" today-c":"");
    if(ds.length){
      h+='<button class="'+cls+'" data-act="openday" data-date="'+s+'" aria-label="'+esc(fmtShort(s))+'"><span class="th">'+
        ds.map(function(x){return '<i style="background-image:url(&quot;'+esc(thumbUrl(x))+'&quot;)"></i>'}).join("")+'</span><span class="n">'+d+'</span></button>';
    }else if(S.uid&&s<=t&&!S.byId[s+"_"+S.uid]&&s>=startOf(S.uid)){
      h+='<button class="'+cls+' plain addable" data-act="add" data-date="'+s+'" aria-label="הוספת ציור ל-'+esc(fmtShort(s))+'"><span class="n">'+d+'</span></button>';
    }else{
      h+='<div class="'+cls+' plain"><span class="n">'+d+'</span></div>';
    }
  }
  return h+'</div>';
}

/* ---------- lightbox ---------- */
function openLb(id){
  S.lb=id;S.editing=false;S.pendingDel=null;
  document.body.style.overflow="hidden";
  $("#fab").hidden=true;
  renderLb();
  if(S.focusC){S.focusC=false;var ci=$("#cm-in");if(ci){ci.scrollIntoView({block:"center"});ci.focus()}}else{var c=$("#lb-root .lb-close");if(c)c.focus()}
}
function closeLb(){
  S.lb=null;S.editing=false;S.pendingDel=null;
  $("#lb-root").innerHTML="";
  document.body.style.overflow=S.sheet?"hidden":"";
  $("#fab").hidden=!(S.loaded&&canUpload())||S.sheet;
}
function renderLb(){
  if(S.editing)return;
  var list=lbList();
  var i=list.findIndex(function(d){return d.id===S.lb});
  if(i<0){closeLb();return}
  var d=list[i];
  var mine=d.uid===S.uid;
  var cin=$("#cm-in");
  var keep=cin?{v:cin.value,f:document.activeElement===cin}:null;
  var counts={},mineR=S.uid&&d.reactions?d.reactions[S.uid]:"";
  Object.keys(d.reactions||{}).forEach(function(k){var e=d.reactions[k];if(e)counts[e]=(counts[e]||0)+1});
  var n=dayNum(d.uid,d.date);
  var react=REACTS.map(function(e){
    return '<button class="react" data-act="react" data-e="'+e+'" aria-pressed="'+(mineR===e)+'" aria-label="תגובה '+e+'">'+e+(counts[e]?'<small>'+counts[e]+'</small>':'')+'</button>';
  }).join("");
  var cms=(d.comments||[]).map(function(c){
    var can=(c.uid===S.uid||d.uid===S.uid)&&canUpload();
    return '<div class="cm"><div class="cm-h"><span class="cm-n">'+marker(c.uid,11)+esc(nameOf(c.uid))+'</span><span class="cm-t">'+esc(fCm.format(new Date(c.at)))+'</span>'+
      (can?'<button class="cm-x" data-act="cmdel" data-cid="'+esc(c.id)+'" aria-label="מחיקת תגובה">×</button>':'')+'</div><p class="cm-b">'+esc(c.body)+'</p></div>';
  }).join("");
  var form=canUpload()?'<form class="cm-form" id="cm-form"><input id="cm-in" class="note-in" maxlength="200" placeholder="כתבו תגובה…" autocomplete="off" aria-label="תגובה"><button class="btn primary" type="submit">שליחה</button></form>':"";
  var acts="";
  if(mine&&canUpload()){
    acts='<button class="btn" data-act="editnote">'+(d.note?"עריכת הערה":"הוספת הערה")+'</button>'+
      '<button class="btn'+(S.pendingDel===d.id?' danger':'')+'" data-act="delete">'+(S.pendingDel===d.id?"לחצו שוב למחיקה":"מחיקה")+'</button>';
  }
  $("#lb-root").innerHTML='<div class="lb" data-act="lb-bg" role="dialog" aria-modal="true" aria-label="ציור"><div class="lb-box">'+
    '<div class="lb-top"><button class="icon lb-close" data-act="lb-close" aria-label="סגירה">×</button><span class="pos">'+(i+1)+' / '+list.length+'</span></div>'+
    '<div class="lb-stage"><button class="nav" data-act="prev" aria-label="הקודם"'+(i===0?" disabled":"")+'>›</button>'+
    imgTag(d,"ציור של "+nameOf(d.uid),true)+
    '<button class="nav" data-act="next" aria-label="הבא"'+(i===list.length-1?" disabled":"")+'>‹</button></div>'+
    '<div class="lb-info"><div class="lb-meta"><span class="pill">'+marker(d.uid,14)+esc(nameOf(d.uid))+'</span><span class="lb-date">'+esc(fmtLong(d.date))+' · יום '+n+'</span></div>'+
    '<p class="lb-note'+(d.note?"":" none")+'">'+(d.note?esc(d.note):"אין הערה")+'</p>'+
    '<div class="reacts">'+react+'</div>'+
    (cms?'<div class="cms">'+cms+'</div>':'')+form+
    (acts?'<div class="lb-acts">'+acts+'</div>':"")+'</div></div></div>';
  if(keep){var ni=$("#cm-in");if(ni){ni.value=keep.v;if(keep.f)ni.focus()}}
}
function lbStep(dir){
  var list=lbList();
  var i=list.findIndex(function(d){return d.id===S.lb});
  var j=i+dir;
  if(j<0||j>=list.length)return;
  S.lb=list[j].id;S.editing=false;S.pendingDel=null;renderLb();
}

/* ---------- toast ---------- */
var toastTimer=null;
function toast(msg){
  var r=$("#toast-root");
  r.innerHTML='<div class="toast" role="status">'+esc(msg)+'</div>';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){r.innerHTML=""},3200);
}

/* ---------- supabase helpers ---------- */
function transient(e){
  var m=((e&&e.message)||"")+" "+((e&&e.status)||"");
  return /fetch|network|timeout|timed out|failed|429|502|503|504/i.test(m);
}
async function run(fn){
  for(var a=0;;a++){
    var r;
    try{r=await fn()}catch(e){r={error:e}}
    if(!r||!r.error)return r?r.data:null;
    if(a<3&&transient(r.error)){await new Promise(function(res){setTimeout(res,2000*(a+1))});continue}
    throw r.error;
  }
}

/* ---------- load + realtime ---------- */
async function loadAll(){
  if(!S.sb||!S.uid)return;
  try{
    var res=await Promise.all([
      run(function(){return S.sb.from("drawings").select("*").order("date",{ascending:false}).limit(2000)}),
      run(function(){return S.sb.from("reactions").select("*").limit(10000)}),
      run(function(){return S.sb.from("profiles").select("id,name,start_date,shape,color")}).catch(function(){return run(function(){return S.sb.from("profiles").select("id,name,start_date")})}),
      run(function(){return S.sb.from("comments").select("*").order("created_at",{ascending:true}).limit(5000)})
    ]);
    var rx={},cm={};
    (res[3]||[]).forEach(function(c){(cm[c.drawing_id]=cm[c.drawing_id]||[]).push({id:c.id,uid:c.user_id,body:c.body,at:c.created_at})});
    (res[1]||[]).forEach(function(r){(rx[r.drawing_id]=rx[r.drawing_id]||{})[r.user_id]=r.emoji});
    S.drawings=(res[0]||[]).map(function(r){
      return {id:r.date+"_"+r.user_id,uuid:r.id,uid:r.user_id,date:r.date,path:r.image_path,thumb:r.thumb_path,note:r.note||"",reactions:rx[r.id]||{},comments:cm[r.id]||[]};
    });
    S.names={};
    S.starts={};S.looks={};
    (res[2]||[]).forEach(function(p){S.names[p.id]=p.name||"";if(p.start_date)S.starts[p.id]=p.start_date;
      if(p.shape&&p.color&&SHAPES.indexOf(p.shape)>=0&&/^#[0-9a-fA-F]{6}$/.test(p.color))S.looks[p.id]={k:p.shape,c:p.color}});
    S.loaded=true;S.err="";S.lastLoad=Date.now();
    if(!S.asked&&S.uid&&!hasLook(S.uid)){S.asked=true;setTimeout(function(){openStart(true)},300)}
  }catch(e){
    S.err="load";
  }
  render();
}
var loadTimer=null;
function schedLoad(){clearTimeout(loadTimer);loadTimer=setTimeout(loadAll,500)}
function startRealtime(){
  stopRealtime();
  try{
    S.ch=S.sb.channel("rt-drawings")
      .on("postgres_changes",{event:"*",schema:"public",table:"drawings"},schedLoad)
      .on("postgres_changes",{event:"*",schema:"public",table:"reactions"},schedLoad)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},schedLoad)
      .subscribe();
  }catch(e){}
}
function stopRealtime(){
  try{if(S.ch&&S.sb)S.sb.removeChannel(S.ch)}catch(e){}
  S.ch=null;
}

/* ---------- reactions, notes, delete ---------- */
async function doReact(emoji,id){
  if(!S.sb||!S.uid||S.reacting)return;
  var d=S.byId[id||S.lb];if(!d)return;
  d.reactions=d.reactions||{};
  var cur=d.reactions[S.uid];
  var remove=(cur===emoji);
  var prev=cur;
  if(remove)delete d.reactions[S.uid];else d.reactions[S.uid]=emoji;
  refreshQr(d);if(S.lb)renderLb();
  S.reacting=true;
  try{
    if(remove)await run(function(){return S.sb.from("reactions").delete().eq("drawing_id",d.uuid).eq("user_id",S.uid)});
    else await run(function(){return S.sb.from("reactions").upsert({drawing_id:d.uuid,user_id:S.uid,emoji:emoji},{onConflict:"drawing_id,user_id"})});
  }catch(e){
    if(prev)d.reactions[S.uid]=prev;else delete d.reactions[S.uid];
    refreshQr(d);if(S.lb)renderLb();
    toast("לא הצלחנו לשמור את התגובה");
  }
  S.reacting=false;
}
async function doComment(){
  var d=S.byId[S.lb];var inp=$("#cm-in");
  if(!d||!inp||!S.uid)return;
  var v=inp.value.trim().slice(0,200);
  if(!v)return;
  inp.disabled=true;
  try{
    var row=await run(function(){return S.sb.from("comments").insert({drawing_id:d.uuid,body:v}).select().single()});
    (d.comments=d.comments||[]).push({id:row.id,uid:S.uid,body:v,at:row.created_at});
    inp.value="";
    renderLb();refreshQr(d);
    var ni=$("#cm-in");if(ni)ni.focus();
  }catch(e){
    inp.disabled=false;
    toast("לא הצלחנו לשלוח את התגובה");
  }
}
async function delComment(cid){
  var d=S.byId[S.lb];if(!d)return;
  try{
    await run(function(){return S.sb.from("comments").delete().eq("id",cid)});
    d.comments=(d.comments||[]).filter(function(c){return c.id!==cid});
    renderLb();refreshQr(d);
  }catch(e){toast("המחיקה לא הצליחה")}
}
function startEdit(){
  var d=S.byId[S.lb];if(!d)return;
  S.editing=true;
  var info=$("#lb-root .lb-info");
  var box=document.createElement("div");
  box.innerHTML='<label for="note-edit" class="lb-date">הערה</label><textarea id="note-edit" class="note-in" rows="3" maxlength="140"></textarea><div class="lb-acts" style="margin-top:8px"><button class="btn primary" data-act="savenote">שמירה</button><button class="btn" data-act="cancelnote">ביטול</button></div>';
  info.querySelector(".lb-note").replaceWith(box);
  var ta=box.querySelector("textarea");ta.value=d.note||"";ta.focus();
  var acts=info.querySelector(":scope > .lb-acts");if(acts)acts.hidden=true;
}
async function saveNote(){
  var d=S.byId[S.lb];var ta=$("#note-edit");if(!d||!ta)return;
  var v=ta.value.trim().slice(0,140);
  try{
    await run(function(){return S.sb.from("drawings").update({note:v}).eq("id",d.uuid)});
    d.note=v;toast("ההערה נשמרה");
  }catch(e){toast("לא הצלחנו לשמור את ההערה")}
  S.editing=false;renderLb();
}
var delTimer=null;
async function doDelete(){
  var d=S.byId[S.lb];if(!d||d.uid!==S.uid)return;
  if(S.pendingDel!==d.id){
    S.pendingDel=d.id;renderLb();
    clearTimeout(delTimer);delTimer=setTimeout(function(){S.pendingDel=null;if(S.lb)renderLb()},4000);
    return;
  }
  var list=lbList();var i=list.findIndex(function(x){return x.id===d.id});
  var nextId=(list[i+1]||list[i-1]||{}).id||null;
  try{
    await run(function(){return S.sb.from("drawings").delete().eq("id",d.uuid)});
    var files=[d.path,d.thumb].filter(Boolean);
    if(files.length)S.sb.storage.from(BUCKET).remove(files).catch(function(){});
    S.drawings=S.drawings.filter(function(x){return x.id!==d.id});
    toast("הציור נמחק");
    S.pendingDel=null;
    compute();
    if(nextId){S.lb=nextId;renderLb()}else closeLb();
    render();
  }catch(e){toast("המחיקה לא הצליחה")}
}

/* ---------- upload sheet ---------- */
function openSheetWith(files){
  var arr=Array.from(files).filter(function(f){return /^image\//.test(f.type)||/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name)});
  if(!arr.length){toast("בחרו קובץ תמונה");return}
  var today=ymd(new Date());
  var multi=arr.length>1;
  arr.forEach(function(f){
    var date=today;
    if(S.prefDate&&!multi)date=S.prefDate;
    else if(multi&&f.lastModified){var l=ymd(new Date(f.lastModified));date=l>today?today:l}
    U.items.push({file:f,url:URL.createObjectURL(f),date:date,note:""});
  });
  U.items.sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:0)});
  S.prefDate=null;U.msg="";
  S.sheet=true;document.body.style.overflow="hidden";
  $("#fab").hidden=true;
  renderSheet();
}
function closeSheet(){
  U.items.forEach(function(it){try{URL.revokeObjectURL(it.url)}catch(e){}});
  U.items=[];U.msg="";U.msg2="";U.busy=false;S.sheet=false;
  $("#sheet-root").innerHTML="";
  document.body.style.overflow=S.lb?"hidden":"";
  $("#fab").hidden=!(S.loaded&&canUpload())||!!S.lb;
}
function warnText(it){
  return (S.uid&&S.byId[it.date+"_"+S.uid])?"כבר יש ציור שלך בתאריך הזה. הוא יוחלף.":"";
}
function renderSheet(){
  var t=ymd(new Date());
  var items=U.items.map(function(it,i){
    return '<div class="item"><img class="pv" src="'+esc(it.url)+'" alt="תצוגה מקדימה" loading="lazy" decoding="async"><div class="f">'+
      '<div><label for="d'+i+'">תאריך</label><input class="note-in" type="date" id="d'+i+'" data-i="'+i+'" data-k="date" value="'+esc(it.date)+'" max="'+t+'"></div>'+
      '<div><label for="n'+i+'">הערה (לא חובה)</label><input class="note-in" type="text" id="n'+i+'" data-i="'+i+'" data-k="note" maxlength="140" value="'+esc(it.note)+'" placeholder="על מה זה?"></div>'+
      '<span class="warn" id="w'+i+'">'+esc(warnText(it))+'</span>'+
      '<button class="rm" data-act="rmitem" data-i="'+i+'">הסרה</button></div></div>';
  }).join("");
  var body=U.items.length?'<div class="items">'+items+'</div>':'<div class="dropzone"><span>לא נבחרו תמונות</span><button class="btn" data-act="pick">בחירת תמונה</button></div>';
  $("#sheet-root").innerHTML='<div class="sheet" data-act="sheet-bg"><div class="sheet-box" role="dialog" aria-modal="true" aria-label="ציור חדש">'+
    '<div class="sheet-head"><h2>ציור חדש</h2><button class="icon" data-act="sheet-close" aria-label="סגירה">×</button></div>'+
    body+(U.msg?'<p class="msg" role="alert">'+esc(U.msg)+'</p>':"")+
    '<div class="sheet-foot"><button class="btn" data-act="pick"'+(U.busy?" disabled":"")+'>הוספת עוד</button>'+
    '<button class="btn primary" data-act="save"'+((U.busy||!U.items.length)?" disabled":"")+'>'+(U.busy?esc(U.msg2||"מעלה…"):(U.items.length>1?"שמירת "+U.items.length+" ציורים":"שמירה"))+'</button></div></div></div>';
}
async function decode(file){
  try{return await createImageBitmap(file,{imageOrientation:"from-image"})}catch(e){}
  try{return await createImageBitmap(file)}catch(e){}
  return await new Promise(function(res,rej){
    var im=new Image();
    var u=URL.createObjectURL(file);
    im.onload=function(){URL.revokeObjectURL(u);res(im)};
    im.onerror=function(){URL.revokeObjectURL(u);rej(new Error("decode"))};
    im.src=u;
  });
}
function toJpeg(src,max,q){
  var w0=src.width||src.naturalWidth,h0=src.height||src.naturalHeight;
  var sc=Math.min(1,max/Math.max(w0,h0));
  var w=Math.round(w0*sc),h=Math.round(h0*sc);
  var c=document.createElement("canvas");c.width=w;c.height=h;
  var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(src,0,0,w,h);
  return new Promise(function(r){c.toBlob(r,"image/jpeg",q)});
}
function errMsg(e){
  var m=((e&&e.message)||"")+"";
  if(m==="decode")return "לא הצלחנו לקרוא את התמונה. נסו קובץ JPG או PNG.";
  if(/maximum allowed size|too large|413/i.test(m))return "הקובץ גדול מדי.";
  if(/row-level security|violates|not authorized|jwt/i.test(m))return "אין הרשאה לשמור. התנתקו והתחברו שוב.";
  if(/quota|storage limit|exceeded/i.test(m))return "נגמר המקום באחסון.";
  return "ההעלאה לא הצליחה. נסו שוב.";
}
async function saveItems(){
  if(U.busy||!canUpload())return;
  for(var k=0;k<U.items.length;k++){if(!U.items[k].date){U.msg="חסר תאריך באחד הציורים.";renderSheet();return}}
  U.busy=true;U.msg="";
  var total=U.items.length,doneN=0;
  while(U.items.length){
    var it=U.items[0];
    U.msg2="מעלה "+(doneN+1)+" מתוך "+total+"…";
    if(doneN===0)renderSheet();else{var sb=$('#sheet-root [data-act="save"]');if(sb)sb.textContent=U.msg2}
    var uploaded=[];
    try{
      var bmp=await decode(it.file);
      var full=await toJpeg(bmp,1800,0.86);
      var thumb=await toJpeg(bmp,520,0.8);
      if(bmp.close)try{bmp.close()}catch(e){}
      if(!full||!thumb)throw new Error("decode");
      var base=S.uid+"/"+it.date+"-"+Date.now();
      var pPath=base+".jpg",tPath=base+"-t.jpg";
      await run(function(){return S.sb.storage.from(BUCKET).upload(pPath,full,{contentType:"image/jpeg",cacheControl:"31536000",upsert:false})});
      uploaded.push(pPath);
      await run(function(){return S.sb.storage.from(BUCKET).upload(tPath,thumb,{contentType:"image/jpeg",cacheControl:"31536000",upsert:false})});
      uploaded.push(tPath);
      var old=S.byId[it.date+"_"+S.uid];
      await run(function(){return S.sb.from("drawings").upsert({user_id:S.uid,date:it.date,image_path:pPath,thumb_path:tPath,note:it.note.trim().slice(0,140)},{onConflict:"user_id,date"})});
      if(old){
        var gone=[old.path,old.thumb].filter(Boolean);
        if(gone.length)S.sb.storage.from(BUCKET).remove(gone).catch(function(){});
      }
      try{URL.revokeObjectURL(it.url)}catch(e){}
      U.items.shift();doneN++;
      var nd=$("#sheet-root .item");if(nd)nd.remove();
    }catch(e){
      if(uploaded.length)S.sb.storage.from(BUCKET).remove(uploaded).catch(function(){});
      U.busy=false;U.msg=errMsg(e);U.msg2="";renderSheet();
      if(doneN)loadAll();
      return;
    }
  }
  U.busy=false;
  closeSheet();
  S.tab="days";
  await loadAll();
  toast(doneN>1?"הציורים נשמרו":"הציור נשמר");
  window.scrollTo(0,0);
}

/* ---------- start date ---------- */
function startRoot(){
  var r=document.getElementById("start-root");
  if(!r){r=document.createElement("div");r.id="start-root";document.body.appendChild(r)}
  return r;
}
function openStart(first){
  if(!S.uid)return;
  S.startModal=true;document.body.style.overflow="hidden";
  var t=ymd(new Date());
  var lk=S.looks[S.uid]||{};
  S.setShape=lk.k||rndPick(SHAPES);
  S.setColor=lk.c||rndPick(PALETTE);
  startRoot().innerHTML='<div class="sheet" data-act="start-bg"><div class="sheet-box" role="dialog" aria-modal="true" aria-label="ההגדרות שלי">'+
    '<div class="sheet-head"><h2>'+(first===true?"בחרו צורה וצבע":"ההגדרות שלי")+'</h2><button class="icon" data-act="start-close" aria-label="סגירה">×</button></div>'+
    '<p class="hint">הצורה והצבע שלך מסמנים אותך בכל מקום באפליקציה, והם לא ישתנו כשמצטרפים אחרים.</p>'+
    pickerHTML(S.setShape,S.setColor,"set")+
    '<div><label for="start-in" class="lb-date">תאריך הציור הראשון</label><input id="start-in" class="note-in" type="date" max="'+t+'" value="'+esc(startOf(S.uid))+'"></div>'+
    '<p class="msg" id="start-msg" role="alert"></p>'+
    '<div class="sheet-foot"><button class="btn" data-act="start-close">ביטול</button><button class="btn primary" data-act="start-save">שמירה</button></div></div></div>';
}
function closeStart(){
  S.startModal=false;startRoot().innerHTML="";
  document.body.style.overflow=(S.lb||S.sheet)?"hidden":"";
}
async function saveStart(){
  var inp=$("#start-in"),msg=$("#start-msg");
  var v=inp?inp.value:"";
  if(!v||v>ymd(new Date())){msg.textContent="בחרו תאריך שאינו בעתיד.";return}
  try{
    await run(function(){return S.sb.from("profiles").update({start_date:v,shape:S.setShape,color:S.setColor}).eq("id",S.uid)});
    S.starts[S.uid]=v;S.looks[S.uid]={k:S.setShape,c:S.setColor};
    closeStart();render();
    toast("נשמר");
  }catch(e){msg.textContent="לא הצלחנו לשמור. ודאו שהרצתם את העדכון ב-Supabase ונסו שוב."}
}
function pkRefresh(g){
  var kind=g==="set"?S.setShape:S.authShape,color=g==="set"?S.setColor:S.authColor;
  var el=document.getElementById("pk-"+g);if(!el)return;
  var tmp=document.createElement("div");tmp.innerHTML=pickerHTML(kind,color,g);
  el.parentNode.replaceChild(tmp.firstChild,el);
}

/* ---------- auth ---------- */
function authErr(e){
  var m=((e&&e.message)||"")+"";
  if(/invalid login/i.test(m))return "האימייל או הסיסמה שגויים.";
  if(/already registered|already been registered/i.test(m))return "כבר יש חשבון עם האימייל הזה. עברו לכניסה.";
  if(/at least|weak|short/i.test(m))return "הסיסמה קצרה מדי. צריך לפחות 6 תווים.";
  if(/not confirmed/i.test(m))return "צריך לאשר את האימייל. ב-Supabase אפשר לכבות את אישור האימייל.";
  if(/signups? (are )?(not allowed|disabled)/i.test(m))return "ההרשמה סגורה.";
  if(/valid email|invalid email|email address/i.test(m))return "כתובת האימייל לא תקינה.";
  if(/rate limit/i.test(m))return "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.";
  if(transient(e))return "אין חיבור. נסו שוב.";
  return "משהו השתבש. נסו שוב.";
}
async function doAuth(form){
  var msg=$("#auth-msg"),btn=$("#auth-go");
  var email=form.email.value.trim(),pw=form.password.value;
  var name=form.name?form.name.value.trim():"";
  var start=form.start?form.start.value:"";
  S.authEmail=email;
  if(!email||!pw){msg.textContent="צריך אימייל וסיסמה.";return}
  if(S.authMode==="signup"&&!name){msg.textContent="איך לקרוא לך?";return}
  if(S.authMode==="signup"&&(!start||start>ymd(new Date()))){msg.textContent="בחרו תאריך התחלה שאינו בעתיד.";return}
  msg.textContent="";btn.disabled=true;
  try{
    var r;
    if(S.authMode==="signup"){
      r=await S.sb.auth.signUp({email:email,password:pw,options:{data:{name:name,start_date:start,shape:S.authShape,color:S.authColor}}});
      if(!r.error&&!r.data.session){
        msg.textContent="החשבון נוצר, אבל צריך לאשר את האימייל לפני כניסה.";
        btn.disabled=false;return;
      }
    }else{
      r=await S.sb.auth.signInWithPassword({email:email,password:pw});
    }
    if(r.error){msg.textContent=authErr(r.error);btn.disabled=false}
  }catch(e){msg.textContent=authErr(e);btn.disabled=false}
}
function onSession(sess){
  if(sess&&sess.user){
    if(S.uid===sess.user.id&&S.view==="app")return;
    S.uid=sess.user.id;S.view="app";S.loaded=false;S.err="";
    render();loadAll();startRealtime();
  }else{
    S.uid=null;S.view="auth";S.drawings=[];S.names={};S.loaded=false;
    stopRealtime();closeLbSilent();render();
  }
}
function closeLbSilent(){S.lb=null;S.sheet=false;$("#lb-root").innerHTML="";$("#sheet-root").innerHTML="";document.body.style.overflow=""}

/* ---------- events ---------- */
document.addEventListener("error",function(e){if(e.target&&e.target.tagName==="IMG")e.target.classList.add("broken")},true);

document.addEventListener("submit",function(e){
  if(e.target&&e.target.id==="auth-form"){e.preventDefault();doAuth(e.target)}
  if(e.target&&e.target.id==="cm-form"){e.preventDefault();doComment()}
});
document.addEventListener("input",function(e){
  var t=e.target;
  if(t&&t.id==="a-email"){S.authEmail=t.value;return}
  if(t&&t.id==="a-start"){S.authStart=t.value;return}
  if(!t.matches||!t.matches("[data-i][data-k]"))return;
  var i=Number(t.getAttribute("data-i")),k=t.getAttribute("data-k");
  var it=U.items[i];if(!it)return;
  it[k]=t.value;
  if(k==="date"){var w=$("#w"+i);if(w)w.textContent=warnText(it)}
});

document.addEventListener("click",function(e){
  var pk=e.target.closest&&e.target.closest("[data-act='pk-shape'],[data-act='pk-color']");
  if(pk){
    var g=pk.getAttribute("data-g"),v=pk.getAttribute("data-v"),isS=pk.getAttribute("data-act")==="pk-shape";
    if(g==="set"){if(isS)S.setShape=v;else S.setColor=v}else{if(isS)S.authShape=v;else S.authColor=v}
    pkRefresh(g);return;
  }
  var el=e.target.closest("[data-act]");
  if(!el)return;
  var a=el.getAttribute("data-act");
  if(a==="lb-bg"||a==="sheet-bg"||a==="start-bg"){
    if(e.target!==el)return;
    if(a==="lb-bg")closeLb();else if(a==="start-bg")closeStart();else if(!U.busy)closeSheet();
    return;
  }
  switch(a){
    case "reload":location.reload();break;
    case "authmode":S.authMode=S.authMode==="login"?"signup":"login";render();break;
    case "logout":if(S.sb)S.sb.auth.signOut();break;
    case "tab":S.tab=el.getAttribute("data-t");render();break;
    case "filter":S.filter=el.getAttribute("data-u");render();break;
    case "gal-open":S.gal=true;window.scrollTo(0,0);render();break;
    case "gal-close":S.gal=false;window.scrollTo(0,0);render();break;
    case "open":S.focusC=el.getAttribute("data-focus")==="c";openLb(el.getAttribute("data-id"));break;
    case "openday":
      var date=el.getAttribute("data-date");
      var f=lbList().filter(function(d){return d.date===date})[0]||S.drawings.filter(function(d){return d.date===date})[0];
      if(f){if(S.filter!=="all"&&f.uid!==S.filter){S.filter="all"}openLb(f.id)}
      break;
    case "add":S.prefDate=el.getAttribute("data-date");$("#file-input").click();break;
    case "pick":$("#file-input").click();break;
    case "month":
      var m=S.month.m+Number(el.getAttribute("data-d")),y=S.month.y;
      if(m<0){m=11;y--}else if(m>11){m=0;y++}
      S.month={y:y,m:m};render();break;
    case "qreact":S.pick=null;doReact(el.getAttribute("data-e"),el.getAttribute("data-id"));break;
    case "qpick":
      var qid=el.getAttribute("data-id"),prevPick=S.pick;
      S.pick=(prevPick===qid)?null:qid;
      if(prevPick&&prevPick!==qid&&S.byId[prevPick])refreshQr(S.byId[prevPick]);
      if(S.byId[qid])refreshQr(S.byId[qid]);
      break;
    case "cmdel":delComment(el.getAttribute("data-cid"));break;
    case "start-open":openStart();break;
    case "start-close":closeStart();break;
    case "start-save":saveStart();break;
    case "lb-close":closeLb();break;
    case "prev":lbStep(-1);break;
    case "next":lbStep(1);break;
    case "react":doReact(el.getAttribute("data-e"));break;
    case "editnote":startEdit();break;
    case "savenote":saveNote();break;
    case "cancelnote":S.editing=false;renderLb();break;
    case "delete":doDelete();break;
    case "sheet-close":if(!U.busy)closeSheet();break;
    case "rmitem":
      var i=Number(el.getAttribute("data-i"));
      var it=U.items[i];if(it){try{URL.revokeObjectURL(it.url)}catch(x){}U.items.splice(i,1)}
      if(!U.items.length)U.msg="";
      renderSheet();break;
    case "save":saveItems();break;
  }
});

$("#file-input").addEventListener("change",function(e){
  var files=e.target.files;
  if(files&&files.length)openSheetWith(files);
  e.target.value="";
});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    if(S.startModal){closeStart();return}
    if(S.sheet&&!U.busy){closeSheet();return}
    if(S.lb){if(S.editing){S.editing=false;renderLb()}else closeLb()}
    return;
  }
  if(S.lb&&!S.editing&&!S.sheet){
    if(e.key==="ArrowLeft")lbStep(1);
    else if(e.key==="ArrowRight")lbStep(-1);
  }
});

var tx=null;
document.addEventListener("touchstart",function(e){if(S.lb&&!S.editing&&e.touches.length===1)tx=e.touches[0].clientX;else tx=null},{passive:true});
document.addEventListener("touchend",function(e){
  if(tx==null||!S.lb)return;
  var dx=e.changedTouches[0].clientX-tx;tx=null;
  if(Math.abs(dx)>60)lbStep(dx<0?1:-1);
},{passive:true});

document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="visible"&&S.view==="app"&&!S.sheet&&Date.now()-S.lastLoad>30000)loadAll();
});

/* ---------- boot ---------- */
async function init(){
  render();
  var url=CFG.SUPABASE_URL||"",key=CFG.SUPABASE_ANON_KEY||"";
  if(!url||!key||/YOUR_/.test(url)||/YOUR_/.test(key)){S.view="setup";render();return}
  if(!window.supabase||!window.supabase.createClient){S.view="offline";render();return}
  try{
    S.sb=window.supabase.createClient(url,key);
    S.sb.auth.onAuthStateChange(function(ev,sess){setTimeout(function(){onSession(sess)},0)});
    var r=await S.sb.auth.getSession();
    onSession(r&&r.data?r.data.session:null);
  }catch(e){S.view="offline";render()}
}
if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});
}
init();
})();
