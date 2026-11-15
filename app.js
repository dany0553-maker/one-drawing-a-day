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
var fmtLong=function(s){return fLong.format(parse(s))};
var fmtShort=function(s){return fShort.format(parse(s))};

var REACTS=["❤️","😍","🔥","👏","🤯"];
var COL={b:"var(--p0)",p:"var(--p1)",y:"var(--p2)",g:"var(--p3)",r:"var(--red)"};
var KINDS=["tri","circ","dia","half"];
var BUCKET="drawings";
var START=/^\d{4}-\d{2}-\d{2}$/.test(CFG.START_DATE||"")?CFG.START_DATE:null;

var S={sb:null,uid:null,view:"boot",
  authMode:"login",authEmail:"",
  drawings:[],byId:{},names:{},order:[],first:null,
  loaded:false,err:"",lastLoad:0,
  tab:"days",filter:"all",month:null,
  lb:null,editing:false,pendingDel:null,reacting:false,
  sheet:false,prefDate:null,ch:null};
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
function pIndex(uid){return Math.max(0,Math.min(S.order.indexOf(uid),3))}
function pColor(uid){return "var(--p"+pIndex(uid)+")"}
function marker(uid,size){return shape(KINDS[pIndex(uid)],pColor(uid),size||14)}
function nameOf(uid){var n=S.names[uid];if(n)return n;return uid===S.uid?"אני":"חבר/ה"}

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
  var first=S.drawings.length?S.drawings.reduce(function(a,d){return d.date<a?d.date:a},S.drawings[0].date):null;
  if(START&&(!first||START<first))first=START;
  S.first=first;
  if(S.filter!=="all"&&!set.has(S.filter))S.filter="all";
}
function visible(){return S.drawings.filter(function(d){return S.filter==="all"||d.uid===S.filter})}
function lbList(){
  return visible().slice().sort(function(a,b){
    if(a.date===b.date)return S.order.indexOf(a.uid)-S.order.indexOf(b.uid);
    return a.date<b.date?1:-1;
  });
}
function streak(uid){
  var set=new Set(S.drawings.filter(function(d){return d.uid===uid}).map(function(d){return d.date}));
  var d=new Date();d.setHours(12,0,0,0);
  if(!set.has(ymd(d)))d.setDate(d.getDate()-1);
  var n=0;
  while(set.has(ymd(d))){n++;d.setDate(d.getDate()-1)}
  return n;
}
function count(uid){return S.drawings.filter(function(d){return d.uid===uid}).length}
function daysWord(n){return n===1?"יום אחד":n+" ימים"}
function canUpload(){return !!(S.sb&&S.uid)}

/* ---------- main render ---------- */
function render(){
  var fab=$("#fab");
  if(S.view==="setup"||S.view==="offline"||S.view==="auth"||S.view==="boot"){
    var body=S.view==="setup"?setupHTML():S.view==="offline"?offlineHTML():S.view==="auth"?authHTML():'<div class="note-box">טוען…</div>';
    $("#app").innerHTML='<header class="top">'+strip()+'<h1>ציור <span class="hl">ביום</span></h1></header>'+body+'<div style="margin-top:28px">'+strip()+'</div>';
    fab.hidden=true;
    return;
  }
  compute();
  var html=headerHTML();
  if(S.err){
    html+='<div class="note-box">לא הצלחנו לטעון את הציורים כרגע. בדקו את החיבור לאינטרנט. <button class="linkbtn" data-act="reload">לנסות שוב</button></div>';
  }
  if(!S.loaded&&!S.err){
    html+='<div class="note-box">טוען את הספר…</div>';
  }else if(S.loaded){
    html+=statsHTML()+todayHTML()+yearHTML()+controlsHTML()+(S.tab==="days"?daysHTML():calHTML());
  }
  html+='<div style="margin-top:28px">'+strip()+'</div>';
  $("#app").innerHTML=html;
  fab.hidden=!(S.loaded&&canUpload())||S.sheet||!!S.lb;
  if(S.lb)renderLb();
}

