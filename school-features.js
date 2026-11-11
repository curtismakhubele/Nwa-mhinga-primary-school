/* School portal feature layer. Uses the existing local prototype store until an Azure API is configured. */
db.mediaPosts ||= [];
db.learnerAttendance ||= [];
db.learnerReports ||= [];
db.assessments ||= [];
Object.entries({
  Admin:["media","admissions"], Principal:["media","admissions"],
  "Vice Principal":[], Teacher:[], Parent:[], Learner:[]
}).forEach(([role,pages])=>{
  db.permissions[role] ||= [];
  pages.forEach(page=>{if(!db.permissions[role].includes(page))db.permissions[role].push(page)});
});
save();

const liveYear=()=>new Date().getFullYear();
const publicUrl=value=>{try{const u=new URL(value,location.href);return ["http:","https:"].includes(u.protocol)?esc(u.href):""}catch{return ""}};
const displaySurname=l=>l.surname||String(l.name||"").trim().split(/\s+/).slice(-1)[0]||"";
const displayGiven=l=>l.firstName||String(l.name||"").trim().split(/\s+/).slice(0,-1).join(" ");
const terms=["Term 1","Term 2","Term 3","Term 4"];

const oldLogin=window.login;
window.login=function(){
  oldLogin();
  const panel=document.querySelector(".login-panel");
  if(!panel)return;
  const directions=document.createElement("a");
  directions.className="school-directions";
  directions.href="https://www.google.com/maps/dir/?api=1&destination=02+Ntsu+Street%2C+Saulsville%2C+Pretoria%2C+0125";
  directions.target="_blank";directions.rel="noopener noreferrer";
  directions.textContent="Get directions to N'wa Mhinga Primary School";
  panel.append(directions);
  const feed=document.createElement("section");feed.className="public-feed";feed.innerHTML=loginMedia();
  panel.append(feed);
};

function loginMedia(){
  const posts=[...db.mediaPosts].filter(p=>p.published!==false);
  return '<h2>School updates & learning</h2><p class="muted">Pictures, videos and lessons shared by the school.</p>'+
    (posts.length?posts.slice(0,4).map(p=>mediaCard(p,false)).join(""):'<p class="empty">School updates will appear here.</p>');
}
function mediaCard(p,admin){
  const url=publicUrl(p.url||"");
  const media=p.type==="Photo"&&url?'<img loading="lazy" src="'+url+'" alt="'+esc(p.title)+'">':
    p.type==="Video"&&url?'<video controls preload="none" src="'+url+'"></video>':
    p.type==="Lesson"&&url?'<a class="btn btn-blue" target="_blank" rel="noopener noreferrer" href="'+url+'">Open lesson</a>':
    '<p class="muted">Add a public HTTPS media link to show this item.</p>';
  return '<article class="media-card">'+media+'<h3>'+esc(p.title)+'</h3><p>'+esc(p.description||"")+'</p><small class="muted">'+esc(p.createdAt||"")+'</small>'+
    (admin?'<button class="btn btn-danger" onclick="removeMedia(\''+esc(p.id)+'\')">Remove</button>':'')+'</article>';
}
window.title=function(p){return ({media:"School Media & Lessons",admissions:"Admissions Inbox"}[p])||({dashboard:"Dashboard",users:"User & Access Management",learners:"Learner Records",classes:"My Classes",assessments:"Assessments",reports:"Learner Reports",upload:"Upload Educational Data",backup:"Cloud Backup",settings:"Settings",attendance:"Staff Attendance"}[p]||p)};
const basePageHTML=window.pageHTML;
window.pageHTML=function(p){if(p==="media")return mediaAdmin();if(p==="admissions")return admissionsInbox();return basePageHTML(p)};

