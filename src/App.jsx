import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Flame,
  Heart,
  ImagePlus,
  Leaf,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import AuthScreen from './AuthScreen.jsx'
import './App.css'

const today = new Date().toISOString().slice(0, 10)
const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()

function shiftDate(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().slice(0, 10)
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem('little-practice-auth'))
  } catch {
    return null
  }
}

function readSaved(accountId, key) {
  try {
    const value = localStorage.getItem(`little-practice-${accountId}-${key}`)
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}

async function apiRequest(path, options = {}) {
  const { token, ...requestOptions } = options
  const response = await fetch(path, {
    ...requestOptions,
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestOptions.headers,
    },
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.detail || 'The request could not be completed.')
  }
  return response.status === 204 ? null : response.json()
}

function App() {
  const [auth, setAuth] = useState(readAuth)
  const [authStatus, setAuthStatus] = useState(() => readAuth()?.access_token ? 'checking' : 'signed-out')
  const accessToken = auth?.access_token

  useEffect(() => {
    if (!accessToken) return undefined
    let cancelled = false
    apiRequest('/api/profile', { token: accessToken })
      .then((user) => {
        const storedAuth = readAuth()
        if (cancelled || storedAuth?.access_token !== accessToken) return
        const refreshedAuth = { ...storedAuth, user }
        localStorage.setItem('little-practice-auth', JSON.stringify(refreshedAuth))
        setAuth(refreshedAuth)
        setAuthStatus('authenticated')
      })
      .catch(() => {
        if (cancelled || readAuth()?.access_token !== accessToken) return
        localStorage.removeItem('little-practice-auth')
        setAuth(null)
        setAuthStatus('signed-out')
      })
    return () => { cancelled = true }
  }, [accessToken])

  async function authenticate(mode, values) {
    const payload = mode === 'register'
      ? { email: values.email, username: values.username, name: values.name, password: values.password }
      : { email: values.email, password: values.password }
    const result = await apiRequest(`/api/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    localStorage.setItem('little-practice-auth', JSON.stringify(result))
    setAuth(result)
    setAuthStatus('authenticated')
  }

  function signOut() {
    localStorage.removeItem('little-practice-auth')
    setAuth(null)
    setAuthStatus('signed-out')
  }

  if (authStatus === 'checking') return <div className="auth-loading" role="status">Checking your account…</div>
  if (authStatus !== 'authenticated' || !auth) {
    return <AuthScreen onSubmit={authenticate} demoOnly={import.meta.env.VITE_PUBLIC_DEMO === 'true'} onGuest={() => {
      setAuth({ user: { id: 'public-demo', name: 'Guest', username: 'guest' } })
      setAuthStatus('authenticated')
    }} />
  }
  const guestMode = auth.user.id === 'public-demo'
  return <Dashboard key={auth.user.id} auth={auth} guestMode={guestMode} onSignOut={signOut} />
}

function Dashboard({ auth, guestMode, onSignOut }) {
  const accountId = auth.user.id
  const [skills, setSkills] = useState(() => readSaved(accountId, 'skills'))
  const [sessions, setSessions] = useState(() => readSaved(accountId, 'sessions'))
  const [goals, setGoals] = useState(() => readSaved(accountId, 'goals'))
  const [posts, setPosts] = useState(() => readSaved(accountId, 'posts'))
  const [activePage, setActivePage] = useState('Overview')
  const [modal, setModal] = useState('')
  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => localStorage.setItem(`little-practice-${accountId}-skills`, JSON.stringify(skills)), [accountId, skills])
  useEffect(() => localStorage.setItem(`little-practice-${accountId}-sessions`, JSON.stringify(sessions)), [accountId, sessions])
  useEffect(() => localStorage.setItem(`little-practice-${accountId}-goals`, JSON.stringify(goals)), [accountId, goals])
  useEffect(() => localStorage.setItem(`little-practice-${accountId}-posts`, JSON.stringify(posts)), [accountId, posts])
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const totalMinutes = sessions.reduce((total, session) => total + Number(session.minutes), 0)
  const todayMinutes = sessions.filter((session) => session.date === today).reduce((total, session) => total + Number(session.minutes), 0)
  const weekMinutes = sessions.filter((session) => session.date >= shiftDate(today, -6)).reduce((total, session) => total + Number(session.minutes), 0)
  const currentStreak = calculateStreak(sessions)
  const filteredSkills = skills.filter((skill) => `${skill.name} ${skill.category}`.toLowerCase().includes(query.toLowerCase()))
  const visiblePosts = posts.filter((post) => `${post.name} ${post.skill} ${post.text}`.toLowerCase().includes(query.toLowerCase()))

  function addSession(formData) {
    const session = { ...formData, id: crypto.randomUUID() }
    setSessions((current) => [session, ...current])
    setSkills((current) => current.map((skill) => skill.id === session.skillId ? { ...skill, progress: Math.min(100, skill.progress + Math.max(1, Math.round(session.minutes / 30))) } : skill))
    setGoals((current) => current.map((goal) => {
      if (goal.skillId !== session.skillId || goal.status !== 'ACTIVE') return goal
      const currentMinutes = goal.currentMinutes + Number(session.minutes)
      return { ...goal, currentMinutes, status: currentMinutes >= goal.targetMinutes ? 'COMPLETED' : 'ACTIVE' }
    }))
    setModal('')
    setToast('Practice logged. Nice work showing up.')
  }

  function addGoal(formData) {
    setGoals((current) => [{ ...formData, id: crypto.randomUUID(), currentMinutes: 0, status: 'ACTIVE' }, ...current])
    setModal('')
    setToast('A small goal, made real.')
  }

  function addSkill(formData) {
    setSkills((current) => [{ ...formData, id: crypto.randomUUID(), progress: 0, color: ['coral', 'blue', 'green'][current.length % 3], icon: '✳' }, ...current])
    setModal('')
    setToast('Your new practice is ready to grow.')
  }

  function addPost(formData) {
    const initials = auth.user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    setPosts((current) => [{ ...formData, id: crypto.randomUUID(), name: auth.user.name, handle: `@${auth.user.username}`, avatar: initials, color: 'avatar-green', time: 'just now', likes: 0, comments: 0, liked: false, image: '' }, ...current])
    setModal('')
    setToast('Your update is out in the community.')
  }

  function addComment(postId, content) {
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: post.comments + 1, commentTexts: [...(post.commentTexts || []), content] } : post))
    setToast('A kind word makes a difference.')
  }

  function toggleLike(postId) {
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post))
  }

  const navItems = [
    { label: 'Overview', icon: Activity },
    { label: 'My practice', icon: BookOpen },
    { label: 'Community', icon: MessageCircle, count: posts.length },
    { label: 'Milestones', icon: Trophy },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setActivePage('Overview')} aria-label="Little Practice home">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
          <span>little<span className="brand-light">practice</span></span>
        </a>
        <div className="workspace-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, count }) => (
            <button key={label} className={`nav-item ${activePage === label ? 'nav-active' : ''}`} onClick={() => { setActivePage(label); setMobileNavOpen(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR RHYTHM</div>
        <div className="streak-mini"><span className="streak-icon"><Flame size={16} fill="currentColor" /></span><span><strong>{currentStreak} day streak</strong><small>Keep the rhythm going</small></span><ArrowUpRight size={15} /></div>
        <div className="sidebar-spacer" />
        <div className="weekly-nudge"><div className="nudge-head"><span>This week</span><Sparkles size={15} /></div><strong>{Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m</strong><small>of your 5 hour intention</small><div className="nudge-track"><span style={{ width: `${Math.min(100, weekMinutes / 300 * 100)}%` }} /></div><span className="nudge-percent">{Math.min(100, Math.round(weekMinutes / 300 * 100))}% complete</span></div>
        {guestMode
          ? <div className="profile-mini"><span className="avatar avatar-jordan">GU</span><span className="profile-copy"><strong>Guest</strong><small>Public preview</small></span></div>
          : <button className="profile-mini" onClick={onSignOut} aria-label={`Sign out ${auth.user.name}`} title="Sign out"><span className="avatar avatar-jordan">{auth.user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="profile-copy"><strong>{auth.user.name}</strong><small>Sign out</small></span><MoreHorizontal size={19} /></button>}
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your space" aria-label="Search your space" /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You’re all caught up.') }><Bell size={18} /><span className="notification-dot" /></button>
            <span className="topbar-divider" />
            <button className="help-button" onClick={() => setToast('Start small. Stay curious. That’s the whole practice.')}><CircleHelp size={17} /> <span>Help</span></button>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'Overview' && <OverviewPage skills={filteredSkills} sessions={sessions} goals={goals} posts={visiblePosts} stats={{ totalMinutes, todayMinutes, currentStreak, weekMinutes }} onAction={setModal} onLike={toggleLike} onComment={addComment} />}
          {activePage === 'My practice' && <PracticePage skills={filteredSkills} sessions={sessions} stats={{ totalMinutes, weekMinutes }} onAction={setModal} />}
          {activePage === 'Community' && <CommunityPage posts={visiblePosts} onAction={setModal} onLike={toggleLike} onComment={addComment} />}
          {activePage === 'Milestones' && <MilestonesPage skills={skills} stats={{ currentStreak, totalMinutes }} onAction={setModal} />}
        </div>
      </main>

      {modal && <ActionModal type={modal} skills={skills} onClose={() => setModal('')} onSession={addSession} onSkill={addSkill} onGoal={addGoal} onPost={addPost} />}
      {toast && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  )
}

function calculateStreak(sessions) {
  const practiced = new Set(sessions.map((session) => session.date))
  let date = today
  if (!practiced.has(date)) date = shiftDate(today, -1)
  let streak = 0
  while (practiced.has(date)) {
    streak += 1
    date = shiftDate(date, -1)
  }
  return streak
}

function OverviewPage({ skills, sessions, goals, posts, stats, onAction, onLike, onComment }) {
  const [range, setRange] = useState('7 days')
  const chartData = buildChartData(sessions, range === '30 days' ? 30 : 7)
  return (
    <>
      <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> {todayLabel}</div><h1>A little progress<br /><em>goes a long way.</em></h1><p className="welcome-sub">You’ve made space for yourself {stats.currentStreak} days in a row. Let’s keep it gentle.</p></div><button className="button button-dark" onClick={() => onAction('session')}><Plus size={17} /> Log practice</button></section>
      <section className="stat-grid" aria-label="Your progress at a glance">
        <StatCard label="Practice time" value={`${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`} detail="all time" icon={Clock3} tone="peach" trend="+2.4h" trendIcon={ArrowUpRight} />
        <StatCard label="Current streak" value={`${stats.currentStreak} days`} detail="You’re building a habit" icon={Flame} tone="yellow" trend="Best: 12d" trendIcon={TrendingUp} />
        <StatCard label="Active skills" value={skills.length.toString().padStart(2, '0')} detail="One step at a time" icon={Target} tone="mint" trend={`${skills.filter((skill) => skill.progress >= 60).length} near goal`} trendIcon={ArrowUpRight} />
      </section>

      <div className="dashboard-grid">
        <section className="panel practice-panel">
          <div className="panel-heading"><div><div className="section-kicker">YOUR PRACTICE</div><h2>Showing up adds up.</h2></div><div className="select-wrap"><CalendarDays size={14} /><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Chart time range"><option>7 days</option><option>30 days</option></select><ChevronDown size={13} /></div></div>
          <div className="chart-summary"><strong>{Math.floor(stats.weekMinutes / 60)}h {stats.weekMinutes % 60}m</strong><span><span className="trend-good"><ArrowUpRight size={13} /> 18%</span> vs. last week</span></div>
          <PracticeChart data={chartData} />
          <div className="chart-foot"><span><span className="legend-dot" /> Hours practiced</span><span>Goal <strong>5h / week</strong></span></div>
        </section>

        <section className="panel focus-panel"><div className="panel-heading"><div><div className="section-kicker">TODAY’S FOCUS</div><h2>Make a little room.</h2></div><span className="sun-mark">✳</span></div><div className="focus-list">{skills.slice(0, 3).map((skill, index) => <div className="focus-item" key={skill.id}><span className={`focus-number focus-${skill.color}`}>0{index + 1}</span><div className="focus-copy"><strong>{skill.name}</strong><small>{index === 0 ? '20 min · continue your lesson' : index === 1 ? '15 min · a few quiet frames' : '10 min · review your notes'}</small></div><button className="focus-start" onClick={() => onAction('session')} aria-label={`Log practice for ${skill.name}`}><ArrowRight size={16} /></button></div>)}</div>{goals.slice(0, 1).map((goal) => { const skill = skills.find((item) => item.id === goal.skillId); const progress = Math.min(100, Math.round(goal.currentMinutes / goal.targetMinutes * 100)); return <div className="focus-goal" key={goal.id}><div className="goal-topline"><span>IN MOTION</span><strong>{progress}%</strong></div><strong className="goal-name">{goal.title}</strong><div className="progress-track"><span className="progress-fill fill-green" style={{ width: `${progress}%` }} /></div><small>{skill?.name || 'Practice'} · {Math.floor(goal.currentMinutes / 60)}h of {Math.floor(goal.targetMinutes / 60)}h</small></div> })}<button className="text-link" onClick={() => onAction('goal')}><Target size={14} /> Set a small goal</button></section>

        <section className="panel skills-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR PRACTICES</div><h2>Growing, at your pace.</h2></div><button className="icon-button panel-more" aria-label="Add a skill" onClick={() => onAction('skill')}><Plus size={18} /></button></div><div className="skill-list">{skills.slice(0, 3).map((skill) => <SkillRow key={skill.id} skill={skill} />)}</div><button className="text-link" onClick={() => onAction('skill')}>Explore a new skill <ArrowRight size={14} /></button></section>

        <section className="panel community-panel"><div className="panel-heading"><div><div className="section-kicker">FROM THE COMMUNITY</div><h2>Small wins, shared.</h2></div><button className="text-link link-inline" onClick={() => onAction('post')}>Share yours <Plus size={14} /></button></div><div className="feed-list">{posts.slice(0, 2).map((post) => <FeedPost key={post.id} post={post} onLike={onLike} onComment={onComment} compact />)}</div></section>
      </div>
    </>
  )
}

function StatCard({ label, value, detail, icon: Icon, tone, trend, trendIcon: TrendIcon }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><div className="stat-bottom"><span>{detail}</span><span className="stat-trend"><TrendIcon size={13} />{trend}</span></div></div>
}

function SkillRow({ skill }) {
  return <div className="skill-row"><div className={`skill-symbol symbol-${skill.color}`}>{skill.icon}</div><div className="skill-main"><div className="skill-title-line"><strong>{skill.name}</strong><span>{skill.progress}%</span></div><div className="skill-meta">{skill.category} <span>·</span> {skill.level}</div><div className="progress-track"><span className={`progress-fill fill-${skill.color}`} style={{ width: `${skill.progress}%` }} /></div></div></div>
}

function FeedPost({ post, onLike, onComment, compact = false }) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comment, setComment] = useState('')
  function submitComment(event) { event.preventDefault(); if (!comment.trim()) return; onComment(post.id, comment.trim()); setComment('') }
  return <article className={`feed-post ${compact ? 'feed-post-compact' : ''}`}><div className="feed-author"><span className={`avatar ${post.color}`}>{post.avatar}</span><div><strong>{post.name}</strong><small>{post.handle} <span>·</span> {post.time}</small></div><button className="icon-button post-menu" aria-label="Post options"><MoreHorizontal size={18} /></button></div><div className="feed-copy"><span className="skill-tag">{post.skill}</span><p>{post.text}</p></div>{post.image === 'ceramics' && <div className="post-photo" role="img" aria-label="Handmade pale clay ceramic vase on a workbench"><div className="ceramic-vase" /><div className="photo-caption">SATURDAY STUDIO · 04</div></div>}{post.image && post.image !== 'ceramics' && <div className="post-photo user-photo"><img src={post.image} alt="Community member's practice update" /></div>}<div className="post-actions"><button className={`post-action like-action ${post.liked ? 'is-liked' : ''}`} onClick={() => onLike(post.id)} aria-label={`${post.liked ? 'Unlike' : 'Like'} ${post.name}'s post`}><Heart size={16} fill={post.liked ? 'currentColor' : 'none'} />{post.likes}</button><button className="post-action" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}><MessageCircle size={16} />{post.comments}</button><span className="post-encouragement">Send a little love</span></div>{commentsOpen && <div className="comment-thread">{(post.commentTexts || []).map((text, index) => <p key={`${post.id}-${index}`}><strong>Jordan</strong>{text}</p>)}<form onSubmit={submitComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a kind word" aria-label="Write a comment" maxLength={500} /><button type="submit" aria-label="Post comment"><ArrowRight size={15} /></button></form></div>}</article>
}

function PracticeChart({ data }) {
  const maxHours = Math.max(1, ...data.map((item) => item.hours))
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 300 : 12 + index / (data.length - 1) * 576
    const y = 156 - item.hours / maxHours * 124
    return { ...item, x, y }
  })
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const area = `12,166 ${line} 588,166`
  const tickIndexes = data.length <= 7 ? data.map((_, index) => index) : data.map((_, index) => index).filter((index) => index % 5 === 0 || index === data.length - 1)
  return <div className="chart-wrap"><svg className="chart-svg" viewBox="0 0 600 176" preserveAspectRatio="none" role="img" aria-label="Practice hours over time"><defs><linearGradient id="practiceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e98869" stopOpacity="0.24" /><stop offset="100%" stopColor="#e98869" stopOpacity="0.015" /></linearGradient></defs>{[32, 74, 116, 158].map((y) => <line key={y} x1="10" y1={y} x2="590" y2={y} className="chart-grid-line" />)}<polygon points={area} fill="url(#practiceFill)" /><polyline points={line} fill="none" className="chart-line" />{points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.2" className="chart-point"><title>{point.hours} hours on {point.date}</title></circle>)}</svg><div className="chart-labels">{tickIndexes.map((index) => <span key={data[index].date}>{data[index].day}</span>)}</div></div>
}

function buildChartData(sessions, days) {
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(today, index - (days - 1))
    const minutes = sessions.filter((session) => session.date === date).reduce((total, session) => total + Number(session.minutes), 0)
    const parsed = new Date(`${date}T12:00:00`)
    return { date, day: days === 7 ? parsed.toLocaleDateString('en', { weekday: 'short' }) : parsed.toLocaleDateString('en', { month: 'short', day: 'numeric' }), hours: Number((minutes / 60).toFixed(1)) }
  })
}

