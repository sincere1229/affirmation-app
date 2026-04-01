import { useState, useEffect, useCallback, useRef } from "react";

// ─── 定数 ───────────────────────────────────────────
const GRADIENTS = [
  ["#fff3e0","#ffe0b2","#ffffff"],
  ["#fff8f0","#ffe5c8","#fffaf5"],
  ["#fff3e0","#ffd9b3","#fff8f0"],
  ["#fffaf5","#ffe0b2","#fff3e0"],
  ["#fff8f0","#ffecd9","#ffffff"],
];

const PARTICLES = [];

const NOTIFY_TIMES = [
  { label: "朝 6:00", value: "06:00" },
  { label: "朝 7:00", value: "07:00" },
  { label: "朝 8:00", value: "08:00" },
  { label: "昼 12:00", value: "12:00" },
  { label: "夜 21:00", value: "21:00" },
  { label: "夜 22:00", value: "22:00" },
];

const PROFILE_FIELDS = [
  { key:"name",    label:"お名前",             placeholder:"例：恵子",              type:"text" },
  { key:"age",     label:"年代",               placeholder:"例：50代",              type:"text" },
  { key:"goal",    label:"今の大きな目標",      placeholder:"例：60歳で新事業を立ち上げる" },
  { key:"worry",   label:"今の悩み・課題",      placeholder:"例：自信を持って発信できない" },
  { key:"theme",   label:"欲しいテーマ",        placeholder:"例：行動力・豊かさ・感謝" },
  { key:"vibe",    label:"言葉の雰囲気",        placeholder:"例：やさしい／力強い／スピリチュアル" },
];

// ─── ユーティリティ ──────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── パーティクル ────────────────────────────────────
function Particle({ emoji, style }) {
  return <span style={{ position:"absolute", fontSize:14+Math.random()*14, pointerEvents:"none", ...style }}>{emoji}</span>;
}