function mediaAdmin(){
  return '<div class="page-title"><div><h1>School Media & Lessons</h1><div class="muted">Publish a public HTTPS link for photos, videos or lessons.</div></div></div>'+
   '<div class="note">This prototype stores posts in this browser only. Shared publishing requires the Azure API and storage to be connected.</div>'+
   '<div class="card"><div class="form-grid"><div class="field"><label for="mediaTitle">Title</label><input id="mediaTitle" class="input" maxlength="120"></div><div class="field"><label for="mediaType">Type</label><select id="mediaType"><option>Photo</option><option>Video</option><option>Lesson</option></select></div><div class="field wide"><label for="mediaUrl">Public media URL</label><input id="mediaUrl" class="input" type="url" placeholder="https://…"></div><div class="field wide"><label for="mediaDescription">Description</label><textarea id="mediaDescription" class="input" maxlength="500"></textarea></div></div><button class="btn btn-primary" onclick="publishMedia()">Publish</button></div>'+
   '<div class="media-grid">'+(db.mediaPosts.map(p=>mediaCard(p,true)).join("")||'<div class="card empty">No school media posted yet.</div>')+'</div>';
}
window.publishMedia=function(){
  const title=document.getElementById("mediaTitle")?.value.trim(),url=document.getElementById("mediaUrl")?.value.trim();
  if(!title||!publicUrl(url))return toast("Enter a title and a valid HTTP or HTTPS media URL.");
  db.mediaPosts.unshift({id:"M"+Date.now(),title,type:document.getElementById("mediaType").value,url,description:document.getElementById("mediaDescription").value.trim(),createdAt:new Date().toLocaleDateString()});
  save();render("media");toast("Media added to this browser.");
};
window.removeMedia=function(id){db.mediaPosts=db.mediaPosts.filter(p=>p.id!==id);save();render("media")};

function admissionsInbox(){
  let list=[];try{list=JSON.parse(localStorage.getItem("nwamhinga:learners")||"[]")}catch{}
  return '<div class="page-title"><div><h1>Admissions Inbox</h1><div class="muted">Review applications saved in this browser.</div></div></div>'+
   '<div class="note"><b>Local prototype:</b> the public form currently saves on the applicant’s device. This page cannot receive applications from other devices until secure Azure submission is configured.</div>'+
   '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Learner</th><th>Grade</th><th>Status</th><th>Saved</th><th></th></tr></thead><tbody>'+
   (list.map((r,i)=>'<tr><td>'+esc(r.reference)+'</td><td>'+esc(r.learner?.fullName||"")+'</td><td>'+esc(r.learner?.gradeAppliedFor||"")+'</td><td>'+esc(r.status||"Saved locally")+'</td><td>'+esc(r.submittedAt?new Date(r.submittedAt).toLocaleDateString():"")+'</td><td><button class="btn btn-blue" onclick="viewAdmission('+i+')">View</button></td></tr>').join("")||'<tr><td colspan="6"><div class="empty">No applications are saved in this browser.</div></td></tr>')+
   '</tbody></table></div></div>';
}
window.viewAdmission=function(index){
  let list=[];try{list=JSON.parse(localStorage.getItem("nwamhinga:learners")||"[]")}catch{}
  const r=list[index];if(!r)return toast("Application not found.");
  openModal("Admission "+r.reference,'<p><b>Learner:</b> '+esc(r.learner?.fullName)+' · '+esc(r.learner?.gradeAppliedFor)+'</p><p><b>Status:</b> '+esc(r.status)+'</p><p><b>Saved:</b> '+esc(r.submittedAt?new Date(r.submittedAt).toLocaleString():"")+'</p><h3>Application fields</h3><div class="table-wrap"><table class="table"><tbody>'+Object.entries(r.application||{}).map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join("")+'</tbody></table></div><h3>Document names</h3><p>'+Object.entries(r.documents||{}).map(([k,v])=>esc(k)+": "+esc((v||[]).map(x=>x.name).join(", "))).join("<br>")+'</p>');
};

