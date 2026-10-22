import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function login(username, password) {
  const payload = JSON.stringify({ username, password });
  const res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);

  const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
  return cookie;
}

async function getAnalytics(cookie, queryParams = '') {
  return makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/dashboard/analytics${queryParams}`,
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  });
}

async function run() {
  console.log('Testing /api/dashboard/analytics for different roles...');

  // 1. Super Admin (All)
  const superCookie = await login('superadmin', 'Admin@12345');
  const superAllRes = await getAnalytics(superCookie, '?division=all');
  console.log('Super Admin (all): status =', superAllRes.status);
  console.log('Super Admin KPIs:', superAllRes.data.data.kpis);
  console.log('Super Admin Charts Keys:', Object.keys(superAllRes.data.data.charts));

  // 2. Super Admin (Institute Scope)
  const superInstRes = await getAnalytics(superCookie, '?division=institute');
  console.log('superInstRes:', superInstRes.status, superInstRes.data || superInstRes.raw);
  console.log('Super Admin (institute scope): students =', superInstRes.data?.data?.kpis?.total_students, 'classes =', superInstRes.data?.data?.kpis?.total_classes);

  // 3. Institute Admin (Cannot be bypassed to Quran)
  const instCookie = await login('instadmin', 'Admin@12345');
  const instRes = await getAnalytics(instCookie, '?division=quran');
  console.log('Institute Admin division forced to:', instRes.data.data.active_division);
  if (instRes.data.data.active_division !== 'institute') {
    throw new Error('Institute Admin was able to request quran division!');
  }

  // 4. Quran Admin (Cannot be bypassed to Institute)
  const quranCookie = await login('quranadmin', 'Admin@12345');
  const quranRes = await getAnalytics(quranCookie, '?division=institute');
  console.log('Quran Admin division forced to:', quranRes.data.data.active_division);
  if (quranRes.data.data.active_division !== 'quran') {
    throw new Error('Quran Admin was able to request institute division!');
  }

  console.log('All backend analytics tests PASSED successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
