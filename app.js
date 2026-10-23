const DB_KEY="nwaEduCloudV2";
const demo={
 school:{name:"N'WA MHINGA P",motto:"Education for a Better Tomorrow"},
 currentUser:null,
 users:[
  {id:"U001",name:"System Administrator",email:"admin@nwamhingap.co.za",role:"Admin",password:"Admin@123",assignedGrade:"All",assignedClass:"All",status:"Active"},
  {id:"U002",name:"Ms Principal",email:"principal@nwamhingap.co.za",role:"Principal",password:"Principal@123",assignedGrade:"All",assignedClass:"All",status:"Active"},
  {id:"U003",name:"Mr Vice Principal",email:"vp@nwamhingap.co.za",role:"Vice Principal",password:"Vice@123",assignedGrade:"Grade 4-7",assignedClass:"All",status:"Active"},
  {id:"U004",name:"Mr Dlamini",email:"teacher3@nwamhingap.co.za",role:"Teacher",password:"Teacher@123",assignedGrade:"Grade 3",assignedClass:"3A",status:"Active"},
  {id:"U005",name:"Ms Mokoena",email:"teacher6@nwamhingap.co.za",role:"Teacher",password:"Teacher@456",assignedGrade:"Grade 6",assignedClass:"6A",status:"Active"},
  {id:"U006",name:"Parent Demo",email:"parent@nwamhingap.co.za",role:"Parent",password:"Parent@123",assignedGrade:"Grade 3",assignedClass:"3A",status:"Active",learnerId:"L001"},
  {id:"U007",name:"Learner Demo",email:"learner@nwamhingap.co.za",role:"Learner",password:"Learner@123",assignedGrade:"Grade 3",assignedClass:"3A",status:"Active",learnerId:"L001"}
 ],
 learners:[
  {id:"L001",name:"Thabo Mokoena",grade:"Grade 3",class:"3A",gender:"M",attendance:96,parent:"Parent Demo",subjects:"Mathematics, English, Life Skills"},
  {id:"L002",name:"Nomsa Dlamini",grade:"Grade 3",class:"3A",gender:"F",attendance:94,parent:"Mrs Dlamini",subjects:"Mathematics, English, isiZulu"},
  {id:"L003",name:"Sipho Nkosi",grade:"Grade 3",class:"3A",gender:"M",attendance:91,parent:"Mr Nkosi",subjects:"English, Science"},
  {id:"L004",name:"Lerato Masuku",grade:"Grade 3",class:"3A",gender:"F",attendance:98,parent:"Mrs Masuku",subjects:"English, Social Science"},
  {id:"L005",name:"Kabelo Ndlovu",grade:"Grade 3",class:"3A",gender:"M",attendance:89,parent:"Mr Ndlovu",subjects:"Mathematics, Life Skills"},
  {id:"L006",name:"Amahle Dlamini",grade:"Grade 1",class:"1A",gender:"F",attendance:97,parent:"Parent Demo",subjects:"Literacy, Numeracy"},
  {id:"L007",name:"Siyabonga Zulu",grade:"Grade 2",class:"2A",gender:"M",attendance:90,parent:"Mr Zulu",subjects:"Mathematics, English"},
  {id:"L008",name:"Lerato Nkosi",grade:"Grade 7",class:"7A",gender:"F",attendance:98,parent:"Mrs Nkosi",subjects:"English, Mathematics"},
  {id:"L009",name:"Peter Maseko",grade:"Grade 6",class:"6A",gender:"M",attendance:93,parent:"Mr Maseko",subjects:"Mathematics, Science"}
 ],
 assessments:[
  {id:"A001",learnerId:"L001",subject:"Mathematics",term:"Term 2",mark:78},
  {id:"A002",learnerId:"L001",subject:"English",term:"Term 2",mark:82},
  {id:"A003",learnerId:"L002",subject:"Mathematics",term:"Term 2",mark:74},
  {id:"A004",learnerId:"L008",subject:"English",term:"Term 2",mark:89}
 ],
 docs:[
  {id:"D001",name:"Grade 3 Term 2 Results.xlsx",category:"Academic",owner:"Mr Dlamini",date:"2026-10-05",size:"248 KB"},
  {id:"D002",name:"School Policy.pdf",category:"School",owner:"Admin",date:"2026-10-06",size:"1.2 MB"}
 ],
 permissions:{
  Admin:["dashboard","users","learners","classes","assessments","reports","upload","backup","settings","attendance"],
  Principal:["dashboard","users","learners","classes","assessments","reports","upload","backup","settings","attendance"],
  "Vice Principal":["dashboard","learners","classes","assessments","reports","upload","backup","attendance"],
  Teacher:["dashboard","learners","classes","assessments","reports","upload","attendance"],
  Parent:["dashboard","learners","assessments","reports"],
  Learner:["dashboard","assessments","reports"]
 },
 backup:{last:"Today, 14:32",status:"Completed",used:"2.4 GB / 10 GB",percent:82}
};
let db=JSON.parse(localStorage.getItem(DB_KEY)||"null")||demo;
function save(){localStorage.setItem(DB_KEY,JSON.stringify(db))}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function initials(n){return n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function toast(m){const x=document.querySelector(".toast");if(!x)return;x.textContent=m;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function login(){
 document.getElementById("app").innerHTML=`<div class="login"><section class="hero">
 <div class="brand-lockup"><img class="logo-exact hero-logo" src="nwa-mhinga-p-logo.png" alt="N'WA MHINGA P logo"><div><div style="font-size:22px;font-weight:900">N'WA MHINGA P</div><div style="opacity:.8">School Data Management System</div></div></div>
 <h1>N'WA MHINGA P</h1><h2>School Data Management System</h2><p>Upload &nbsp; • &nbsp; Store &nbsp; • &nbsp; Access &nbsp; • &nbsp; Learn</p>
 <div class="pill-row"><span class="pill">Secure School Data</span><span class="pill">Cloud Backup</span><span class="pill">Grade R–7</span><span class="pill">Parent & Learner Portal</span></div>
 <div style="position:relative;z-index:2;margin-top:35px;font-style:italic;font-size:18px">Better Data. Brighter Futures.</div>
 </section><section class="login-panel"><div class="login-card">
 <img class="logo-exact login-logo" src="nwa-mhinga-p-logo.png" alt="School logo"><div class="mini-brand">N'WA MHINGA <span>P</span></div><div class="muted">School Data Management System</div>
 <h2>Welcome Back</h2><div class="muted">Sign in to access your learning platform</div>
 <div class="field"><label>Username / Email</label><input id="email" class="input" value="admin@nwamhingap.co.za"></div>
 <div class="field"><label>Password</label><input id="password" class="input" type="password" value="Admin@123"></div>
 <button class="btn btn-primary btn-full" onclick="doLogin()">Login</button>
 <div style="text-align:center;margin-top:12px"><button class="btn btn-soft" onclick="forgot()">Forgot Password?</button></div>
 <div class="demo-box"><b>Demo accounts</b><br>Admin: admin@nwamhingap.co.za / Admin@123<br>Principal: principal@nwamhingap.co.za / Principal@123<br>Teacher: teacher3@nwamhingap.co.za / Teacher@123<br>Parent: parent@nwamhingap.co.za / Parent@123<br>Learner: learner@nwamhingap.co.za / Learner@123</div>
 </div></section></div>`;
}
function doLogin(){
 const e=document.getElementById("email").value.trim().toLowerCase(),p=document.getElementById("password").value;
 const u=db.users.find(x=>x.email.toLowerCase()===e&&x.password===p&&x.status==="Active");
 if(!u)return alert("Invalid credentials. Please check your username and password.");
 db.currentUser=u.id;save();render("dashboard");toast("Welcome, "+u.name);
}
function forgot(){alert("Password reset: ask the school administrator to issue a temporary password. Production version should connect this flow to secure email/SMS reset.")}
function logout(){db.currentUser=null;save();login()}
function me(){return db.users.find(u=>u.id===db.currentUser)||db.users[0]}
function can(page){return (db.permissions[me().role]||[]).includes(page)}
function assignedLearners(){
 const u=me();
 if(["Admin","Principal"].includes(u.role))return db.learners;
 if(u.role==="Vice Principal"){
   if(u.assignedGrade==="All")return db.learners;
   if(u.assignedGrade==="Grade 4-7")return db.learners.filter(l=>Number(l.grade.replace("Grade ",""))>=4);
   return db.learners.filter(l=>l.grade===u.assignedGrade);
 }
 if(u.role==="Teacher")return db.learners.filter(l=>l.grade===u.assignedGrade&&l.class===u.assignedClass);
 if(["Parent","Learner"].includes(u.role))return db.learners.filter(l=>l.id===u.learnerId);
 return [];
}
function title(p){return ({dashboard:"Dashboard",users:"User & Access Management",learners:"Learner Records",classes:"My Classes",assessments:"Assessments",reports:"Reports",upload:"Upload Educational Data",backup:"Cloud Backup",settings:"Settings",attendance:"Staff Attendance"}[p]||p)}
function render(page="dashboard"){
 if(!can(page))page="dashboard";
 const u=me(), nav=[
  ["dashboard","⌂","Dashboard"],["classes","▦","My Classes"],["attendance","◷","Staff Attendance"],["learners","♟","Learners"],["assessments","▣","Assessments"],["reports","▤","Reports"],["upload","⇧","Upload Data"],["backup","☁","Cloud Backup"],["users","♙","Users & Access"],["settings","⚙","Settings"]
 ];
 document.getElementById("app").innerHTML=`<div class="shell"><aside class="sidebar" id="side">
 <div class="side-head"><img class="logo-exact side-logo" src="nwa-mhinga-p-logo.png" alt="N'WA MHINGA P logo"><div class="side-title">N'WA MHINGA P<small>School Data Management</small></div></div>
 <div class="nav">${nav.map(n=>can(n[0])?`<button class="${page===n[0]?'active':''}" onclick="render('${n[0]}')">${n[1]} &nbsp; ${n[2]}</button>`:"").join("")}</div>
 <div class="nav-section">Account</div><div class="nav"><button onclick="changePassword()">🔒 Change Password</button><button onclick="logout()">↪ Logout</button></div>
 </aside><main class="main"><header class="topbar"><div class="top-left"><button class="hamb" onclick="document.getElementById('side').classList.toggle('open')">☰</button><div><b>${title(page)}</b><div class="crumb">${esc(db.school.name)} / ${esc(u.role)}</div></div></div>
 <div class="user-area"><div class="avatar">${initials(u.name)}</div><div class="user-text"><b>${esc(u.name)}</b><div class="muted">${esc(u.role)} · ${esc(u.assignedGrade||"All")}</div></div><button class="btn btn-soft" onclick="changePassword()">Password</button></div></header>
 <section class="content">${pageHTML(page)}</section></main></div><div class="mobile-bottom"><button onclick="render('dashboard')">⌂<br>Home</button><button onclick="render('learners')">♟<br>Learners</button><button onclick="render('assessments')">▣<br>Marks</button><button onclick="changePassword()">🔒<br>Password</button></div><div id="modal" class="modal"></div><div class="toast"></div>`;
}
function stat(icon,label,num,sub){return `<div class="card stat"><div><div class="muted">${label}</div><div class="num">${num}</div><div class="muted">${sub}</div></div><div class="stat-icon">${icon}</div></div>`}
function pageHTML(p){
 if(p==="dashboard")return dashboard(); if(p==="users")return users(); if(p==="learners")return learners(); if(p==="classes")return classes();
 if(p==="assessments")return assessments(); if(p==="reports")return reports(); if(p==="upload")return upload(); if(p==="backup")return backup(); if(p==="attendance")return staffAttendancePage(); return settings();
}
function dashboard(){
 const u=me(), ls=assignedLearners(), n=ls.length;
 let cards=stat("♟","Total Learners",n,u.role==="Teacher"?"Your assigned learners":"School/assigned learners")+stat("▦","My Classes",classesForUser().length,"Assigned classes")+stat("▣","Assessments",db.assessments.filter(a=>ls.some(l=>l.id===a.learnerId)).length,"Available records")+stat("☁","Last Backup",db.backup.last,"Cloud protection");
 return `<div class="page-title"><div><h1>Dashboard</h1><div class="muted">Welcome, ${esc(u.name)}</div></div><div class="actions">${u.role==="Admin"?`<button class="btn btn-primary" onclick="openUser()">+ Create User</button>`:""}<button class="btn btn-blue" onclick="render('upload')">Upload Data</button></div></div>
 <div class="cards">${cards}</div><div class="grid2"><div class="card"><div class="section-title"><h3>Class Overview</h3><span class="muted">${esc(u.role)} access</span></div><div class="grade-grid">${["R",1,2,3,4,5,6,7].map((g,i)=>{let grade="Grade "+g, a=ls.filter(l=>l.grade===grade);return `<div class="grade-card g${i+1}"><h3>${grade}</h3><strong>${a.length}</strong><small>learners</small></div>`}).join("")}</div></div>
 <div class="card"><div class="section-title"><h3>Recent Activity</h3><button class="btn btn-soft" onclick="render('reports')">View All</button></div><p><span class="badge blue">Academic</span> Grade 3 English marks uploaded.</p><p><span class="badge">Backup</span> Cloud backup completed.</p><p><span class="badge">Access</span> User permissions enforced by role.</p><p><span class="badge gold">System</span> Password management available.</p></div></div>
 <div class="grid3"><div class="card"><h3>Access control</h3><p class="muted">Teachers see only their assigned grade/class. Parents and learners see only linked learner information.</p></div><div class="card"><h3>Cloud backup</h3><p class="muted">School records are prepared for automatic encrypted cloud backup and restore.</p></div><div class="card"><h3>Security</h3><p class="muted">Admin assigns roles, credentials, grade/class access and account status.</p></div></div>`;
}
function classesForUser(){
 const u=me(); if(["Admin","Principal"].includes(u.role))return ["Grade R","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"];
 if(u.role==="Vice Principal"&&u.assignedGrade==="Grade 4-7")return ["Grade 4","Grade 5","Grade 6","Grade 7"];
 if(u.role==="Teacher")return [u.assignedGrade+" / "+u.assignedClass];
 if(["Parent","Learner"].includes(u.role))return [u.assignedGrade+" / "+u.assignedClass];
 return [];
}
function users(){
 if(me().role!=="Admin")return `<div class="page-title"><div><h1>User & Access Management</h1><div class="muted">Only the system administrator can assign credentials and access.</div></div></div><div class="card"><div class="empty">Administrator access required.</div></div>`;
 return `<div class="page-title"><div><h1>User & Access Management</h1><div class="muted">Create accounts, assign roles, grade/class scope, credentials and permissions.</div></div><button class="btn btn-primary" onclick="openUser()">+ Create User</button></div>
 <div class="card"><div class="toolbar"><input id="userQ" class="input" placeholder="Search name/email..." oninput="filterUsers()"><select id="userRole" onchange="filterUsers()"><option value="">All roles</option>${["Admin","Principal","Vice Principal","Teacher","Parent","Learner"].map(x=>`<option>${x}</option>`).join("")}</select></div><div id="usersTable">${userTable(db.users)}</div></div>`;
}
function userTable(arr){return `<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Role</th><th>Grade</th><th>Class</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>${arr.map(u=>`<tr><td><b>${esc(u.name)}</b><div class="muted">${u.id}</div></td><td><span class="badge blue">${esc(u.role)}</span></td><td>${esc(u.assignedGrade)}</td><td>${esc(u.assignedClass)}</td><td>${esc(u.email)}</td><td><span class="badge ${u.status==="Active"?"":"red"}">${u.status}</span></td><td><button class="btn btn-soft" onclick="editUser('${u.id}')">Edit Access</button> <button class="btn btn-danger" onclick="resetUserPassword('${u.id}')">Generate Password</button></td></tr>`).join("")}</tbody></table></div>`}
function filterUsers(){let q=(userQ.value||"").toLowerCase(),r=userRole.value;usersTable.innerHTML=userTable(db.users.filter(u=>(u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q))&&(!r||u.role===r)))}
function learners(){
 const ls=assignedLearners();
 return `<div class="page-title"><div><h1>Learner Records</h1><div class="muted">${me().role==="Teacher"?"Restricted to your assigned class.":"Access is controlled by role and assignment."}</div></div>${["Admin","Principal"].includes(me().role)?`<button class="btn btn-primary" onclick="openLearner()">+ Add Learner</button>`:""}</div>
 <div class="card"><div class="toolbar"><input id="learnerQ" class="input" placeholder="Search by name or ID..." oninput="filterLearners()"><select id="learnerGrade" onchange="filterLearners()"><option value="">All Grades</option>${["R",1,2,3,4,5,6,7].map(g=>`<option>Grade ${g}</option>`).join("")}</select></div><div id="learnerTable">${learnerTable(ls)}</div></div>`;
}
function learnerTable(arr){return `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Name</th><th>ID Number</th><th>Gender</th><th>Grade</th><th>Subjects</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${arr.map((l,i)=>`<tr><td>${i+1}</td><td><b>${esc(l.name)}</b></td><td>${l.id}</td><td>${l.gender}</td><td>${l.grade}</td><td>${esc(l.subjects)}</td><td>${l.attendance}%</td><td><button class="btn btn-blue" onclick="viewLearner('${l.id}')">View</button></td></tr>`).join("")||`<tr><td colspan="8"><div class="empty">No records available for your access scope.</div></td></tr>`}</tbody></table></div>`}
function filterLearners(){let q=(learnerQ.value||"").toLowerCase(),g=learnerGrade.value;learnerTable.innerHTML=learnerTable(assignedLearners().filter(l=>(l.name.toLowerCase().includes(q)||l.id.toLowerCase().includes(q))&&(!g||l.grade===g)))}
function classes(){return `<div class="page-title"><div><h1>My Classes</h1><div class="muted">Classes and grades available to your account.</div></div></div><div class="grade-grid">${classesForUser().map((c,i)=>{let ls=assignedLearners().filter(l=>(c.includes("/")?l.grade+" / "+l.class===c:l.grade===c));return `<div class="grade-card g${i%8+1}"><h3>${esc(c)}</h3><strong>${ls.length}</strong><small>learners in your access scope</small></div>`}).join("")}</div>`}
function assessments(){
 const ls=assignedLearners(), a=db.assessments.filter(x=>ls.some(l=>l.id===x.learnerId));
 return `<div class="page-title"><div><h1>Assessments</h1><div class="muted">Academic results within your assigned access.</div></div>${["Admin","Principal","Vice Principal","Teacher"].includes(me().role)?`<button class="btn btn-primary" onclick="openAssessment()">+ Add Assessment</button>`:""}</div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Learner</th><th>Subject</th><th>Term</th><th>Mark</th><th>Performance</th></tr></thead><tbody>${a.map(x=>{let l=ls.find(q=>q.id===x.learnerId);return `<tr><td>${esc(l?.name)}</td><td>${esc(x.subject)}</td><td>${x.term}</td><td><b>${x.mark}%</b></td><td><span class="badge ${x.mark<50?"red":x.mark<70?"gold":""}">${x.mark>=70?"Good":x.mark>=50?"Needs Support":"Intervention"}</span></td></tr>`}).join("")||`<tr><td colspan="5"><div class="empty">No assessment records.</div></td></tr>`}</tbody></table></div></div>`;
}
function reports(){return `<div class="page-title"><div><h1>Reports</h1><div class="muted">Generate reports using only data available to your role.</div></div></div><div class="grid3">
 ${["Academic Report","Attendance Report","Class Summary","Individual Learner Report","User Access Report","Backup Report"].map((x,i)=>`<div class="card"><h3>${x}</h3><p class="muted">Generate a structured ${x.toLowerCase()} for your access scope.</p><button class="btn btn-soft" onclick="toast('${x} generated')">View Report</button></div>`).join("")}</div>`}
function upload(){return `<div class="page-title"><div><h1>Upload Educational Data</h1><div class="muted">Upload CSV, Excel, PDF or other school records according to your permissions.</div></div></div><div class="grid2"><div class="card"><h3>Select destination</h3><div class="field"><label>Grade</label><select id="upGrade">${["Grade R","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"].map(g=>`<option ${me().assignedGrade===g?"selected":""}>${g}</option>`).join("")}</select></div><div class="field"><label>Subject</label><select id="upSubject"><option>Mathematics</option><option>English</option><option>Life Skills</option><option>Natural Sciences</option><option>Social Sciences</option><option>Other</option></select></div><div class="field"><label>File</label><input id="upFile" class="input" type="file" accept=".csv,.xlsx,.xls,.pdf,.doc,.docx"></div><button class="btn btn-primary" onclick="uploadFile()">Upload</button></div><div class="card"><h3>Supported File Types</h3><p>• CSV</p><p>• Excel (.xlsx/.xls)</p><p>• PDF</p><p>• Word documents</p><p class="muted">Maximum prototype upload size: 10 MB.</p></div></div>`}
function backup(){return `<div class="page-title"><div><h1>Cloud Backup</h1><div class="muted">Protect school educational records with scheduled backups.</div></div><button class="btn btn-blue" onclick="runBackup()">Backup Now</button></div><div class="cards">${stat("☁","Last Backup",db.backup.last,"Latest operation")}${stat("✓","Status",db.backup.status,"Cloud backup")}${stat("▣","Storage",db.backup.used,"Secure storage")}${stat("🔒","Security","Enabled","Production-ready architecture")}</div><div class="grid2"><div class="card backup"><h3>Your Data is Safe</h3><p class="muted">All school data is prepared for secure encrypted cloud backup.</p><div class="progress"><div style="width:${db.backup.percent}%"></div></div><p><b>${db.backup.percent}%</b> storage used</p><button class="btn btn-blue" onclick="runBackup()">Backup Now</button></div><div class="card"><h3>Backup contents</h3><p>✓ Learner records</p><p>✓ Teacher and user accounts</p><p>✓ Assessments</p><p>✓ Attendance</p><p>✓ Uploaded educational files</p><p>✓ Settings and audit records</p></div></div>`}
function settings(){return `<div class="page-title"><div><h1>Settings</h1><div class="muted">Account and school configuration.</div></div></div><div class="grid2"><div class="card"><h3>School Profile</h3><div class="field"><label>School name</label><input id="schoolName" class="input" value="${esc(db.school.name)}"></div><div class="field"><label>Motto</label><input id="schoolMotto" class="input" value="${esc(db.school.motto)}"></div><button class="btn btn-primary" onclick="saveSettings()">Save</button></div><div class="card"><h3>My Account</h3><p><b>${esc(me().name)}</b></p><p class="muted">${esc(me().email)} · ${esc(me().role)}</p><button class="btn btn-soft" onclick="changePassword()">Change Password</button></div></div>`}
function openModal(title,body){document.getElementById("modal").innerHTML=`<div class="modal-card"><div class="modal-head"><h2>${title}</h2><button class="btn btn-soft" onclick="closeModal()">✕</button></div>${body}</div>`;document.getElementById("modal").classList.add("open")}
function closeModal(){document.getElementById("modal").classList.remove("open")}
function openUser(existing=null){
 if(me().role!=="Admin")return;
 const u=existing||{name:"",email:"",role:"Teacher",assignedGrade:"Grade 3",assignedClass:"3A",status:"Active"};
 openModal(existing?"Edit User Access":"Create User",`<div class="form-grid">
 <div class="field"><label>Full name</label><input id="uName" class="input" value="${esc(u.name)}"></div>
 <div class="field"><label>Email / Username</label><input id="uEmail" class="input" value="${esc(u.email)}"></div>
 <div class="field"><label>Role</label><select id="uRole" onchange="roleFields()">${["Admin","Principal","Vice Principal","Teacher","Parent","Learner"].map(x=>`<option ${u.role===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="field"><label>Status</label><select id="uStatus"><option ${u.status==="Active"?"selected":""}>Active</option><option ${u.status==="Suspended"?"selected":""}>Suspended</option></select></div>
 <div class="field"><label>Assigned Grade</label><select id="uGrade">${["All","Grade R","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 4-7"].map(x=>`<option ${u.assignedGrade===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="field"><label>Assigned Class</label><input id="uClass" class="input" value="${esc(u.assignedClass||"All")}"></div>
 <div class="field wide"><label>Initial Password</label><div class="password-row"><input id="uPass" class="input" value="${esc(u.password||generatePassword())}"><button class="btn btn-blue" onclick="uPass.value=generatePassword()">Generate</button></div></div>
 </div>
 <div class="card" style="margin-top:15px;background:#f8fafc"><b>Access rule</b><p class="muted">Teacher accounts are restricted to their assigned grade/class. Parent and learner accounts are restricted to their linked learner. Principal and Vice Principal access follows their assigned scope.</p></div>
 <button class="btn btn-primary btn-full" onclick="saveUser('${existing?.id||""}')">${existing?"Save Access Changes":"Create User"}</button>`);
}
function generatePassword(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";let s="";for(let i=0;i<12;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s}
function roleFields(){}
function saveUser(id){
 let name=uName.value.trim(),email=uEmail.value.trim().toLowerCase(),pass=uPass.value;
 if(!name||!email||!pass)return toast("Complete all required fields");
 if(id){let u=db.users.find(x=>x.id===id);Object.assign(u,{name,email,password:pass,role:uRole.value,status:uStatus.value,assignedGrade:uGrade.value,assignedClass:uClass.value||"All"});toast("User access updated")}
 else{if(db.users.some(x=>x.email.toLowerCase()===email))return toast("Email already exists");let u={id:"U"+Date.now().toString().slice(-6),name,email,password:pass,role:uRole.value,status:uStatus.value,assignedGrade:uGrade.value,assignedClass:uClass.value||"All"};db.users.push(u);toast("User created. Credentials generated.");}
 save();closeModal();render("users");
}
function editUser(id){openUser(db.users.find(u=>u.id===id))}
function resetUserPassword(id){let u=db.users.find(x=>x.id===id);let p=generatePassword();u.password=p;save();openModal("New Temporary Password",`<p><b>${esc(u.name)}</b></p><p class="muted">Give this temporary password securely to the user. The user should change it after signing in.</p><div class="password-row"><input class="input" readonly value="${p}" id="tempPass"><button class="btn btn-blue" onclick="navigator.clipboard?.writeText(tempPass.value);toast('Password copied')">Copy</button></div><button class="btn btn-primary btn-full" onclick="closeModal()">Done</button>`)}
function changePassword(){
 openModal("Change My Password",`<p class="muted">For security, enter your current password and create a new password.</p><div class="field"><label>Current password</label><input id="oldPass" class="input" type="password"></div><div class="field"><label>New password</label><input id="newPass" class="input" type="password"></div><div class="field"><label>Confirm new password</label><input id="confirmPass" class="input" type="password"></div><button class="btn btn-primary btn-full" onclick="savePassword()">Change Password</button>`);
}
function savePassword(){
 if(oldPass.value!==me().password)return toast("Current password is incorrect");
 if(newPass.value.length<8)return toast("New password must be at least 8 characters");
 if(newPass.value!==confirmPass.value)return toast("Passwords do not match");
 me().password=newPass.value;save();closeModal();toast("Password changed successfully");
}
function openLearner(){openModal("Add Learner",`<div class="form-grid"><div class="field"><label>Full name</label><input id="lName" class="input"></div><div class="field"><label>Gender</label><select id="lGender"><option>M</option><option>F</option></select></div><div class="field"><label>Grade</label><select id="lGrade">${["Grade R","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"].map(x=>`<option>${x}</option>`).join("")}</select></div><div class="field"><label>Class</label><input id="lClass" class="input" value="A"></div><div class="field wide"><label>Parent / Guardian</label><input id="lParent" class="input"></div></div><button class="btn btn-primary btn-full" onclick="saveLearner()">Save Learner</button>`)}
function saveLearner(){if(!lName.value.trim())return toast("Enter learner name");db.learners.push({id:"L"+Date.now().toString().slice(-6),name:lName.value.trim(),grade:lGrade.value,class:lClass.value||"A",gender:lGender.value,attendance:100,parent:lParent.value||"",subjects:""});save();closeModal();render("learners");toast("Learner added")}
function viewLearner(id){let l=db.learners.find(x=>x.id===id),a=db.assessments.filter(x=>x.learnerId===id);openModal("Learner Profile",`<h3>${esc(l.name)}</h3><p><b>ID:</b> ${l.id} &nbsp; <b>Grade:</b> ${l.grade} &nbsp; <b>Class:</b> ${l.class}</p><p><b>Attendance:</b> ${l.attendance}%</p><p><b>Parent:</b> ${esc(l.parent)}</p><hr><h3>Assessments</h3>${a.map(x=>`<p>${esc(x.subject)} — ${x.mark}% (${x.term})</p>`).join("")||"<p class='muted'>No assessments.</p>"}`)}
function openAssessment(){let ls=assignedLearners();openModal("Add Assessment",`<div class="field"><label>Learner</label><select id="aLearner">${ls.map(l=>`<option value="${l.id}">${esc(l.name)} — ${l.grade} ${l.class}</option>`).join("")}</select></div><div class="form-grid"><div class="field"><label>Subject</label><input id="aSubject" class="input" placeholder="Mathematics"></div><div class="field"><label>Term</label><select id="aTerm"><option>Term 1</option><option>Term 2</option><option>Term 3</option><option>Term 4</option></select></div><div class="field"><label>Mark %</label><input id="aMark" class="input" type="number" min="0" max="100"></div></div><button class="btn btn-primary btn-full" onclick="saveAssessment()">Save Assessment</button>`)}
function saveAssessment(){let m=Number(aMark.value);if(!aSubject.value||isNaN(m))return toast("Complete assessment details");db.assessments.push({id:"A"+Date.now(),learnerId:aLearner.value,subject:aSubject.value,term:aTerm.value,mark:m});save();closeModal();render("assessments");toast("Assessment saved")}
function uploadFile(){let f=upFile.files[0];if(!f)return toast("Select a file");if(f.size>10*1024*1024)return toast("File exceeds 10 MB");db.docs.unshift({id:"D"+Date.now(),name:f.name,category:"Educational Data",owner:me().name,date:new Date().toISOString().slice(0,10),size:Math.round(f.size/1024)+" KB"});save();toast("Upload recorded and queued for cloud backup")}
function runBackup(){db.backup={last:"Today, "+new Date().toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"}),status:"Completed",used:"2.5 GB / 10 GB",percent:83};save();render("backup");toast("Cloud backup completed")}
function saveSettings(){db.school.name=schoolName.value||db.school.name;db.school.motto=schoolMotto.value||db.school.motto;save();toast("Settings saved");render("settings")}
login();