window.classes=function(){
 const list=classesForUser();
 return '<div class="page-title"><div><h1>My Classes</h1><div class="muted">Select a class to see its learners.</div></div></div><div class="grade-grid">'+list.map((c,i)=>{
  const ls=assignedLearners().filter(l=>c.includes("/")?l.grade+" / "+l.class===c:l.grade===c);
  return '<button class="grade-card g'+(i%8+1)+' class-card" onclick="viewClass(\''+esc(c)+'\')"><h3>'+esc(c)+'</h3><strong>'+ls.length+'</strong><small>learners</small><span>View class list →</span></button>'
 }).join("")+'</div>';
};
window.viewClass=function(c){
 const ls=assignedLearners().filter(l=>c.includes("/")?l.grade+" / "+l.class===c:l.grade===c);
 openModal(c+' learners','<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Surname</th><th>ID</th><th>Gender</th><th></th></tr></thead><tbody>'+
 (ls.map(l=>'<tr><td>'+esc(displayGiven(l))+'</td><td>'+esc(displaySurname(l))+'</td><td>'+esc(l.nationalId||l.id)+'</td><td>'+esc(l.gender)+'</td><td><button class="btn btn-blue" onclick="viewLearner(\''+esc(l.id)+'\')">Learner profile</button></td></tr>').join("")||'<tr><td colspan="5">No learners.</td></tr>')+'</tbody></table></div>');
};

