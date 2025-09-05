// functions/log_event.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    // Support both payload styles:
    // - new: { name, rsvpType, guestCount, userAgent, referrer }
    // - old: { name, status, count }
    const name   = (body.name || '').trim();
    const status = (body.status || body.rsvpType || '').trim(); // 'sure'|'not_sure' or 'coming'|'save'
    const countRaw = body.count ?? body.guestCount;
    const count  = (countRaw === undefined || countRaw === null) ? '' : String(countRaw).trim();
    const userAgent = (body.userAgent || '').slice(0, 255);
    const referrer  = (body.referrer  || '').slice(0, 512);

    if (!name || !status) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok:false, error:'name and status required' }) };
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key:   (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID;
    const range = process.env.SHEET_RANGE || 'RSVP!A1'; // Columns we’ll write: Timestamp | Name | Status | Count | UA | Referrer

    const values = [[
      new Date().toISOString(),
      name,
      status,   // e.g. 'coming'/'save' or 'sure'/'not_sure'
      count,
      userAgent,
      referrer
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('log_event error:', err);
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};

function cors(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}
