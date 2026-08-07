const TOKEN = require('child_process').execSync('curl -s --noproxy "*" -X POST http://47.94.132.203:3000/api/auth/login -H "Content-Type: application/json" -d \'{"email":"vigor@example.com","password":"668668abcx"}\'', {encoding:'utf8'}).trim();
const t = JSON.parse(TOKEN).token;
const hdrs = {Authorization: 'Bearer ' + t};

async function main() {
  // Check session
  const s = await (await fetch('http://47.94.132.203:3000/api/training/sessions/3007d1b3-fb1e-4fdf-8fa4-ef05b62bddc6', {headers: hdrs})).json();
  console.log('Session status:', s.status);
  console.log('Session exists:', !!s.id);

  // Check report by session ID
  const r = await (await fetch('http://47.94.132.203:3000/api/reports/3007d1b3-fb1e-4fdf-8fa4-ef05b62bddc6', {headers: hdrs})).json();
  console.log('Report by sessionId:', r.error || ('Found! Score: ' + r.overallScore));
}
main().catch(console.error);