// ─── メインコンポーネント ────────────────────────────
export default function App() {
  const [screen, setScreen]       = useState("home");
  const [profile, setProfile]     = useState(() => load("aff_profile", null));
  const [editProfile, setEdit]    = useState({ name:"",age:"",goal:"",worry:"",theme:"",vibe:"" });
  const [todayData, setTodayData] = useState(() => load(`aff_${todayKey()}`, null));
  const [favorites, setFavorites] = useState(() => load("aff_favorites", []));
  const [notifyTime, setNotify]   = useState(() => load("aff_notify","07:00"));
  const [notifyOn, setNotifyOn]   = useState(() => load("aff_notify_on", false));
  const [loading, setLoading]     = useState(false);
  const [gIdx, setGIdx]           = useState(0);
  const [particles, setParticles] = useState([]);
  const [shareMsg, setShareMsg]   = useState("");
  const [tab, setTab]             = useState("today"); // today | favorites | settings
  const canvasRef = useRef(null);

  // パーティクル生成
  useEffect(() => {
    setParticles(Array.from({length:14},(_,i)=>({
      id:i,
      emoji: PARTICLES[Math.floor(Math.random()*PARTICLES.length)],
      left:`${5+Math.random()*88}%`,
      top:`${5+Math.random()*85}%`,
      delay:`${Math.random()*6}s`,
      dur:`${6+Math.random()*8}s`,
    })));
  },[]);

  // AI生成
  const generate = useCallback(async (prof) => {
    setLoading(true);
    setGIdx(Math.floor(Math.random()*GRADIENTS.length));
    const prompt = `あなたはポジティブ心理学と開運の専門家です。
以下のプロフィールの人物に、今日1日を輝かせる3つのメッセージを日本語で生成してください。

【プロフィール】
名前：${prof.name} / 年代：${prof.age} / 目標：${prof.goal} / 悩み：${prof.worry} / テーマ：${prof.theme} / 雰囲気：${prof.vibe}

【出力形式】必ずこのJSON形式のみで出力（前後の説明・コードブロック不要）：
{"affirmation":"今日のアファメーション（2〜3文・絵文字1〜2個）","seiton":"今日の整える一言（短く・1〜2文）","kaun":"今日の開運アクション（具体的な行動1つ・絵文字1個）"}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{role:"user",content:prompt}]
        })
      });
      const data = await res.json();
      const raw = data.content?.map(b=>b.text||"").join("") || "";
      const clean = raw.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      const result = { ...parsed, date: todayKey(), liked: false };
      setTodayData(result);
      save(`aff_${todayKey()}`, result);
    } catch {
      const fallback = {
        affirmation:`${prof.name}さん、あなたは今日も最高の一歩を踏み出しています。✨ 自分を信じて進んでいきましょう！`,
        seiton:"焦らなくて大丈夫。今この瞬間に集中することが、最善の道につながります。",
        kaun:"🌿 今日は深呼吸を3回して、感謝できることを1つ思い浮かべてみてください。",
        date: todayKey(), liked: false
      };
      setTodayData(fallback);
      save(`aff_${todayKey()}`, fallback);
    }
    setLoading(false);
    setTab("today");
    setScreen("main");
  },[]);

  // 初回 or プロフィールなし
  const handleStart = () => {
    if (profile) {
      if (todayData) { setScreen("main"); }
      else generate(profile);
    } else {
      setEdit({ name:"",age:"",goal:"",worry:"",theme:"",vibe:"" });
      setScreen("profile");
    }
  };

  const saveProfile = () => {
    if (!editProfile.name.trim()) return;
    save("aff_profile", editProfile);
    setProfile(editProfile);
    generate(editProfile);
  };

  // お気に入り
  const toggleFav = () => {
    if (!todayData) return;
    const updated = { ...todayData, liked: !todayData.liked };
    setTodayData(updated);
    save(`aff_${todayKey()}`, updated);
    if (updated.liked) {
      const newFavs = [updated, ...favorites.filter(f=>f.date!==updated.date)];
      setFavorites(newFavs);
      save("aff_favorites", newFavs);
    } else {
      const newFavs = favorites.filter(f=>f.date!==updated.date);
      setFavorites(newFavs);
      save("aff_favorites", newFavs);
    }
  };

  // シェア（Web Share API or コピー）
  const share = async () => {
    if (!todayData) return;
    const text = `🌸 今日のアファメーション\n\n${todayData.affirmation}\n\n✨ ${todayData.seiton}\n\n${todayData.kaun}\n\n#今日のアファメーション #朝のことば`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("コピーしました！SNSに貼り付けてシェアしてね🌸");
      setTimeout(()=>setShareMsg(""),3000);
    } catch { setShareMsg("コピーできませんでした"); setTimeout(()=>setShareMsg(""),2000); }
  };

  // 通知（Web Notifications API）
  const requestNotify = async () => {
    if (!("Notification" in window)) { alert("このブラウザは通知に対応していません"); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifyOn(true); save("aff_notify_on", true);
      save("aff_notify", notifyTime);
      new Notification("🌸 アファメーション通知設定完了！",{
        body:`毎日${notifyTime}にお知らせします（※ブラウザが開いている時のみ）`
      });
    } else { alert("通知が許可されませんでした"); }
  };

  const g = GRADIENTS[gIdx];
  const bg = `radial-gradient(ellipse at 20% 20%, ${g[0]} 0%, transparent 60%),
              radial-gradient(ellipse at 80% 80%, ${g[1]} 0%, transparent 60%),
              radial-gradient(ellipse at 50% 50%, ${g[2]} 0%, transparent 80%),
              #fffdf9`;

  return (
    <div style={{
      minHeight:"100vh", background: bg,
      fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic','Noto Sans JP',sans-serif",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", position:"relative", overflow:"hidden",
      transition:"background 1.5s ease",
    }}>
      <style>{`
        @keyframes floatY {
          0%,100%{transform:translateY(0) rotate(-5deg);opacity:.55}
          50%{transform:translateY(-22px) rotate(5deg);opacity:.85}
        }
        @keyframes fadeUp {
          from{opacity:0;transform:translateY(28px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes popIn {
          0%{transform:scale(.7);opacity:0}
          80%{transform:scale(1.05)}
          100%{transform:scale(1);opacity:1}
        }
        @keyframes spin {
          from{transform:rotate(0)}to{transform:rotate(360deg)}
        }
        @keyframes shimmer {
          0%,100%{opacity:.7}50%{opacity:1}
        }
        .card {
          background:rgba(255,255,255,.85);
          backdrop-filter:blur(16px);
          border-radius:24px;
          box-shadow:0 12px 48px rgba(0,137,123,.1),0 2px 8px rgba(38,198,218,.15);
          border:1px solid rgba(178,235,242,.6);
        }
        .btn-gold {
          background:linear-gradient(135deg,#ff9800,#ff6d00,#e65100);
          color:#fff;border:none;border-radius:50px;
          padding:15px 36px;font-size:17px;font-weight:bold;
          cursor:pointer;letter-spacing:.06em;
          box-shadow:0 8px 28px rgba(230,81,0,.28);
          transition:all .22s;font-family:inherit;
        }
        .btn-gold:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(230,81,0,.4)}
        .btn-soft {
          background:rgba(255,255,255,.88);color:#e65100;
          border:1.5px solid #ffb74d;border-radius:50px;
          padding:12px 28px;font-size:14px;cursor:pointer;
          transition:all .2s;font-family:inherit;
        }
        .btn-soft:hover{background:#fff3e0}
        .tab-btn {
          flex:1;padding:10px 4px;border:none;border-radius:0;
          background:transparent;font-size:13px;cursor:pointer;
          font-family:inherit;color:#9e9e9e;transition:all .2s;
          border-bottom:2px solid transparent;
        }
        .tab-btn.active{color:#e65100;border-bottom:2px solid #ff9800;font-weight:bold;}
        input,textarea,select {
          width:100%;padding:11px 14px;
          border:1.5px solid #ffcc80;border-radius:12px;
          font-size:14px;outline:none;
          background:rgba(255,255,255,.9);
          transition:border-color .2s;box-sizing:border-box;
          font-family:inherit;color:#4a4a4a;
        }
        input:focus,textarea:focus,select:focus{border-color:#ff9800}
        label{font-size:12px;color:#e65100;font-weight:bold;display:block;margin-bottom:4px;}
        .fav-card{background:rgba(255,255,255,.78);border-radius:16px;
          padding:16px;margin-bottom:12px;border:1px solid #ffcc80;
          animation:fadeUp .4s ease;}
        .card {
          background:rgba(255,255,255,.85);
          backdrop-filter:blur(16px);
          border-radius:24px;
          box-shadow:0 12px 48px rgba(230,81,0,.1),0 2px 8px rgba(255,152,0,.15);
          border:1px solid rgba(255,204,128,.6);
        }
      `}</style>

      {/* パーティクルなし */}

      {/* ══════ ホーム ══════ */}
      {screen==="home" && (
        <div style={{textAlign:"center",animation:"fadeUp .8s ease",padding:"40px 28px",maxWidth:400}}>
          <div style={{fontSize:64,marginBottom:12,animation:"shimmer 3s ease-in-out infinite"}}>☀️</div>
          <h1 style={{fontSize:26,fontWeight:900,color:"#bf6000",margin:"0 0 8px",
            textShadow:"0 2px 12px rgba(255,160,0,.2)",letterSpacing:".04em"}}>
            今日のアファメーション
          </h1>
          <p style={{color:"#e67e00",fontSize:14,margin:"0 0 36px",lineHeight:1.8}}>
            あなただけの言葉で、今日を整えましょう
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:12,alignItems:"center"}}>
            <button className="btn-gold" onClick={handleStart}
              style={{animation:"shimmer 2.5s ease-in-out infinite"}}>
              🌟 今日のことばを受け取る
            </button>
            {profile && (
              <button className="btn-soft" onClick={()=>{setEdit({...profile});setScreen("profile")}}>
                ✏️ プロフィールを編集
              </button>
            )}
            {!profile && <p style={{color:"#e91e8c",fontSize:12}}>※ 初回はプロフィール設定があります</p>}
          </div>
        </div>
      )}

      {/* ══════ プロフィール設定 ══════ */}
      {screen==="profile" && (
        <div className="card" style={{
          width:"90%",maxWidth:440,padding:"28px 24px",
          animation:"popIn .5s ease",maxHeight:"90vh",overflowY:"auto"
        }}>
          <h2 style={{color:"#bf6000",fontSize:20,margin:"0 0 4px",textAlign:"center"}}>☀️ プロフィール設定</h2>
          <p style={{color:"#e67e00",fontSize:12,textAlign:"center",margin:"0 0 20px"}}>
            あなた専用のアファメーションを生成します
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {PROFILE_FIELDS.map(f=>(
              <div key={f.key}>
                <label>{f.label}</label>
                <input type={f.type||"text"} placeholder={f.placeholder}
                  value={editProfile[f.key]}
                  onChange={e=>setEdit(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <button className="btn-soft" onClick={()=>setScreen("home")} style={{flex:1}}>もどる</button>
            <button className="btn-gold" onClick={saveProfile}
              style={{flex:2,padding:"13px 16px",fontSize:15,
                opacity:editProfile.name.trim()?1:.5}}>
              🌟 保存して生成
            </button>
          </div>
        </div>
      )}

      {/* ══════ ローディング ══════ */}
      {loading && (
        <div style={{textAlign:"center",animation:"fadeUp .4s ease",padding:40}}>
          <div style={{fontSize:54,animation:"spin 2.2s linear infinite",display:"inline-block"}}>🌸</div>
          <p style={{color:"#880e4f",fontSize:18,fontWeight:"bold",marginTop:18}}>
            あなたへの言葉を紡いでいます…
          </p>
          <p style={{color:"#ad1457",fontSize:13}}>少しお待ちください✨</p>
        </div>
      )}

      {/* ══════ メイン画面 ══════ */}
      {screen==="main" && !loading && (
        <div style={{width:"92%",maxWidth:460,animation:"fadeUp .7s ease"}}>
          {/* タブ */}
          <div style={{display:"flex",background:"rgba(255,255,255,.7)",
            borderRadius:"16px 16px 0 0",backdropFilter:"blur(8px)",
            borderBottom:"1px solid #f8bbd0"}}>
            {[["today","🌸 今日"],["favorites","⭐ お気に入り"],["settings","⚙️ 設定"]].map(([key,label])=>(
              <button key={key} className={`tab-btn${tab===key?" active":""}`} onClick={()=>setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="card" style={{borderRadius:"0 0 24px 24px",padding:"24px 20px",minHeight:300}}>

            {/* ── 今日タブ ── */}
            {tab==="today" && todayData && (
              <div>
                <p style={{color:"#e67e00",fontSize:12,textAlign:"center",margin:"0 0 4px",letterSpacing:".1em"}}>
                  {profile?.name}さんへ · {todayData.date}
                </p>

                {/* アファメーション */}
                <div style={{background:"linear-gradient(135deg,rgba(255,243,224,.8),rgba(255,236,204,.7))",
                  borderRadius:16,padding:"18px 16px",marginBottom:12,border:"1px solid #ffcc80"}}>
                  <p style={{color:"#bf6000",fontSize:11,fontWeight:"bold",margin:"0 0 8px",letterSpacing:".15em"}}>
                    ☀️ 今日のアファメーション
                  </p>
                  <p style={{color:"#1a3a2a",fontSize:16,lineHeight:2,fontWeight:"bold",margin:0}}>
                    {todayData.affirmation}
                  </p>
                </div>

                {/* 整える一言 */}
                <div style={{background:"rgba(225,245,254,.7)",
                  borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #b3e5fc"}}>
                  <p style={{color:"#0277bd",fontSize:11,fontWeight:"bold",margin:"0 0 6px",letterSpacing:".12em"}}>
                    🌙 今日の整える一言
                  </p>
                  <p style={{color:"#01579b",fontSize:16,lineHeight:1.8,margin:0}}>{todayData.seiton}</p>
                </div>

                {/* 開運アクション */}
                <div style={{background:"rgba(232,245,233,.7)",
                  borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid #a5d6a7"}}>
                  <p style={{color:"#2e7d32",fontSize:11,fontWeight:"bold",margin:"0 0 6px",letterSpacing:".12em"}}>
                    🍀 今日の開運アクション
                  </p>
                  <p style={{color:"#1b5e20",fontSize:16,lineHeight:1.8,margin:0}}>{todayData.kaun}</p>
                </div>

                {/* ボタン群 */}
                {shareMsg && (
                  <p style={{color:"#c2185b",fontSize:13,textAlign:"center",margin:"0 0 10px",
                    animation:"fadeUp .3s ease"}}>{shareMsg}</p>
                )}
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="btn-soft" onClick={toggleFav}
                    style={{flex:1,fontSize:13,padding:"10px 8px",
                      background: todayData.liked?"#fff3e0":"rgba(255,255,255,.88)",
                      color: todayData.liked?"#e65100":"#e65100"}}>
                    {todayData.liked?"⭐ 保存済み":"⭐ お気に入り"}
                  </button>
                  <button className="btn-soft" onClick={share}
                    style={{flex:1,fontSize:13,padding:"10px 8px"}}>
                    📸 シェア
                  </button>
                  <button className="btn-soft" onClick={()=>generate(profile)}
                    style={{flex:1,fontSize:13,padding:"10px 8px"}}>
                    🔄 再生成
                  </button>
                </div>

                <button className="btn-soft" onClick={()=>setScreen("home")}
                  style={{width:"100%",marginTop:8,fontSize:12,padding:"9px"}}>
                  🏠 ホームへ
                </button>
              </div>
            )}

            {/* ── お気に入りタブ ── */}
            {tab==="favorites" && (
              <div>
                <h3 style={{color:"#bf6000",fontSize:16,margin:"0 0 14px",textAlign:"center"}}>
                  ⭐ お気に入りのことば
                </h3>
                {favorites.length===0 ? (
                  <p style={{color:"#e67e00",textAlign:"center",fontSize:14,padding:20}}>
                    まだ保存されていません☀️<br/>
                    気に入ったことばに⭐を押してね
                  </p>
                ) : favorites.map((f,i)=>(
                  <div key={i} className="fav-card">
                    <p style={{color:"#e67e00",fontSize:11,margin:"0 0 6px"}}>{f.date}</p>
                    <p style={{color:"#1a3a2a",fontSize:14,lineHeight:1.8,margin:"0 0 8px",fontWeight:"bold"}}>
                      {f.affirmation}
                    </p>
                    <p style={{color:"#01579b",fontSize:12,lineHeight:1.7,margin:"0 0 4px"}}>{f.seiton}</p>
                    <p style={{color:"#1b5e20",fontSize:12,lineHeight:1.7,margin:0}}>{f.kaun}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── 設定タブ ── */}
            {tab==="settings" && (
              <div>
                <h3 style={{color:"#bf6000",fontSize:16,margin:"0 0 18px",textAlign:"center"}}>⚙️ 設定</h3>

                {/* 通知 */}
                <div style={{marginBottom:20}}>
                  <label style={{fontSize:14,marginBottom:10,display:"block"}}>
                    🔔 通知時間を選ぶ
                  </label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
                    {NOTIFY_TIMES.map(t=>(
                      <button key={t.value}
                        onClick={()=>{setNotify(t.value);save("aff_notify",t.value)}}
                        style={{
                          padding:"8px 14px",borderRadius:20,border:"1.5px solid",fontSize:13,
                          cursor:"pointer",fontFamily:"inherit",
                          background: notifyTime===t.value?"#ff9800":"rgba(255,255,255,.85)",
                          color: notifyTime===t.value?"#fff":"#e65100",
                          borderColor: notifyTime===t.value?"#ff9800":"#ffcc80",
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button className="btn-gold" onClick={requestNotify}
                    style={{width:"100%",fontSize:14,padding:"12px"}}>
                    {notifyOn?"✅ 通知設定済み（再設定）":"🔔 通知をオンにする"}
                  </button>
                  <p style={{color:"#9e9e9e",fontSize:11,marginTop:6,textAlign:"center"}}>
                    ※ブラウザが開いている時のみ通知されます
                  </p>
                </div>

                <div style={{borderTop:"1px solid #f8bbd0",paddingTop:16}}>
                  <label style={{fontSize:14,marginBottom:10,display:"block"}}>👤 プロフィール</label>
                  {profile && (
                    <div style={{background:"rgba(255,243,224,.5)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                      {PROFILE_FIELDS.map(f=>(
                        <p key={f.key} style={{margin:"3px 0",fontSize:13,color:"#4a4a4a"}}>
                          <b style={{color:"#e65100"}}>{f.label}：</b>{profile[f.key]||"未設定"}
                        </p>
                      ))}
                    </div>
                  )}
                  <button className="btn-soft" style={{width:"100%"}}
                    onClick={()=>{setEdit(profile||{name:"",age:"",goal:"",worry:"",theme:"",vibe:""});setScreen("profile")}}>
                    ✏️ プロフィールを編集する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
