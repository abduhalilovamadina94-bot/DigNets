import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth, Users, Messages, AI, Telegram, Instagram } from './services/api';
import { useWS } from './hooks/useWS';

// ─── SVG Logo ─────────────────────────────────────────────────────────────────
const Logo = ({ size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ff2d40"/><stop offset="100%" stopColor="#8b0000"/></linearGradient></defs>
    <ellipse cx="100" cy="100" rx="85" ry="85" fill="none" stroke="url(#lg)" strokeWidth="3" opacity=".8" strokeDasharray="8 4"/>
    <path d="M50,70 L80,70 L80,130 L50,130 M50,100 L78,100 M95,70 L125,130 L155,70" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Screens constant ──────────────────────────────────────────────────────────
const S = { SPLASH:'splash', AUTH:'auth', OTP:'otp', SETUP:'setup', USERNAME:'username', PERSONA:'persona', INTERESTS:'interests', HOME:'home', CHAT:'chat', PROFILE:'profile', SETTINGS:'settings', INTEGRATIONS:'integrations' };

const PERSONAS = [
  { n:'AI SMM Ekspert', em:'📊', desc:'Kontent strategiyasi, hashtaglar va profil audit' },
  { n:'AI Kopirayter', em:'✍️', desc:'Marketing matnlari va post sarlavhalari' },
  { n:'AI Psixolog', em:'🧠', desc:'Motivatsiya, qo\'llab-quvvatlash va maslahat' },
  { n:'AI Tech Yordamchi', em:'💻', desc:'Koding, texnik savollar va loyiha boshqaruvi' },
];
const INTERESTS_LIST = ['#Dizayn','#Marketing','#AI','#Startup','#SMM','#Koding','#Video','#Musiqa','#Sport','#Biznes','#Ta\'lim','#Sayohat','#Fotografiya','#Gaming','#Texnologiya'];
const AI_CONTACTS = [
  { id:'ai1', n:'AI SMM Ekspert', i:'📊', c:'#0c4a6e', o:true, l:'Profilingizni tekshirdim ✅' },
  { id:'ai2', n:'AI Kopirayter',  i:'✍️', c:'#064e3b', o:true, l:'Yangi post matni tayyor!' },
  { id:'ai3', n:'AI Psixolog',    i:'🧠', c:'#4c1d95', o:true, l:'Bugun kayfiyatingiz qanday? 😊' },
];
const DEMO_REPLIES = ['Tushundim 👍','Zo\'r fikr!','Albatta! 😊','Rozi bo\'ldim 🎉','Yaxshi! 🔥','Ok ✅'];

export default function App() {
  const [screen, setScreen] = useState(S.SPLASH);
  const [stack,  setStack]  = useState([]);
  const [me,     setMe]     = useState(null);
  const [token,  setToken]  = useState(localStorage.getItem('dn_token'));
  const [coins,  setCoins]  = useState(0);
  const [users,  setUsers]  = useState([]);
  const [mh,     setMh]     = useState({});
  const [cp,     setCp]     = useState(null); // current peer
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [selPersona, setSelPersona] = useState(0);
  const [selInts, setSelInts] = useState(new Set());
  const [feedTab, setFeedTab] = useState('chats');
  const [navTab,  setNavTab]  = useState('home');
  const [toast,   setToast]   = useState('');
  const [typing,  setTyping]  = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [igLinked, setIgLinked] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  // Form fields
  const [fUser, setFUser] = useState('');
  const [fName, setFName] = useState('');
  const [fPass, setFPass] = useState('');
  const [fErr,  setFErr]  = useState('');
  const [unCheck, setUnCheck] = useState('');
  const [msgTxt, setMsgTxt] = useState('');
  const [aiInput, setAiInput] = useState('');
  const msgsRef = useRef(null);
  const typTimer = useRef(null);

  // ─── WS ─────────────────────────────────────────────────────────────────────
  const onWsMsg = useCallback(d => {
    if (d.type === 'auth_ok') {}
    if (d.type === 'online_users') setOnlineIds(new Set(d.users.map(u => u.id)));
    if (d.type === 'user_online')  setOnlineIds(s => new Set([...s, d.userId]));
    if (d.type === 'user_offline') setOnlineIds(s => { const n=new Set(s); n.delete(d.userId); return n; });
    if (d.type === 'coins_update') { setCoins(d.coins); showToast(d.reason); }
    if (d.type === 'ai_reply') {
      setAiModal(prev => prev ? { ...prev, text: d.text, loading: false } : null);
    }
    if (d.type === 'typing') {
      if (cp && d.fromId === cp.id) { setTyping(d.isTyping); if (d.isTyping) setTimeout(()=>setTyping(false), 3000); }
    }
    if (d.type === 'read_receipt') {}
    if (d.type === 'new_message') {
      const msg = d.message;
      setMh(prev => ({ ...prev, [msg.fromId]: [...(prev[msg.fromId]||[]), msg] }));
    }
    if (d.type === 'message_sent') {
      const msg = d.message;
      setMh(prev => ({ ...prev, [msg.toId]: [...(prev[msg.toId]||[]).filter(m=>m.id!==msg.id), msg] }));
    }
    if (d.type === 'telegram_message') showToast('📩 Telegram: ' + d.text.slice(0,30));
  }, [cp]);

  const { send } = useWS(token, onWsMsg);

  // ─── INIT ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(async () => {
      if (token) {
        try {
          const r = await Auth.me();
          setMe(r.data.user); setCoins(r.data.coins);
          const ul = await Users.list();
          setUsers(ul.data);
          // Check integrations
          try { const tg = await Telegram.status(); setTgLinked(tg.data.linked); } catch {}
          goTo(S.HOME);
        } catch { localStorage.removeItem('dn_token'); setToken(null); goTo(S.AUTH); }
      } else { goTo(S.AUTH); }
    }, 2700);
  }, []);

  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, [mh, cp, typing]);

  // ─── Navigation ─────────────────────────────────────────────────────────────
  function goTo(s) { setStack(prev => [...prev, screen]); setScreen(s); }
  function goBack() { setStack(prev => { const n=[...prev]; const last=n.pop(); setScreen(last||S.HOME); return n; }); }
  function navGo(s, tab) { setStack([]); setScreen(s); setNavTab(tab); }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  async function doAuth() {
    if (!fUser || !fPass) return setFErr('Username va parol kiriting');
    if (authMode === 'reg' && !fName) return setFErr('Ism familiya kiriting');
    try {
      let r;
      if (authMode === 'login') r = await Auth.login(fUser, fPass);
      else r = await Auth.register(fUser, fName, fPass);
      localStorage.setItem('dn_token', r.data.token);
      setToken(r.data.token); setMe(r.data.user); setCoins(r.data.coins || 0);
      const ul = await Users.list(); setUsers(ul.data);
      if (authMode === 'reg') goTo(S.OTP);
      else goTo(S.HOME);
      setFErr('');
    } catch (e) { setFErr(e.response?.data?.error || 'Xato yuz berdi'); }
  }

  function demoLogin(u, p) { setFUser(u); setFPass(p); setAuthMode('login'); setTimeout(doAuth, 100); }

  async function checkUname(v) {
    if (!v) return setUnCheck('');
    try { const r = await Auth.checkUsername(v); setUnCheck(r.data.taken ? '❌' : '✅'); }
    catch { setUnCheck(''); }
  }

  function finishOnboard() {
    if (selInts.size < 3) return showToast('Kamida 3 ta qiziqish tanlang!');
    Users.updateMe({ persona: PERSONAS[selPersona].n, interests: [...selInts] }).catch(()=>{});
    setCoins(c => c + 100); showToast('+100 🪙 Ro\'yxat bonusi!');
    goTo(S.HOME);
  }

  // ─── CHAT ───────────────────────────────────────────────────────────────────
  async function openChat(peer) {
    setCp(peer);
    if (!mh[peer.id]) {
      try { const r = await Messages.get(peer.id); setMh(prev => ({ ...prev, [peer.id]: r.data })); }
      catch { setMh(prev => ({ ...prev, [peer.id]: [] })); }
    }
    goTo(S.CHAT);
  }

  function sendMsg() {
    if (!msgTxt.trim() || !cp) return;
    if (cp.ai) {
      const msg = { id: Date.now()+'', fromId:'me', toId:cp.id, text:msgTxt, time:new Date().toISOString(), mine:true };
      setMh(prev => ({ ...prev, [cp.id]: [...(prev[cp.id]||[]), msg] }));
      send({ type:'ai_message', messages:[{ role:'user', content:msgTxt }], persona: cp.n });
      setTyping(true);
      setMsgTxt(''); return;
    }
    send({ type:'message', toId:cp.id, text:msgTxt });
    setMsgTxt('');
    // Simulate reply for demo
    if (me) {
      setTimeout(() => {
        const r = { id:Date.now()+'', fromId:cp.id, toId:me.id, text:DEMO_REPLIES[~~(Math.random()*DEMO_REPLIES.length)], time:new Date().toISOString() };
        setMh(prev => ({ ...prev, [cp.id]: [...(prev[cp.id]||[]), r] }));
        setTyping(false);
      }, 1500 + Math.random()*1000);
    }
  }

  function onMsgKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    else { send({ type:'typing', toId:cp?.id, isTyping:true }); clearTimeout(typTimer.current); typTimer.current = setTimeout(()=>send({ type:'typing', toId:cp?.id, isTyping:false }),2000); }
  }

  async function summarizeChat() {
    const msgs = (mh[cp?.id]||[]).slice(-10);
    if (!msgs.length) return showToast('Xabarlar yo\'q');
    setAiModal({ title:'🤖 AI Xulosa', text:'Tayyorlanmoqda...', loading:true });
    try { const r = await AI.summarize(msgs); setAiModal({ title:'🤖 AI Xulosa', text:r.data.summary, loading:false }); }
    catch { setAiModal({ title:'🤖 AI Xulosa', text:'Xulosa olishda xato yuz berdi.', loading:false }); }
  }

  // ─── Integrations ────────────────────────────────────────────────────────────
  async function unlinkTelegram() {
    try { await Telegram.unlink(); setTgLinked(false); showToast('Telegram uzildi'); } catch {}
  }
  async function unlinkInstagram() {
    try { await Instagram.unlink(); setIgLinked(false); showToast('Instagram uzildi'); } catch {}
  }

  function logout() {
    localStorage.removeItem('dn_token'); setToken(null); setMe(null); setStack([]);
    setScreen(S.AUTH);
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  const noNav = [S.SPLASH, S.AUTH, S.OTP, S.SETUP, S.USERNAME, S.PERSONA, S.INTERESTS];
  const msgs = mh[cp?.id] || [];

  return (
    <div className="phone">
      {/* ── SPLASH ──────────────────────────────────────────────────────── */}
      {screen === S.SPLASH && (
        <div style={{flex:1,background:'#000',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0}}>
          <Logo size={130}/>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:8,background:'linear-gradient(135deg,#fff 20%,#e0182a)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginTop:14}}>DIGNETS</div>
          <div style={{fontSize:12,color:'var(--t3)',letterSpacing:3,textTransform:'uppercase',marginTop:6}}>Your Smart Digital Partner</div>
          <div style={{marginTop:44,width:110,height:2,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,var(--red),var(--green))',animation:'loadBar 1.6s ease forwards',width:0}}/>
          </div>
          <style>{`@keyframes loadBar{to{width:100%}}`}</style>
        </div>
      )}

      {/* ── AUTH ────────────────────────────────────────────────────────── */}
      {screen === S.AUTH && (
        <div style={{flex:1,justifyContent:'flex-end',display:'flex',flexDirection:'column'}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 45% at 50% 0%,rgba(224,24,42,.22),transparent 70%),#000'}}/>
          <div style={{position:'absolute',top:52,left:0,right:0,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <Logo size={70}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:6,background:'linear-gradient(135deg,#fff,var(--red))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>DIGNETS</div>
          </div>
          <div style={{position:'relative',zIndex:2,background:'linear-gradient(180deg,rgba(14,14,22,.85),var(--bg2))',border:'1px solid var(--bd)',borderBottom:'none',borderRadius:'30px 30px 0 0',padding:'26px 22px 36px'}}>
            <div style={{display:'flex',background:'var(--bg3)',borderRadius:12,padding:3,gap:3,marginBottom:20}}>
              {['login','reg'].map((m,i) => <button key={m} onClick={()=>setAuthMode(m)} style={{flex:1,padding:'9px',background:authMode===m?'var(--bg5)':'none',color:authMode===m?'var(--white)':'var(--t2)',fontSize:13,fontWeight:500,borderRadius:9,transition:'all .22s'}}>{i===0?'Kirish':"Ro'yxat"}</button>)}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              <div className="field"><span className="field-icon">👤</span><input placeholder="Username" value={fUser} onChange={e=>setFUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAuth()}/></div>
              {authMode==='reg' && <div className="field"><span className="field-icon">✏️</span><input placeholder="Ism familiya" value={fName} onChange={e=>setFName(e.target.value)}/></div>}
              <div className="field"><span className="field-icon">🔒</span><input type="password" placeholder="Parol" value={fPass} onChange={e=>setFPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAuth()}/></div>
            </div>
            {fErr && <div style={{background:'rgba(224,24,42,.1)',border:'1px solid rgba(224,24,42,.22)',borderRadius:10,padding:'9px 12px',fontSize:12,color:'#ff8080',marginBottom:12}}>{fErr}</div>}
            <button className="btn-green" onClick={doAuth}>{authMode==='login'?'Kirish':"Ro'yxatdan o'tish"}</button>
            <div style={{textAlign:'center',fontSize:11,color:'var(--t3)',margin:'14px 0'}}>— Demo hisoblar —</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[['admin','#3b0764','AD'],['alice','#0c4a6e','AL'],['bob','#14532d','BO']].map(([u,c,i])=>(
                <button key={u} onClick={()=>demoLogin(u,u+'123')} style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:10,padding:'10px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:4,transition:'all .2s'}}>
                  <div style={{width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${c},#000)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:700,color:'#fff'}}>{i}</div>
                  <div style={{fontSize:11,color:'var(--t2)'}}>{u}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── OTP ─────────────────────────────────────────────────────────── */}
      {screen === S.OTP && <OnboardScreen title="Tasdiqlash" step="2/5" prog={40} onBack={goBack}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>Kodni kiriting</div>
        <div style={{fontSize:13,color:'var(--t2)',marginBottom:22}}>Elektron pochtangizga 6 xonali kod yuborildi.</div>
        <div style={{display:'flex',gap:10,justifyContent:'center',margin:'0 0 28px'}}>
          {[0,1,2,3,4,5].map(i=><input key={i} maxLength={1} style={{width:46,height:54,background:'var(--bg3)',border:'1.5px solid var(--bd)',borderRadius:12,textAlign:'center',fontSize:22,fontWeight:700,color:'var(--white)'}} onChange={e=>{if(e.target.value&&i<5)e.target.parentElement.children[i+1].focus();}}/>)}
        </div>
        <div style={{textAlign:'center',fontSize:13,color:'var(--t2)',marginBottom:20}}>Demo uchun: <strong style={{color:'var(--green)'}}>1 2 3 4 5 6</strong></div>
        <button className="btn-green" onClick={()=>goTo(S.SETUP)}>Tasdiqlash →</button>
      </OnboardScreen>}

      {/* ── PROFILE SETUP ───────────────────────────────────────────────── */}
      {screen === S.SETUP && <OnboardScreen title="Profil" step="3/5" prog={60} onBack={goBack}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>Ma'lumotlaringiz</div>
        <div style={{fontSize:13,color:'var(--t2)',marginBottom:22}}>Profilingizda ko'rinadigan ma'lumotlar.</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          <div className="field"><span className="field-icon">👤</span><input placeholder="Ism Familiya" defaultValue={me?.displayName}/></div>
          <div className="field"><span className="field-icon">🔒</span><input type="password" placeholder="Yangi parol (8+ belgi)"/></div>
          <div className="field"><span className="field-icon">📍</span><input placeholder="Shahar" defaultValue="Toshkent"/></div>
        </div>
        <button className="btn-green" onClick={()=>goTo(S.USERNAME)}>Davom etish →</button>
      </OnboardScreen>}

      {/* ── USERNAME ────────────────────────────────────────────────────── */}
      {screen === S.USERNAME && <OnboardScreen title="Username" step="4/5" prog={80} onBack={goBack}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>Unikal nom tanlang</div>
        <div style={{fontSize:13,color:'var(--t2)',marginBottom:22}}>Faqat lotin harflar, raqamlar va _</div>
        <div className="field" style={{marginBottom:10}}>
          <span className="field-icon">@</span>
          <input placeholder="username" onChange={e=>checkUname(e.target.value)}/>
          <span style={{fontSize:16}}>{unCheck}</span>
        </div>
        <button className="btn-green" onClick={()=>goTo(S.PERSONA)}>Davom etish →</button>
      </OnboardScreen>}

      {/* ── AI PERSONA ──────────────────────────────────────────────────── */}
      {screen === S.PERSONA && <OnboardScreen title="AI Yordamchi" step="5a/5" prog={88} onBack={goBack}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>AI Shaxsiyingiz</div>
        <div style={{fontSize:13,color:'var(--t2)',marginBottom:18}}>Doimiy AI yordamchingizni tanlang.</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          {PERSONAS.map((p,i)=>(
            <div key={i} onClick={()=>setSelPersona(i)} style={{background:'var(--bg3)',border:`1.5px solid ${selPersona===i?'var(--green)':'var(--bd)'}`,borderRadius:16,padding:14,display:'flex',gap:12,alignItems:'flex-start',cursor:'pointer',background:selPersona===i?'rgba(0,230,118,.08)':'var(--bg3)'}}>
              <div style={{width:46,height:46,borderRadius:13,background:'var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{p.em}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700,marginBottom:3}}>{p.n}</div>
                <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.5}}>{p.desc}</div>
              </div>
              {selPersona===i && <span style={{fontSize:18}}>✅</span>}
            </div>
          ))}
        </div>
        <button className="btn-green" onClick={()=>goTo(S.INTERESTS)}>Davom etish →</button>
      </OnboardScreen>}

      {/* ── INTERESTS ───────────────────────────────────────────────────── */}
      {screen === S.INTERESTS && <OnboardScreen title="Qiziqishlar" step="5/5" prog={100} onBack={goBack}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>Qiziqishlaringiz</div>
        <div style={{fontSize:13,color:'var(--t2)',marginBottom:18}}>Kamida 3 ta tanlang — feed shunga mos bo'ladi.</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:9,marginBottom:14}}>
          {INTERESTS_LIST.map(t=>(
            <div key={t} onClick={()=>setSelInts(s=>{const n=new Set(s);n.has(t)?n.delete(t):n.add(t);return n;})} style={{background:selInts.has(t)?'rgba(0,230,118,.12)':'var(--bg3)',border:`1.5px solid ${selInts.has(t)?'var(--green)':'var(--bd)'}`,borderRadius:20,padding:'8px 16px',fontSize:13,color:selInts.has(t)?'var(--green)':'var(--t2)',cursor:'pointer'}}>
              {t}
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:selInts.size>=3?'var(--green)':'var(--t2)',marginBottom:14}}>{selInts.size} ta tanlandi (min: 3)</div>
        <button className="btn-green" onClick={finishOnboard}>DigNets ga kirish 🚀</button>
      </OnboardScreen>}

      {/* ── HOME ────────────────────────────────────────────────────────── */}
      {screen === S.HOME && <>
        <div className="sbar"><span className="sbar-time">9:41</span><span>📶 🔋</span></div>
        <div style={{padding:'10px 18px 6px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:'var(--t2)'}}>Xush kelibsiz 👋</div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:20,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
              {me?.displayName||'DigNets'}
              <div onClick={()=>showToast(`🪙 Jami: ${coins} DC`)} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.2)',borderRadius:20,padding:'3px 10px',fontSize:12,color:'var(--gold)',cursor:'pointer'}}>
                🪙 {coins} DC
              </div>
            </div>
          </div>
          <div onClick={()=>navGo(S.PROFILE,'profile')} style={{width:38,height:38,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:700,color:'#fff',border:'2px solid var(--red)',cursor:'pointer',background:me?.color||'#333',flexShrink:0}}>
            {me?.avatar||'?'}
          </div>
        </div>
        {/* Feed tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--bd)',flexShrink:0}}>
          {[['chats','💬 Chatlar'],['ai','🤖 AI'],['connect','🔗 Ulash']].map(([id,label])=>(
            <button key={id} onClick={()=>setFeedTab(id)} style={{flex:1,padding:'10px 4px',fontSize:13,fontWeight:500,color:feedTab===id?'var(--white)':'var(--t2)',background:'none',textAlign:'center',borderBottom:`2px solid ${feedTab===id?'var(--green)':'transparent'}'}}>
              {label}
            </button>
          ))}
        </div>
        {/* CHATS tab */}
        {feedTab==='chats' && <div style={{flex:1,overflowY:'auto',padding:'0 10px'}}>
          <div style={{fontSize:10,color:'var(--t3)',padding:'8px 8px 3px',textTransform:'uppercase',letterSpacing:'.07em'}}>AI Yordamchilar</div>
          {AI_CONTACTS.map(u=><ChatItem key={u.id} u={u} isAI onClick={()=>openChat({...u,ai:true})} online/>)}
          <div style={{fontSize:10,color:'var(--t3)',padding:'8px 8px 3px',textTransform:'uppercase',letterSpacing:'.07em',marginTop:6}}>Onlayn</div>
          {users.filter(u=>onlineIds.has(u.id)).map(u=><ChatItem key={u.id} u={u} onClick={()=>openChat(u)} online={onlineIds.has(u.id)}/>)}
          <div style={{fontSize:10,color:'var(--t3)',padding:'8px 8px 3px',textTransform:'uppercase',letterSpacing:'.07em',marginTop:6}}>Barchasi</div>
          {users.filter(u=>!onlineIds.has(u.id)).map(u=><ChatItem key={u.id} u={u} onClick={()=>openChat(u)} online={false}/>)}
        </div>}
        {/* AI tab */}
        {feedTab==='ai' && <div style={{flex:1,overflowY:'auto',padding:16}}>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,marginBottom:12}}>🤖 AI Funksiyalar</div>
          {[
            {em:'📊',t:'AI SMM Ekspert',d:'Kontent strategiyasi va audit'},
            {em:'✍️',t:'AI Kopirayter',d:'Marketing matnlari yozish'},
            {em:'🧠',t:'AI Psixolog',d:'Motivatsiya va maslahat'},
            {em:'💻',t:'AI Tech Yordamchi',d:'Texnik yordam'},
          ].map((a,i)=>(
            <div key={i} onClick={()=>openChat({...AI_CONTACTS[i]||AI_CONTACTS[0],ai:true})} style={{background:'var(--bg3)',border:'1px solid var(--bd2)',borderRadius:14,padding:14,display:'flex',gap:12,alignItems:'center',marginBottom:10,cursor:'pointer'}}>
              <div style={{fontSize:28}}>{a.em}</div>
              <div><div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700}}>{a.t}</div><div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>{a.d}</div></div>
              <div style={{marginLeft:'auto',color:'var(--green)',fontSize:18}}>›</div>
            </div>
          ))}
        </div>}
        {/* CONNECT tab */}
        {feedTab==='connect' && <div style={{flex:1,overflowY:'auto',padding:16}}>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,marginBottom:12}}>🔗 Ijtimoiy tarmoqlar</div>
          {/* Telegram */}
          <div style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{fontSize:32}}>✈️</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700}}>Telegram Bot</div>
                <div style={{fontSize:12,color:tgLinked?'var(--green)':'var(--t2)'}}>{tgLinked?'✅ Ulangan':'Ulanmagan'}</div>
              </div>
            </div>
            <div style={{background:'var(--bg4)',borderRadius:10,padding:12,marginBottom:10,fontSize:13,color:'var(--t2)'}}>
              <strong style={{color:'var(--white)'}}>Qanday ulash:</strong><br/>
              1. Telegramda <strong style={{color:'var(--green)'}}>@DigNetsBot</strong> topib /start bosing<br/>
              2. Bot tokeningizni .env ga qo'shing<br/>
              3. <code style={{color:'var(--green)'}}>/link admin admin123</code> yozing
            </div>
            {tgLinked
              ? <button className="btn-red" onClick={unlinkTelegram}>Telegram ni uzish</button>
              : <button className="btn-green" onClick={()=>showToast('Bot serverda sozlang! README ga qarang.')}>Telegram Ulash</button>}
          </div>
          {/* Instagram */}
          <div style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:14,padding:16}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{fontSize:32}}>📸</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700}}>Instagram</div>
                <div style={{fontSize:12,color:igLinked?'var(--green)':'var(--t2)'}}>{igLinked?'✅ Ulangan':'Ulanmagan'}</div>
              </div>
            </div>
            <div style={{background:'var(--bg4)',borderRadius:10,padding:12,marginBottom:10,fontSize:13,color:'var(--t2)'}}>
              <strong style={{color:'var(--white)'}}>Kerak:</strong> developers.facebook.com da app yarating, .env ga token qo'shing
            </div>
            {igLinked
              ? <button className="btn-red" onClick={unlinkInstagram}>Instagram uzish</button>
              : <button className="btn-green" onClick={()=>showToast('Instagram tokeningizni .env ga qo\'shing!')}>Instagram Ulash</button>}
          </div>
        </div>}
      </>}

      {/* ── CHAT ────────────────────────────────────────────────────────── */}
      {screen === S.CHAT && <>
        <div className="sbar" style={{position:'relative',zIndex:2}}><span className="sbar-time">9:41</span><span>📶 🔋</span></div>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--bd)',flexShrink:0,background:'var(--bg2)'}}>
          <button onClick={goBack} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--white)',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>
          <div style={{position:'relative',flexShrink:0}}>
            <div style={{width:38,height:38,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:cp?.ai?18:13,fontWeight:700,color:'#fff',background:cp?.c||'#333',fontFamily:"'Rajdhani',sans-serif"}}>{cp?.i||'?'}</div>
            {(cp?.ai||onlineIds.has(cp?.id)) && <div style={{position:'absolute',bottom:-1,right:-1,width:11,height:11,background:'var(--green)',borderRadius:'50%',border:'2px solid var(--bg)'}}/>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:700}}>{cp?.n||cp?.displayName}</div>
            <div style={{fontSize:11,color:'var(--green)'}}>{cp?.ai?'AI Yordamchi ●':(onlineIds.has(cp?.id)?'● Onlayn':'● Oflayn')}</div>
          </div>
          <button onClick={()=>{}} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--t2)',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>📹</button>
          <button onClick={summarizeChat} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--t2)',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>🧠</button>
        </div>
        {/* Messages */}
        <div ref={msgsRef} style={{flex:1,overflowY:'auto',padding:'12px 12px 6px',display:'flex',flexDirection:'column',gap:5}}>
          <div style={{textAlign:'center',fontSize:10,color:'var(--t3)',padding:'4px 0',display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,height:1,background:'var(--bd)'}}/>Bugun<div style={{flex:1,height:1,background:'var(--bd)'}}/>
          </div>
          {msgs.map((m,i) => {
            const isMine = m.fromId==='me' || m.fromId===me?.id;
            return (
              <div key={i} style={{display:'flex',alignItems:'flex-end',gap:6,maxWidth:'80%',flexDirection:isMine?'row-reverse':'row',marginLeft:isMine?'auto':0}}>
                {!isMine && <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:cp?.ai?12:9,fontWeight:700,color:'#fff',background:cp?.c||'#333',flexShrink:0}}>{cp?.i}</div>}
                <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMine?'flex-end':'flex-start'}}>
                  <div style={{padding:'9px 13px',borderRadius:15,fontSize:14,lineHeight:1.55,wordBreak:'break-word',background:isMine?'linear-gradient(135deg,#00b248,#00e676)':cp?.ai?'rgba(0,230,118,.1)':'var(--bg3)',color:isMine?'#000':'var(--white)',border:isMine?'none':cp?.ai?'1px solid var(--bd2)':'1px solid var(--bd)',borderBottomLeftRadius:isMine?15:3,borderBottomRightRadius:isMine?3:15}}>
                    {m.text}
                  </div>
                  <div style={{fontSize:10,color:'var(--t3)',display:'flex',alignItems:'center',gap:2}}>
                    {m.time?new Date(m.time).toLocaleTimeString('uz',{hour:'2-digit',minute:'2-digit'}):''}
                    {isMine && <span style={{color:'var(--green)'}}>✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && <div style={{display:'flex',alignItems:'flex-end',gap:6}}>
            <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,background:cp?.c||'#333'}}>{cp?.i}</div>
            <div style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:'15px 15px 15px 3px',padding:'10px 13px',display:'flex',gap:4,alignItems:'center'}}>
              {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:'var(--t3)',animation:`td 1.4s ${i*.2}s infinite`}}/>)}
            </div>
          </div>}
          <style>{`@keyframes td{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}`}</style>
        </div>
        {/* Input */}
        <div style={{padding:'9px 11px 22px',borderTop:'1px solid var(--bd)',background:'var(--bg)',display:'flex',alignItems:'flex-end',gap:7,flexShrink:0}}>
          <div style={{flex:1,background:'var(--bg3)',border:'1.5px solid var(--bd)',borderRadius:15,display:'flex',alignItems:'flex-end',gap:4,padding:'9px 10px'}}>
            <textarea value={msgTxt} onChange={e=>setMsgTxt(e.target.value)} onKeyDown={onMsgKey} placeholder="Xabar yozing..." rows={1} style={{flex:1,background:'none',border:'none',color:'var(--white)',fontSize:14,resize:'none',maxHeight:90,minHeight:20,lineHeight:1.5}}/>
            <button onClick={()=>{}} style={{width:27,height:27,borderRadius:7,background:'none',color:'var(--t3)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>📎</button>
          </div>
          <button onClick={sendMsg} style={{width:42,height:42,borderRadius:13,background:'linear-gradient(135deg,var(--green),var(--green2))',color:'#000',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>➤</button>
        </div>
      </>}

      {/* ── PROFILE ─────────────────────────────────────────────────────── */}
      {screen === S.PROFILE && <>
        <div style={{position:'absolute',top:0,left:0,right:0,height:250,background:'linear-gradient(180deg,rgba(224,24,42,.18),transparent)',pointerEvents:'none'}}/>
        <div className="sbar" style={{position:'relative',zIndex:2}}><span className="sbar-time">9:41</span><span>📶 🔋</span></div>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px',flexShrink:0,position:'relative',zIndex:2}}>
          <button onClick={goBack} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--white)',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:20,fontWeight:700,flex:1}}>Profil</div>
          <button onClick={()=>goTo(S.SETTINGS)} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--t2)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>⚙️</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 18px 24px',position:'relative',zIndex:1}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,marginBottom:18}}>
            <div style={{width:86,height:86,borderRadius:22,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Rajdhani',sans-serif",fontSize:30,fontWeight:700,color:'#fff',border:'3px solid var(--red)',background:me?.color||'#333'}}>{me?.avatar||'?'}</div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700}}>{me?.displayName}</div>
            <div style={{fontSize:13,color:'var(--t2)'}}>@{me?.username}</div>
            <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.2)',borderRadius:20,padding:'5px 14px'}}>
              <span style={{fontSize:14}}>🪙</span><span style={{fontSize:12,color:'var(--gold)'}}>DigCoins:</span><span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,color:'var(--gold)'}}>{coins}</span>
            </div>
          </div>
          <div style={{display:'flex',background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:16,marginBottom:16,overflow:'hidden'}}>
            {[['0','Xabar'],['24','Ta\'qib'],['128','Tarafdor']].map(([v,l],i)=>(
              <div key={i} style={{flex:1,padding:'13px 8px',textAlign:'center',borderRight:i<2?'1px solid var(--bd)':'none'}}>
                <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:19,fontWeight:700,color:'var(--green)'}}>{v}</div>
                <div style={{fontSize:11,color:'var(--t2)'}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <button className="btn-green" style={{flex:1,padding:11,fontSize:13}}>✏️ Tahrirlash</button>
            <button className="btn-ghost" style={{flex:1}}>📤 Ulashish</button>
          </div>
          <div style={{background:'rgba(0,230,118,.08)',border:'1px solid var(--bd2)',borderRadius:14,padding:14,marginBottom:16,display:'flex',gap:12,alignItems:'center'}}>
            <div style={{fontSize:26}}>{PERSONAS[selPersona]?.em||'🤖'}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'var(--green)',fontWeight:600,marginBottom:2}}>AI YORDAMCHINGIZ</div>
              <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700}}>{PERSONAS[selPersona]?.n||'AI Yordamchi'}</div>
            </div>
            <button onClick={()=>openChat({...AI_CONTACTS[selPersona]||AI_CONTACTS[0],ai:true})} style={{background:'var(--green)',color:'#000',fontSize:12,fontWeight:700,padding:'6px 12px',borderRadius:9}}>Chat →</button>
          </div>
          {me?.interests?.length>0 && <>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700,color:'var(--t2)',marginBottom:8}}>Qiziqishlar</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:16}}>
              {me.interests.map(t=><div key={t} style={{background:'var(--bg3)',border:'1px solid var(--bd2)',borderRadius:20,padding:'5px 12px',fontSize:12,color:'var(--green)'}}>{t}</div>)}
            </div>
          </>}
          <InfoRow icon="👤" label="Ism" value={me?.displayName}/>
          <InfoRow icon="🌐" label="Username" value={`@${me?.username}`}/>
          <InfoRow icon="🟢" label="Holat" value="Onlayn"/>
          <InfoRow icon="📍" label="Joylashuv" value="Toshkent, O'zbekiston"/>
          <InfoRow icon="✈️" label="Telegram" value={tgLinked?'✅ Ulangan':'❌ Ulanmagan'}/>
          <InfoRow icon="📸" label="Instagram" value={igLinked?'✅ Ulangan':'❌ Ulanmagan'}/>
        </div>
      </>}

      {/* ── SETTINGS ────────────────────────────────────────────────────── */}
      {screen === S.SETTINGS && <>
        <div className="sbar"><span className="sbar-time">9:41</span><span>📶 🔋</span></div>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 18px',flexShrink:0}}>
          <button onClick={goBack} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--white)',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:20,fontWeight:700}}>Sozlamalar</div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 14px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:13,background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:16,padding:14,marginBottom:18}}>
            <div style={{width:50,height:50,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,color:'#fff',border:'2px solid var(--red)',background:me?.color||'#333'}}>{me?.avatar||'?'}</div>
            <div><div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700}}>{me?.displayName}</div><div style={{fontSize:12,color:'var(--gold)'}}>🪙 {coins} DigCoins</div></div>
          </div>
          <SettGroup title="Hisob">
            <SettRow icon="🔔" color="rgba(0,230,118,.1)" iconColor="var(--green)" label="Bildirishnomalar" toggle/>
            <SettRow icon="🔒" color="rgba(224,24,42,.1)" iconColor="var(--red)" label="Maxfiylik" arrow/>
            <SettRow icon="🌐" color="rgba(99,102,241,.1)" iconColor="#818cf8" label="Til" sub="O'zbek" arrow/>
          </SettGroup>
          <SettGroup title="Integratsiyalar">
            <SettRow icon="✈️" color="rgba(0,119,181,.1)" iconColor="#0077b5" label="Telegram" sub={tgLinked?'Ulangan':'Ulanmagan'} arrow onClick={()=>{goBack();setFeedTab('connect');}}/>
            <SettRow icon="📸" color="rgba(225,48,108,.1)" iconColor="#E1306C" label="Instagram" sub={igLinked?'Ulangan':'Ulanmagan'} arrow onClick={()=>{goBack();setFeedTab('connect');}}/>
          </SettGroup>
          <SettGroup title="Ko'rinish">
            <SettRow icon="🌙" color="rgba(0,230,118,.1)" iconColor="var(--green)" label="Qorong'u tema" toggle defaultOn/>
            <SettRow icon="🎨" color="rgba(224,24,42,.1)" iconColor="var(--red)" label="Rang sxemasi" sub="Qizil + Yashil" arrow/>
          </SettGroup>
          <SettGroup title="DigCoins">
            <SettRow icon="🪙" color="rgba(245,158,11,.1)" iconColor="var(--gold)" label="Mening DigCoins" sub={`${coins} DC`} arrow/>
          </SettGroup>
          <button className="btn-red" onClick={logout}>⬅️ Chiqish</button>
        </div>
      </>}

      {/* ── AI MODAL ────────────────────────────────────────────────────── */}
      {aiModal && (
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.7)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--bd2)',borderRadius:'24px 24px 0 0',padding:'20px 20px 36px',width:'100%'}}>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>{aiModal.title}</div>
            <div style={{fontSize:14,color:'var(--t2)',lineHeight:1.7,marginBottom:16}}>{aiModal.loading?'⏳ Tayyorlanmoqda...':aiModal.text}</div>
            <button className="btn-ghost" style={{width:'100%'}} onClick={()=>setAiModal(null)}>Yopish</button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ──────────────────────────────────────────────────── */}
      {!noNav.includes(screen) && screen!==S.CHAT && (
        <div className="bnav">
          {[['home','🏠','Home'],['search','🔍','Search']].map(([id,ic,lb])=>(
            <div key={id} className={`nv${navTab===id?' on':''}`} onClick={()=>navGo(S.HOME,id)}>
              <div className="nv-ic">{ic}</div><div className="nv-lb">{lb}</div>
            </div>
          ))}
          <button className="nv-center" onClick={()=>navGo(S.HOME,'chats')}>✉️</button>
          {[['notifications','🔔','Bildirishnoma'],['profile','👤','Profil']].map(([id,ic,lb])=>(
            <div key={id} className={`nv${navTab===id?' on':''}`} onClick={()=>navGo(id==='profile'?S.PROFILE:S.HOME,id)}>
              <div className="nv-bdg-wrap"><div className="nv-ic">{ic}</div></div>
              <div className="nv-lb">{lb}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── TOAST ───────────────────────────────────────────────────────── */}
      {toast && <div className="coin-toast" style={{opacity:toast?1:0}}>{toast}</div>}
    </div>
  );
}

// ─── Reusable components ───────────────────────────────────────────────────────
function OnboardScreen({ title, step, prog, onBack, children }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto'}}>
      <div className="sbar"><span className="sbar-time">9:41</span><span>🔋</span></div>
      <div style={{padding:'10px 18px 8px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',color:'var(--white)',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,flex:1}}>{title}</div>
        <div style={{fontSize:12,color:'var(--t2)'}}>{step}</div>
      </div>
      <div style={{height:3,background:'var(--bg4)',flexShrink:0,margin:'0 18px 0'}}>
        <div style={{height:'100%',background:'linear-gradient(90deg,var(--red),var(--green))',borderRadius:3,width:`${prog}%`,transition:'width .4s'}}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:20}}>{children}</div>
    </div>
  );
}

