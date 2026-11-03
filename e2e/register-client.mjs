import fs from 'fs'
const f = '/app/db/oidc-Client.db'
const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
if (lines.some(l => JSON.parse(l).client_id === 'uniweaver-local')) {
  console.log('client already registered')
} else {
  // Metadata mirrors the DCR-registered UniWeaver client (see the ported record).
  const client = {
    _id: 'uniweaver-local',
    application_type: 'web',
    grant_types: ['authorization_code'],
    id_token_signed_response_alg: 'RS256',
    require_auth_time: false,
    response_types: ['code'],
    subject_type: 'public',
    token_endpoint_auth_method: 'none',
    post_logout_redirect_uris: ['http://localhost:3003/user_entry/login'],
    backchannel_logout_session_required: false,
    require_pushed_authorization_requests: false,
    dpop_bound_access_tokens: false,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_id: 'uniweaver-local',
    client_name: 'UniWeaver',
    redirect_uris: ['http://localhost:3003/user_entry/callback'],
    scope: 'openid profile email',
  }
  lines.push(JSON.stringify(client))
  fs.writeFileSync(f, lines.join('\n') + '\n')
  console.log('registered uniweaver-local')
}
