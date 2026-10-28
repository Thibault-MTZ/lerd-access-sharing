import json
from pathlib import Path
import secrets
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from access_sharing import ReadError,normalize,read_native,safe_url

class AccessSharingTests(unittest.TestCase):
 def test_suggested_url_is_not_an_active_share(self):
  row,=normalize([{'name':'demo','public_share_url':'https://demo.example.invalid'}])['shares']
  self.assertEqual(row['visibility'],'closed');self.assertIsNone(row['url'])
 def test_public_flag_and_missing_public_port(self):
  row,=normalize([{'name':'demo','public_shared':True,'public_share_url':'https://demo.example.invalid'}])['shares']
  self.assertEqual(row['visibility'],'public');self.assertIsNone(row['port'])
  self.assertFalse(row['port_reported']);self.assertFalse(row['access_policy_reported'])
 def test_lan_and_worktree_are_reported_from_native_fields(self):
  data=normalize([{'name':'demo','lan_port':9100,'lan_share_url':'http://192.0.2.10:9100',
    'worktrees':[{'branch':'agent-v3','git_branch':'agent/v3','public_shared':True,
                  'public_share_url':'https://demo-agent-v3.example.invalid'}]}])
  self.assertEqual(data['active_count'],2)
  self.assertEqual(data['shares'][0]['port'],9100)
  self.assertEqual(data['shares'][1]['branch'],'agent/v3')
  self.assertEqual(data['shares'][1]['kind'],'worktree')
 def test_only_whitelisted_fields_leave_backend(self):
  payload=normalize([{'name':'demo','path':'/private/example','api_key':'fixture',
    'env':{'PASSWORD':'fixture'},'worktrees':[]}])
  text=json.dumps(payload)
  self.assertNotIn('/private/example',text);self.assertNotIn('PASSWORD',text)
  self.assertNotIn('api_key',text)
 def test_invalid_or_ambiguous_native_state_fails(self):
  for data in ({},[None],[{'name':'demo','public_shared':'yes'}],
    [{'name':'demo','lan_port':9100,'public_shared':True}],
    [{'name':'demo','lan_port':70000}]):
   with self.assertRaises(ReadError):normalize(data)
 def test_urls_cannot_carry_credentials_or_active_content(self):
  for value in ('javascript:alert(1)','https://user:password@example.invalid',
                'https://example.invalid/?token=fixture','file:///tmp/example'):
   self.assertIsNone(safe_url(value))
 def test_local_api_get_only_and_native_token_header(self):
  token=secrets.token_urlsafe(24);seen=[]
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_GET(self):
    seen.append((self.path,self.headers.get('X-Lerd-Plugin-Token')))
    raw=b'[{"name":"demo"}]'
    self.send_response(200);self.send_header('Content-Length',str(len(raw)))
    self.end_headers();self.wfile.write(raw)
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   data=read_native({'LERD_API_URL':'http://127.0.0.1:'+str(server.server_port),'LERD_API_TOKEN':token})
   self.assertTrue(data['read_only']);self.assertEqual(seen,[('/api/sites',token)])
  finally:server.shutdown();server.server_close();thread.join()
 def test_remote_api_or_missing_token_refused(self):
  for env in ({},{'LERD_API_URL':'https://example.invalid','LERD_API_TOKEN':'fixture'}):
   with self.assertRaises(ReadError):read_native(env)

if __name__=='__main__':unittest.main()