function PracticePage({ skills, sessions, stats, onAction }) {
  return <><PageTitle eyebrow="YOUR PRACTICE" title={<>A practice that<br /><em>fits your life.</em></>} description="Every session counts. Here’s the shape of yours." action={<button className="button button-dark" onClick={() => onAction('session')}><Plus size={17} /> Log practice</button>} /><div className="practice-overview"><div className="metric-strip"><div><span>Total time</span><strong>{Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m</strong></div><div><span>This week</span><strong>{Math.floor(stats.weekMinutes / 60)}h {stats.weekMinutes % 60}m</strong></div><div><span>Sessions</span><strong>{sessions.length}</strong></div></div><div className="practice-layout"><section className="panel sessions-panel"><div className="panel-heading"><div><div className="section-kicker">RECENT SESSIONS</div><h2>Your time, well spent.</h2></div></div>{sessions.length ? <div className="session-list">{sessions.slice(0, 12).map((session) => { const skill = skills.find((item) => item.id === session.skillId) || { name: 'Practice', color: 'green', icon: '✳' }; return <div className="session-row" key={session.id}><span className={`skill-symbol symbol-${skill.color}`}>{skill.icon}</span><div className="session-copy"><strong>{session.activity}</strong><small>{skill.name} <span>·</span> {formatDate(session.date)}</small></div><span className="session-duration">{session.minutes} min</span></div> })}</div> : <EmptyState title="Your first session starts here." action={() => onAction('session')} />}</section><section className="panel practice-side"><div className="section-kicker">A GOOD PLACE TO BEGIN</div><h2>Consistency over intensity.</h2><p>Small sessions make a practice easier to return to. Try adding ten quiet minutes to your day.</p><button className="button button-outline" onClick={() => onAction('skill')}><Plus size={16} /> Add a practice</button><div className="side-illustration"><div className="sun-disc" /><span>✳</span><span>✦</span></div></section></div></div></>
}

function CommunityPage({ posts, onAction, onLike, onComment }) {
  return <><PageTitle eyebrow="YOUR COMMUNITY" title={<>Good things grow<br /><em>when shared.</em></>} description="A quiet corner for the things you’re learning." action={<button className="button button-dark" onClick={() => onAction('post')}><Plus size={17} /> Share an update</button>} /><div className="community-layout"><section className="panel community-feed-full"><div className="feed-filter"><span>RECENT UPDATES</span><button><Settings2 size={14} /> Recent <ChevronDown size={13} /></button></div>{posts.length ? posts.map((post) => <FeedPost key={post.id} post={post} onLike={onLike} onComment={onComment} />) : <EmptyState title="Be the first to share a small win." action={() => onAction('post')} />}</section><aside className="community-aside"><div className="community-note"><div className="note-icon"><Sparkles size={18} /></div><div className="section-kicker">A THOUGHT FOR TODAY</div><p>“The secret of getting ahead is getting started.”</p><small>Mark Twain</small></div><div className="community-topics"><div className="section-kicker">IN GOOD COMPANY</div><h3>Popular practices</h3><div><span>Photography</span><small>148 practicing</small></div><div><span>Creative writing</span><small>96 practicing</small></div><div><span>Music & sound</span><small>82 practicing</small></div></div></aside></div></>
}

function MilestonesPage({ skills, stats, onAction }) {
  const milestones = [{ title: 'Your first practice', detail: 'The hardest part is starting.', complete: true, icon: Check }, { title: 'A week of showing up', detail: 'Seven days of making time for you.', complete: stats.currentStreak >= 7, icon: Flame }, { title: 'Ten hours in', detail: 'Time spent is progress made.', complete: stats.totalMinutes >= 600, icon: Clock3 }, { title: 'Share your first win', detail: 'Let your community celebrate with you.', complete: false, icon: Heart }]
  return <><PageTitle eyebrow="MILESTONES" title={<>Notice how far<br /><em>you’ve come.</em></>} description="Progress isn’t always loud. These are worth noticing." action={<button className="button button-dark" onClick={() => onAction('post')}><Plus size={17} /> Share a milestone</button>} /><div className="milestone-summary"><span className="trophy-mark"><Trophy size={21} /></span><div><strong>{milestones.filter((item) => item.complete).length} little wins</strong><small>Every one of them counts.</small></div><span className="summary-skills">{skills.length} practices in motion</span></div><div className="milestone-grid">{milestones.map(({ title, detail, complete, icon: Icon }, index) => <article className={`milestone-card ${complete ? 'milestone-complete' : ''}`} key={title}><div className="milestone-number">0{index + 1}</div><div className="milestone-icon"><Icon size={20} /></div>{complete && <span className="earned-label"><Check size={12} /> EARNED</span>}<h2>{title}</h2><p>{detail}</p><div className="milestone-bottom"><span>{complete ? 'A moment to be proud of.' : 'Your next little step'}</span>{complete && <Sparkles size={15} />}</div></article>)}</div></>
}

function PageTitle({ eyebrow, title, description, action }) {
  return <section className="page-title-row"><div><div className="eyebrow"><span className="live-dot" /> {eyebrow}</div><h1>{title}</h1><p className="welcome-sub">{description}</p></div>{action}</section>
}

function EmptyState({ title, action }) {
  return <div className="empty-state"><span><Leaf size={22} /></span><strong>{title}</strong><button className="text-link" onClick={action}>Get started <ArrowRight size={14} /></button></div>
}

function ActionModal({ type, skills, onClose, onSession, onSkill, onGoal, onPost }) {
  const [form, setForm] = useState({ date: today, minutes: 20, category: 'Creative', level: 'Beginner', targetHours: 10 })
  const [fileName, setFileName] = useState('')
  const [fileData, setFileData] = useState('')
  const [fileError, setFileError] = useState('')
  const title = { session: 'Log a little progress', skill: 'Start something new', goal: 'Make a gentle promise', post: 'Share a small win' }[type]
  const description = { session: 'A few minutes count. Tell us what you worked on.', skill: 'Pick something you’re curious about. You can always adjust later.', goal: 'Give your practice a direction, not a deadline to dread.', post: 'Your progress might be the nudge someone else needs.' }[type]
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function submit(event) {
    event.preventDefault()
    if (type === 'session') onSession({ skillId: form.skillId || skills[0]?.id, date: form.date, minutes: Number(form.minutes), activity: form.activity.trim(), notes: (form.notes || '').trim() })
    if (type === 'skill') onSkill({ name: form.name.trim(), category: form.category, level: form.level, target: form.target.trim() || 'Build a steady practice' })
    if (type === 'goal') onGoal({ skillId: form.skillId || skills[0]?.id, title: form.title.trim(), targetMinutes: Number(form.targetHours) * 60 })
    if (type === 'post') onPost({ skill: form.skill || skills[0]?.name || 'My practice', text: form.text.trim(), image: fileData })
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className="modal-mark"><Leaf size={18} /></span><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div><div className="section-kicker">{type === 'session' ? 'MAKE IT COUNT' : type === 'skill' ? 'BEGIN ANYWHERE' : 'COMMUNITY NOTE'}</div><h2 id="modal-title">{title}</h2><p className="modal-description">{description}</p><form onSubmit={submit}>
    {type === 'session' && <><label>What did you practice?<input required autoFocus value={form.activity || ''} onChange={(event) => update('activity', event.target.value)} placeholder="e.g. Fingerpicking patterns" /></label><div className="form-row"><label>Practice<select value={form.skillId || skills[0]?.id || ''} onChange={(event) => update('skillId', event.target.value)}>{skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.name}</option>)}</select></label><label>Minutes<input type="number" min="1" max="1440" required value={form.minutes} onChange={(event) => update('minutes', event.target.value)} /></label></div><label>Date<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label><label>Notes <span className="optional-label">OPTIONAL</span><textarea rows="2" value={form.notes || ''} onChange={(event) => update('notes', event.target.value)} placeholder="Anything you want to remember?" /></label></>}
    {type === 'skill' && <><label>What are you curious about?<input required autoFocus value={form.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Watercolor painting" /></label><div className="form-row"><label>Category<select value={form.category} onChange={(event) => update('category', event.target.value)}>{['Creative', 'Music', 'Photography', 'Languages', 'Fitness', 'Cooking', 'Other'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Starting level<select value={form.level} onChange={(event) => update('level', event.target.value)}>{['Beginner', 'Intermediate', 'Advanced'].map((value) => <option key={value}>{value}</option>)}</select></label></div><label>What would you like to do?<input value={form.target || ''} onChange={(event) => update('target', event.target.value)} placeholder="A small goal for this practice" /></label></>}
    {type === 'goal' && <><label>What would you like to work toward?<input required autoFocus value={form.title || ''} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Practice 10 hours" /></label><div className="form-row"><label>Practice<select value={form.skillId || skills[0]?.id || ''} onChange={(event) => update('skillId', event.target.value)}>{skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.name}</option>)}</select></label><label>Target hours<input type="number" min="1" max="500" required value={form.targetHours} onChange={(event) => update('targetHours', event.target.value)} /></label></div></>}
    {type === 'post' && <><label>Your update<textarea required autoFocus rows="4" maxLength="500" value={form.text || ''} onChange={(event) => update('text', event.target.value)} placeholder="What have you been learning lately?" /></label><label>Practice<select value={form.skill || skills[0]?.name || ''} onChange={(event) => update('skill', event.target.value)}>{skills.map((skill) => <option key={skill.id}>{skill.name}</option>)}<option>Something new</option></select></label><label className="upload-label"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; setFileError(''); if (!file) return; if (!file.type.startsWith('image/') || file.size > 350000) { setFileError('Choose an image smaller than 350 KB.'); setFileName(''); setFileData(''); return } const reader = new FileReader(); reader.onload = () => { setFileName(file.name); setFileData(String(reader.result)) }; reader.readAsDataURL(file) }} /><ImagePlus size={17} />{fileName || 'Add a photo'}<span className="optional-label">OPTIONAL</span></label>{fileError && <p className="form-error" role="alert">{fileError}</p>}</>}
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-dark">{type === 'session' ? 'Save session' : type === 'skill' ? 'Start practice' : type === 'goal' ? 'Set this goal' : 'Share update'} <ArrowRight size={15} /></button></div></form></section></div>
}

function formatDate(date) {
  if (date === today) return 'Today'
  if (date === shiftDate(today, -1)) return 'Yesterday'
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default App