function setupHTML(){
  return '<div class="setup"><h2>עוד לא חיברנו מאגר</h2><p>פתחו את הקובץ <code>config.js</code> ומלאו את <code>SUPABASE_URL</code> ואת <code>SUPABASE_ANON_KEY</code>. ההוראות בקובץ README.</p></div>';
}
function offlineHTML(){
  return '<div class="setup"><h2>אין חיבור</h2><p>לא הצלחנו לטעון את רכיבי האפליקציה. בדקו את החיבור לאינטרנט ופתחו שוב.</p><button class="btn primary" data-act="reload">לנסות שוב</button></div>';
}
function authHTML(){
  var su=S.authMode==="signup";
  return '<form class="auth" id="auth-form" novalidate><h2>'+(su?"פתיחת חשבון":"כניסה")+'</h2>'+
    (su?'<div class="field"><label for="a-name">איך לקרוא לך?</label><input id="a-name" name="name" type="text" autocomplete="nickname" maxlength="30"></div>':'')+
    '<div class="field"><label for="a-email">אימייל</label><input id="a-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" value="'+esc(S.authEmail)+'" dir="ltr"></div>'+
    '<div class="field"><label for="a-pw">סיסמה</label><input id="a-pw" name="password" type="password" autocomplete="'+(su?"new-password":"current-password")+'" dir="ltr"></div>'+
    '<p class="msg" id="auth-msg" role="alert"></p>'+
    '<button class="btn primary" type="submit" id="auth-go">'+(su?"יצירת חשבון":"כניסה")+'</button>'+
    '<button class="linkbtn" type="button" data-act="authmode">'+(su?"כבר יש לי חשבון":"אין לי חשבון עדיין")+'</button></form>';
}

function headerHTML(){
  var sub;
  if(S.drawings.length||START){
    var n=Math.max(1,dayDiff(S.first,ymd(new Date()))+1);
    sub='יום <b>'+n+'</b> בספר · <b>'+S.drawings.length+'</b> ציורים';
  }else sub="הספר עוד ריק";
  return '<header class="top">'+strip()+'<h1>ציור <span class="hl">ביום</span></h1><p class="sub"><span>'+sub+'</span><button class="linkbtn" data-act="logout">התנתקות</button></p></header>';
}

function statsHTML(){
  if(!S.order.length)return "";
  var cards=S.order.map(function(u){
    var st=streak(u);
    return '<div class="stat"><div class="nm">'+marker(u,16)+'<span>'+esc(nameOf(u))+'</span>'+(u===S.uid?'<em class="me-tag">אני</em>':'')+'</div>'+
      '<div class="row"><span class="big">'+count(u)+'</span><small>ציורים</small></div>'+
      '<small>'+(st>0?'רצף של '+daysWord(st):'אין רצף כרגע')+'</small></div>';
  }).join("");
  return '<section class="stats" style="--n:'+Math.min(S.order.length,3)+'">'+cards+'</section>';
}