function ChatItem({ u, onClick, online, isAI }) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 8px',borderRadius:12,cursor:'pointer',transition:'background .15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{position:'relative',flexShrink:0}}>
        <div style={{width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isAI?18:13,fontWeight:700,color:'#fff',fontFamily:"'Rajdhani',sans-serif",background:u.c||u.color||'#333'}}>{u.i||u.avatar}</div>
        {online && <div style={{position:'absolute',bottom:-1,right:-1,width:12,height:12,background:'var(--green)',borderRadius:'50%',border:'2.5px solid var(--bg)'}}/>}
        {isAI && <div style={{position:'absolute',top:-4,left:-4,width:18,height:18,background:'var(--green)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,border:'2px solid var(--bg)'}}>🤖</div>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:500,fontFamily:"'Rajdhani',sans-serif"}}>{u.n||u.displayName}</div>
        <div style={{fontSize:12,color:'var(--t2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>{u.l||u.bio||'DigNets foydalanuvchisi'}</div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:12,padding:'12px 13px',marginBottom:8}}>
      <span style={{fontSize:15,width:18,textAlign:'center'}}>{icon}</span>
      <div><div style={{fontSize:11,color:'var(--t3)'}}>{label}</div><div style={{fontSize:13}}>{value}</div></div>
    </div>
  );
}

function SettGroup({ title, children }) {
  return (
    <div style={{background:'var(--bg3)',border:'1px solid var(--bd)',borderRadius:13,marginBottom:11,overflow:'hidden'}}>
      <div style={{fontSize:10,color:'var(--t3)',padding:'9px 13px 3px',textTransform:'uppercase',letterSpacing:'.07em'}}>{title}</div>
      {children}
    </div>
  );
}

function SettRow({ icon, color, iconColor, label, sub, toggle, arrow, defaultOn, onClick }) {
  const [on, setOn] = React.useState(!!defaultOn);
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:11,padding:'12px 13px',borderBottom:'1px solid var(--bd)',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg4)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,background:color,flexShrink:0}}><span style={{color:iconColor}}>{icon}</span></div>
      <div style={{flex:1}}>
        <div style={{fontSize:14}}>{label}</div>
        {sub && <div style={{fontSize:11,color:'var(--t3)'}}>{sub}</div>}
      </div>
      {toggle && <div onClick={e=>{e.stopPropagation();setOn(p=>!p);}} style={{width:42,height:23,borderRadius:12,background:on?'var(--green)':'var(--bg5)',position:'relative',cursor:'pointer',transition:'background .2s'}}>
        <div style={{position:'absolute',top:2,left:on?21:2,width:19,height:19,background:'#fff',borderRadius:'50%',transition:'left .2s'}}/>
      </div>}
      {arrow && <span style={{color:'var(--t3)',fontSize:17}}>›</span>}
    </div>
  );
}
