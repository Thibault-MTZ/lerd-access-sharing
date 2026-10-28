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
  self.assertEqual(data['shares'][1]['branch'],'agent-v3')
  self.assertEqual(data['shares'][1]['git_branch'],'agent/v3')
  self.assertEqual(data['shares'][1]['kind'],'worktree')
 def test_only_whitelisted_fields_leave_backend(self):
  payload=normalize([{'name':'demo','path':'/private/example','api_key':'fixture',
    'env':{'PASSWORD':'fixture'},'worktrees':[]}])
  text=json.dumps(payload)
  self.assertNotIn('/private/example',text);self.assertNotIn('PASSWORD',text)
  self.assertNotIn('api_key',text)
 def test_paused_share_is_not_counted_as_active(self):
  data=normalize([{'name':'demo','paused':True,'lan_port':9100}])
  self.assertEqual(data['active_count'],0)
 def test_parent_metadata_uses_real_native_branch_field(self):
  row,=normalize([{'name':'demo','domain':'demo.test','framework':'laravel',
    'php_version':'8.4','node_version':'22','branch':'feature/main',
    'git_branch':'not-a-native-parent-field','path':'/private/example',
    'git_remote':'https://user:fixture@example.invalid/repo.git'}])['shares']
  self.assertEqual({key:row[key] for key in ('domain','framework','php_version','node_version','git_branch')},
    {'domain':'demo.test','framework':'laravel','php_version':'8.4','node_version':'22','git_branch':'feature/main'})
  self.assertIsNone(row['branch'])
  self.assertNotIn('fixture',json.dumps(row));self.assertNotIn('/private/example',json.dumps(row))
 def test_worktree_runtime_overrides_and_identity_are_independent(self):
  rows=normalize([{'name':'demo','framework':'laravel','php_version':'8.4','node_version':'22',
    'domain':'demo.test','branch':'main','worktrees':[
      {'branch':'feature-a','git_branch':'feature/a','domain':'feature-a.demo.test',
       'php_version':'8.3','framework':'not-a-native-worktree-field'},
      {'branch':'feature-b','git_branch':'feature/b','node_version':'24'}]}])['shares']
  a,b=rows[1:]
  self.assertEqual((a['branch'],a['git_branch'],a['domain']),('feature-a','feature/a','feature-a.demo.test'))
  self.assertEqual((a['framework'],a['php_version'],a['node_version']),('laravel','8.3','22'))
  self.assertEqual((b['framework'],b['php_version'],b['node_version']),('laravel','8.4','24'))
  self.assertIsNone(b['domain'])
 def test_metadata_absent_or_invalid_stays_unknown(self):
  rows=normalize([{'name':'demo','worktrees':[{'branch':'topic'}]},
    {'name':'invalid','framework':{'path':'/private/example'},'php_version':True,
     'node_version':22,'branch':['hidden'],'domain':'bad\nfield',
     'worktrees':[{'branch':'topic','php_version':{'secret':'fixture'}}]}])['shares']
  for row in rows:
   for key in ('domain','framework','php_version','node_version','git_branch'):
    self.assertIsNone(row[key],(row['project'],key))
  self.assertNotIn('fixture',json.dumps(rows));self.assertNotIn('/private/example',json.dumps(rows))
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
 def test_redirect_never_receives_the_native_token(self):
  captured=[]
  class Capture(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_GET(self):
    captured.append(self.headers.get('X-Lerd-Plugin-Token'))
    self.send_response(200);self.end_headers()
  capture=ThreadingHTTPServer(('127.0.0.1',0),Capture)
  class Redirect(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_GET(self):
    self.send_response(302)
    self.send_header('Location','http://127.0.0.1:'+str(capture.server_port)+'/capture')
    self.end_headers()
  redirect=ThreadingHTTPServer(('127.0.0.1',0),Redirect)
  threads=[threading.Thread(target=s.serve_forever,daemon=True) for s in (capture,redirect)]
  for thread in threads:thread.start()
  try:
   with self.assertRaises(ReadError):
    read_native({'LERD_API_URL':'http://127.0.0.1:'+str(redirect.server_port),
                 'LERD_API_TOKEN':secrets.token_urlsafe(24)})
   self.assertEqual(captured,[])
  finally:
   for server in (capture,redirect):server.shutdown();server.server_close()
   for thread in threads:thread.join()

if __name__=='__main__':unittest.main()