function todayHTML(){
  var t=ymd(new Date());
  var mine=S.uid?S.byId[t+"_"+S.uid]:null;
  var others=S.order.filter(function(u){return u!==S.uid});
  var friends;
  if(others.length){
    friends=others.map(function(u){
      var sent=!!S.byId[t+"_"+u];
      return '<span>'+marker(u,12)+esc(nameOf(u))+" "+(sent?"כבר שלח/ה":"עוד לא שלח/ה")+'</span>';
    }).join("");
  }else{
    friends='<span>החבר/ה עוד לא נרשם/ה. שלחו להם את הקישור לאפליקציה.</span>';
  }
  var acts='<button class="btn primary" data-act="pick">'+(mine?"החלפת הציור":"העלאת הציור של היום")+'</button>';
  var thumb=mine?'<button class="thumb" data-act="open" data-id="'+esc(mine.id)+'" aria-label="פתיחת הציור של היום">'+imgTag(mine,"הציור של היום")+'</button>':"";
  return '<section class="today"><div class="info"><span class="date">'+esc(fmtLong(t))+'</span>'+
    '<h2>'+(mine?"הציור של היום בפנים":"עוד אין ציור להיום")+'</h2>'+
    '<div class="friends">'+friends+'</div><div class="acts">'+acts+'</div></div>'+thumb+'</section>';
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
    var cls="yc"+(s>t?" future":"");
    if(who.length){
      done++;
      var col=(n>1&&who.length===n)?"var(--p2)":pColor(who[0]);
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
    (S.drawings.length?'<button class="btn" data-act="surprise">הפתעה</button>':'')+
    '</div>'+(chips?'<div class="ctl-row">'+chips+'</div>':'')+'</section>';
}

function emptyHTML(){
  return '<div class="empty-state"><div class="cluster">'+shape("tri",COL.b,44)+shape("circ",COL.y,36)+shape("dia",COL.r,44)+shape("half",COL.p,36)+shape("sq",COL.g,40)+'</div>'+
    '<h2>הדף הראשון מחכה</h2><p>העלו את הציור הראשון שלכם והוא יופיע כאן, ליד הציורים של החבר/ה.</p>'+
    '<button class="btn primary" data-act="pick">העלאת ציור</button></div>';
}

function slotHTML(date,uid){
  var d=S.byId[date+"_"+uid];
  var t=ymd(new Date());
  if(!d){
    if(uid===S.uid&&canUpload()&&date<=t)
      return '<button class="slot empty add" data-act="add" data-date="'+date+'"><span class="plus" aria-hidden="true">+</span><span>להוסיף ציור</span></button>';
    return '<div class="slot empty">'+(date===t?"עוד לא העלו":"לא צויר")+'</div>';
  }
  var rc=Object.keys(d.reactions||{}).map(function(k){return d.reactions[k]}).filter(Boolean);
  var uniq=Array.from(new Set(rc)).slice(0,3).join("");
  return '<button class="slot" data-act="open" data-id="'+esc(d.id)+'" aria-label="'+esc("ציור של "+nameOf(uid)+", "+fmtShort(date))+'">'+
    imgTag(d,"ציור של "+nameOf(uid))+
    '<span class="who">'+marker(uid,12)+'<b>'+esc(nameOf(uid))+'</b></span>'+
    (rc.length?'<span class="rx">'+uniq+(rc.length>1?" "+rc.length:"")+'</span>':"")+'</button>';
}

function daysHTML(){
  var vis=visible();
  if(!vis.length)return emptyHTML();
  var dates=Array.from(new Set(vis.map(function(d){return d.date}))).sort().reverse();
  var persons=S.filter==="all"?S.order:[S.filter];
  var t=ymd(new Date());
  return '<section class="feed">'+dates.map(function(date){
    var n=Math.max(1,dayDiff(S.first,date)+1);
    return '<article class="day"><div class="day-head"><h3>'+esc(fmtLong(date))+(date===t?'<span class="tag-today">היום</span>':'')+'</h3><span class="dn">יום '+n+'</span></div>'+
      '<div class="slots" style="--n:'+Math.min(persons.length,3)+'">'+persons.map(function(u){return slotHTML(date,u)}).join("")+'</div></article>';
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
    }else if(S.uid&&s<=t&&!S.byId[s+"_"+S.uid]&&S.first&&s>=S.first){
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
  var c=$("#lb-root .lb-close");if(c)c.focus();
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
  var counts={},mineR=S.uid&&d.reactions?d.reactions[S.uid]:"";
  Object.keys(d.reactions||{}).forEach(function(k){var e=d.reactions[k];if(e)counts[e]=(counts[e]||0)+1});
  var n=Math.max(1,dayDiff(S.first,d.date)+1);
  var react=REACTS.map(function(e){
    return '<button class="react" data-act="react" data-e="'+e+'" aria-pressed="'+(mineR===e)+'" aria-label="תגובה '+e+'">'+e+(counts[e]?'<small>'+counts[e]+'</small>':'')+'</button>';
  }).join("");
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
    '<div class="reacts">'+react+'</div>'+(acts?'<div class="lb-acts">'+acts+'</div>':"")+'</div></div></div>';
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
      run(function(){return S.sb.from("profiles").select("id,name")})
    ]);
    var rx={};
    (res[1]||[]).forEach(function(r){(rx[r.drawing_id]=rx[r.drawing_id]||{})[r.user_id]=r.emoji});
    S.drawings=(res[0]||[]).map(function(r){
      return {id:r.date+"_"+r.user_id,uuid:r.id,uid:r.user_id,date:r.date,path:r.image_path,thumb:r.thumb_path,note:r.note||"",reactions:rx[r.id]||{}};
    });
    S.names={};
    (res[2]||[]).forEach(function(p){S.names[p.id]=p.name||""});
    S.loaded=true;S.err="";S.lastLoad=Date.now();
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
      .subscribe();
  }catch(e){}
}
function stopRealtime(){
  try{if(S.ch&&S.sb)S.sb.removeChannel(S.ch)}catch(e){}
  S.ch=null;
}

