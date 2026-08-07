const http = require('http');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU2NzhjMjFjLTYxZDItNDg2Ni05ZjNiLWMyYWY3MzQ2NTI1NiIsImVtYWlsIjoidmlnb3JAZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3ODQ3NjgwNTUsImV4cCI6MTc4NTM3Mjg1NX0.EKiSefGHJDIGx3JAinmkyDl3xMtId7EbG9bLD5GUJB0';

function get(path) {
  return new Promise((resolve, reject) => {
    const opts = {hostname:'localhost',port:3000,path,method:'GET',headers:{'Authorization':'Bearer '+TOKEN}};
    const req = http.request(opts, res => { let b=''; res.on('data',d=>b+=d); res.on('end',()=>resolve({status:res.statusCode,body:b})); });
    req.on('error', reject);
    req.end();
  });
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {hostname:'localhost',port:3000,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Authorization':'Bearer '+TOKEN}};
    const req = http.request(opts, res => { let b=''; res.on('data',d=>b+=d); res.on('end',()=>resolve({status:res.statusCode,body:b})); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Already done - login returned token
    console.log('## [1] API登录: 通过 (vigor@example.com/ADMIN)');

    // Step 2-3: Token persistence + roles
    const rolesRes = await get('/api/roles');
    if (rolesRes.status !== 200) { console.log('## [2-3] FAIL: 角色API返回 '+rolesRes.status); return; }
    const roles = JSON.parse(rolesRes.body);
    console.log('## [2] Token持久性验证: 通过 (同一token调GET /api/roles -> 200 OK)');
    console.log('## [3] 角色列表: '+roles.length+'个角色');

    // Step 4: Scenarios
    const scRes = await get('/api/scenarios');
    const scs = JSON.parse(scRes.body);
    console.log('## [4] 场景列表: '+scs.length+'个场景');

    // Step 5: Dashboard stats
    const statsRes = await get('/api/training/sessions/stats');
    const stats = JSON.parse(statsRes.body);
    console.log('## [5] 仪表盘统计: totalSessions='+stats.totalSessions+' totalRoles='+stats.totalRoles+' totalReports='+stats.totalReports+' avgScore='+stats.avgScore);

    // Step 6: Create session
    const firstRole = roles[0];
    const sessionRes = await post('/api/training/sessions', {roleId:firstRole.id});
    if (sessionRes.status !== 200 && sessionRes.status !== 201) {
      console.log('## [6] 创建会话: FAIL ('+sessionRes.status+') '+sessionRes.body.substring(0,200));
    } else {
      const session = JSON.parse(sessionRes.body);
      console.log('## [6] 创建会话: 通过 (role='+firstRole.name+', sessionId='+session.id+')');
      
      // Step 7: Chat
      const chatRes = await post('/api/training/sessions/'+session.id+'/chat', {message:'Hello, I am interested in your products.'});
      if (chatRes.status !== 200) {
        console.log('## [7] AI对话: FAIL ('+chatRes.status+') '+chatRes.body.substring(0,200));
      } else {
        const chat = JSON.parse(chatRes.body);
        const reply = chat.reply || chat.message || chat.response || '';
        console.log('## [7] AI对话回复: 通过 ('+reply.length+'字符)');
        console.log('   AI回复开头: '+reply.substring(0,100)+'...');
      }
    }

    // Step 11: Feedback
    const fbRes = await get('/api/feedback');
    const fb = JSON.parse(fbRes.body);
    if (Array.isArray(fb)) {
      const pending = fb.filter(f => f.status === 'PENDING');
      console.log('## [11] 待处理反馈: '+pending.length+'条');
      if (pending.length > 0) {
        pending.forEach((f, i) => {
          console.log('   --- 反馈 #'+(i+1)+' ---');
          console.log('   类型: '+(f.type||f.feedbackType||'N/A'));
          console.log('   内容: '+(f.content||f.message||f.description||'N/A'));
          console.log('   时间: '+(f.createdAt||f.submittedAt||'N/A'));
          console.log('   状态: '+f.status);
        });
      }
    } else {
      console.log('## [11] 反馈API返回: '+fbRes.body.substring(0,200));
    }

  } catch(e) {
    console.log('ERROR: '+e.message);
    console.log(e.stack);
  }
}

main().then(() => process.exit(0));