window.learnerTable=function(arr){
 return '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Surname</th><th>ID</th><th>Gender</th><th>Grade</th><th>Class</th><th></th></tr></thead><tbody>'+
 (arr.map(l=>'<tr><td><b>'+esc(displayGiven(l))+'</b></td><td>'+esc(displaySurname(l))+'</td><td>'+esc(l.nationalId||l.id)+'</td><td>'+esc(l.gender)+'</td><td>'+esc(l.grade)+'</td><td>'+esc(l.class)+'</td><td><button class="btn btn-blue" onclick="viewLearner(\''+esc(l.id)+'\')">View</button></td></tr>').join("")||'<tr><td colspan="7"><div class="empty">No records available for your access scope.</div></td></tr>')+'</tbody></table></div>';
};
window.viewLearner=function(id){
 const l=db.learners.find(x=>x.id===id);if(!l)return toast("Learner not found.");
 const year=liveYear(),assess=db.assessments.filter(a=>a.learnerId===id&&Number(a.year||year)===year),att=db.learnerAttendance.filter(a=>a.learnerId===id&&Number(a.year)===year);
 const subjects=[...new Set([...(l.subjects||"").split(",").map(s=>s.trim()).filter(Boolean),...assess.map(a=>a.subject)])];
 const marks=terms.map(t=>'<section class="term-block"><h4>'+t+' · '+year+'</h4><div class="table-wrap"><table class="table"><thead><tr><th>Subject</th><th>Mark</th></tr></thead><tbody>'+
 (assess.filter(a=>a.term===t).map(a=>'<tr><td>'+esc(a.subject)+'</td><td>'+esc(a.mark)+'%</td></tr>').join("")||'<tr><td colspan="2" class="muted">No marks captured for this term.</td></tr>')+'</tbody></table></div><p><b>Attendance:</b> '+esc(att.find(a=>a.term===t)?.percent??"Not captured")+(att.find(a=>a.term===t)?"%":"")+'</p></section>').join("");
 openModal("Learner Profile",'<div class="learner-summary"><h3>'+esc(l.name)+'</h3><p><b>Name:</b> '+esc(displayGiven(l))+' &nbsp; <b>Surname:</b> '+esc(displaySurname(l))+'</p><p><b>ID:</b> '+esc(l.nationalId||l.id)+' &nbsp; <b>Gender:</b> '+esc(l.gender)+'</p><p><b>Grade / class:</b> '+esc(l.grade)+' / '+esc(l.class)+' &nbsp; <b>Parent:</b> '+esc(l.parent||"—")+'</p><p><b>Subjects:</b> '+esc(subjects.join(", ")||"Not captured")+'</p><button class="btn btn-blue" onclick="downloadLearnerReport(\''+esc(l.id)+'\')">Download learner report</button>'+
 (["Admin","Principal","Vice Principal","Teacher"].includes(me().role)?' <button class="btn btn-soft" onclick="captureLearnerAttendance(\''+esc(l.id)+'\')">Capture attendance</button>':'')+'</div>'+marks);
};
window.captureLearnerAttendance=function(id){
 const l=db.learners.find(x=>x.id===id);if(!l)return;
 openModal("Capture term attendance",'<div class="form-grid"><div class="field"><label>Year</label><input id="laYear" class="input" type="number" value="'+liveYear()+'"></div><div class="field"><label>Term</label><select id="laTerm">'+terms.map(t=>'<option>'+t+'</option>').join("")+'</select></div><div class="field"><label>Attendance %</label><input id="laPercent" class="input" type="number" min="0" max="100"></div></div><button class="btn btn-primary" onclick="saveLearnerAttendance(\''+esc(l.id)+'\')">Save attendance</button>');
};
window.saveLearnerAttendance=function(id){
 const year=Number(document.getElementById("laYear").value),term=document.getElementById("laTerm").value,percent=Number(document.getElementById("laPercent").value);
 if(!year||percent<0||percent>100)return toast("Enter a valid year and attendance from 0 to 100.");
 const row=db.learnerAttendance.find(x=>x.learnerId===id&&x.year===year&&x.term===term);
 if(row)row.percent=percent;else db.learnerAttendance.push({id:"LA"+Date.now(),learnerId:id,year,term,percent});
 save();closeModal();viewLearner(id);toast("Term attendance saved in this browser.");
};
window.openLearner=function(){
 openModal("Add Learner",'<div class="form-grid"><div class="field"><label>First name(s)</label><input id="lName" class="input"></div><div class="field"><label>Surname</label><input id="lSurname" class="input"></div><div class="field"><label>ID / learner number</label><input id="lNationalId" class="input"></div><div class="field"><label>Gender</label><select id="lGender"><option value="">Select</option><option>Female</option><option>Male</option></select></div><div class="field"><label>Grade</label><select id="lGrade">'+["R",1,2,3,4,5,6,7].map(x=>'<option>Grade '+x+'</option>').join("")+'</select></div><div class="field"><label>Class</label><input id="lClass" class="input" value="A"></div><div class="field wide"><label>Subjects</label><input id="lSubjects" class="input" placeholder="Mathematics, English"></div><div class="field wide"><label>Parent / guardian</label><input id="lParent" class="input"></div></div><button class="btn btn-primary btn-full" onclick="saveLearner()">Save Learner</button>');
};
window.saveLearner=function(){
 const first=document.getElementById("lName").value.trim(),surname=document.getElementById("lSurname").value.trim();
 if(!first||!surname)return toast("Enter the learner's name and surname.");
 db.learners.push({id:"L"+Date.now().toString().slice(-6),name:first+" "+surname,firstName:first,surname,nationalId:document.getElementById("lNationalId").value.trim(),grade:lGrade.value,class:lClass.value||"A",gender:lGender.value,attendance:0,parent:lParent.value.trim(),subjects:lSubjects.value.trim()});
 save();closeModal();render("learners");toast("Learner added.");
};
window.openAssessment=function(){
 const ls=assignedLearners();
 openModal("Add Assessment",'<div class="field"><label>Learner</label><select id="aLearner">'+ls.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+' — '+esc(l.grade)+' '+esc(l.class)+'</option>').join("")+'</select></div><div class="form-grid"><div class="field"><label>Subject</label><input id="aSubject" class="input"></div><div class="field"><label>Year</label><input id="aYear" class="input" type="number" value="'+liveYear()+'"></div><div class="field"><label>Term</label><select id="aTerm">'+terms.map(t=>'<option>'+t+'</option>').join("")+'</select></div><div class="field"><label>Mark %</label><input id="aMark" class="input" type="number" min="0" max="100"></div></div><button class="btn btn-primary btn-full" onclick="saveAssessment()">Save Assessment</button>');
};
window.saveAssessment=function(){
 const mark=Number(document.getElementById("aMark").value),year=Number(document.getElementById("aYear").value);
 if(!document.getElementById("aSubject").value.trim()||!year||mark<0||mark>100)return toast("Enter a subject, year and mark from 0 to 100.");
 db.assessments.push({id:"A"+Date.now(),learnerId:document.getElementById("aLearner").value,subject:document.getElementById("aSubject").value.trim(),term:document.getElementById("aTerm").value,year,mark});
 save();closeModal();render("assessments");toast("Assessment saved in this browser.");
};
window.reports=function(){
 const ls=assignedLearners(),year=liveYear(),saved=db.learnerReports.filter(r=>ls.some(l=>l.id===r.learnerId)&&Number(r.year)===year);
 return '<div class="page-title"><div><h1>Learner Reports</h1><div class="muted">Generate and download term reports for '+year+'. Parents and learners see only their linked learner.</div></div></div><div class="note">Reports are generated from marks and attendance entered in this browser. Cloud archiving is not connected.</div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Learner</th><th>Grade</th><th>Year</th><th>Generated</th><th></th></tr></thead><tbody>'+
 (ls.map(l=>{const r=saved.find(x=>x.learnerId===l.id);return '<tr><td>'+esc(l.name)+'</td><td>'+esc(l.grade)+'</td><td>'+year+'</td><td>'+esc(r?.generatedAt||"Not generated")+'</td><td><button class="btn btn-primary" onclick="generateLearnerReport(\''+esc(l.id)+'\')">'+(r?"Regenerate":"Generate")+'</button> <button class="btn btn-blue" onclick="downloadLearnerReport(\''+esc(l.id)+'\')">Download CSV</button></td></tr>'}).join("")||'<tr><td colspan="5">No learner records in your access scope.</td></tr>')+'</tbody></table></div><p class="muted">Reports are stored in this browser only until Azure storage is configured.</p></div>';
};
window.generateLearnerReport=function(id){
 const learner=db.learners.find(x=>x.id===id);if(!learner)return;
 const report={id:"LR"+Date.now(),learnerId:id,year:liveYear(),generatedAt:new Date().toLocaleString(),marks:db.assessments.filter(a=>a.learnerId===id&&Number(a.year||liveYear())===liveYear()),attendance:db.learnerAttendance.filter(a=>a.learnerId===id&&Number(a.year)===liveYear())};
 db.learnerReports=db.learnerReports.filter(x=>!(x.learnerId===id&&Number(x.year)===report.year));db.learnerReports.push(report);save();render("reports");toast("Learner report generated.");
};
window.downloadLearnerReport=function(id){
 const l=db.learners.find(x=>x.id===id);if(!l)return;
 const marks=db.assessments.filter(a=>a.learnerId===id&&Number(a.year||liveYear())===liveYear()),attendance=db.learnerAttendance.filter(a=>a.learnerId===id&&Number(a.year)===liveYear());
 const rows=[["Learner Report",liveYear()],["Name",displayGiven(l)],["Surname",displaySurname(l)],["ID",l.nationalId||l.id],["Gender",l.gender],["Grade",l.grade],["Class",l.class],["Subjects",l.subjects||""],["Term","Subject","Mark"],...marks.map(a=>[a.term,a.subject,a.mark+"%"]),["Term","Attendance"],...terms.map(t=>[t,(attendance.find(a=>a.term===t)?.percent??"Not captured")+(attendance.some(a=>a.term===t)?"%":"")])];
 const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 download("learner-report-"+id+"-"+liveYear()+".csv",csv,"text/csv;charset=utf-8");
};
window.backup=function(){return '<div class="page-title"><div><h1>Cloud Backup</h1><div class="muted">Azure storage is not connected.</div></div></div><div class="card"><h3>Planned capacity: 250 TB</h3><p>Reports, admissions and uploaded documents remain in this browser until the Azure database and Blob Storage are provisioned and connected.</p><p class="badge gold">Not backing up to cloud</p></div>'};
window.runBackup=function(){toast("Azure cloud storage is not connected yet; no backup was made.")};