/* ---------- reactions, notes, delete ---------- */
async function doReact(emoji){
  if(!S.sb||!S.uid||S.reacting)return;
  var d=S.byId[S.lb];if(!d)return;
  var cur=d.reactions&&d.reactions[S.uid];
  var remove=(cur===emoji);
  var prev=cur;
  if(remove)delete d.reactions[S.uid];else d.reactions[S.uid]=emoji;
  renderLb();
  S.reacting=true;
  try{
    if(remove)await run(function(){return S.sb.from("reactions").delete().eq("drawing_id",d.uuid).eq("user_id",S.uid)});
    else await run(function(){return S.sb.from("reactions").upsert({drawing_id:d.uuid,user_id:S.uid,emoji:emoji},{onConflict:"drawing_id,user_id"})});
  }catch(e){
    if(prev)d.reactions[S.uid]=prev;else delete d.reactions[S.uid];
    renderLb();toast("לא הצלחנו לשמור את התגובה");
  }
  S.reacting=false;
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
  S.authEmail=email;
  if(!email||!pw){msg.textContent="צריך אימייל וסיסמה.";return}
  if(S.authMode==="signup"&&!name){msg.textContent="איך לקרוא לך?";return}
  msg.textContent="";btn.disabled=true;
  try{
    var r;
    if(S.authMode==="signup"){
      r=await S.sb.auth.signUp({email:email,password:pw,options:{data:{name:name}}});
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
});
document.addEventListener("input",function(e){
  var t=e.target;
  if(t&&t.id==="a-email"){S.authEmail=t.value;return}
  if(!t.matches||!t.matches("[data-i][data-k]"))return;
  var i=Number(t.getAttribute("data-i")),k=t.getAttribute("data-k");
  var it=U.items[i];if(!it)return;
  it[k]=t.value;
  if(k==="date"){var w=$("#w"+i);if(w)w.textContent=warnText(it)}
});

document.addEventListener("click",function(e){
  var el=e.target.closest("[data-act]");
  if(!el)return;
  var a=el.getAttribute("data-act");
  if(a==="lb-bg"||a==="sheet-bg"){
    if(e.target!==el)return;
    if(a==="lb-bg")closeLb();else if(!U.busy)closeSheet();
    return;
  }
  switch(a){
    case "reload":location.reload();break;
    case "authmode":S.authMode=S.authMode==="login"?"signup":"login";render();break;
    case "logout":if(S.sb)S.sb.auth.signOut();break;
    case "tab":S.tab=el.getAttribute("data-t");render();break;
    case "filter":S.filter=el.getAttribute("data-u");render();break;
    case "open":openLb(el.getAttribute("data-id"));break;
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
    case "surprise":
      var l=lbList();if(l.length)openLb(l[Math.floor(Math.random()*l.length)].id);break;
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
