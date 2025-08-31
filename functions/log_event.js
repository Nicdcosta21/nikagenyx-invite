// functions/log_event.js
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const name   = (body.name || '').trim();
    const status = (body.status || '').trim();   // 'sure' | 'not_sure'
    const count  = (body.count == null ? '' : String(body.count)).trim(); // may be blank for not_sure

    if (!name || !status) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok:false, error:'name and status required' }) };
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID;
    const range = process.env.SHEET_RANGE || 'RSVP!A1'; // columns: Name | Status | Count

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[ name, status, count ]] }
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
