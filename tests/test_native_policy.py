import json
from pathlib import Path
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from native_policy import PolicyError, clean_response, validate_update, native_policy


def fixture():
    return dict(version=1, site='demo', branch='', mode='closed', networks=[],
                users=[], revision=0, enforcement='native',
                rate=dict(requests_per_second=0, burst=60))


class PolicyTests(unittest.TestCase):
    def test_response_never_returns_credentials(self):
        data = fixture()
        data.update(password='sensible', password_hash='sensible')
        data['users'] = [dict(username='demo', hash='sensible')]
        result = clean_response(data)
        self.assertNotIn('sensible', json.dumps(result))
        self.assertEqual(result['users'], [dict(username='demo')])

    def test_cidr_ipv4_ipv6_and_rate_are_validated(self):
        data = fixture()
        data.pop('users')
        data['networks'] = ['192.0.2.0/24', '2001:db8::/32']
        self.assertEqual(validate_update(data)['networks'], data['networks'])
        for invalid in ['broken', '192.0.2.1/70', '2001:db8::/129']:
            with self.assertRaises(PolicyError):
                validate_update(dict(data, networks=[invalid]))

    def test_invalid_modes_limits_and_revision_are_refused(self):
        for patch in [dict(mode='unexpected'), dict(revision=-1),
                      dict(rate=dict(requests_per_second=float('nan'), burst=60)),
                      dict(rate=dict(requests_per_second=2, burst=0)),
                      dict(credentials=[dict(username='x', password='')])]:
            with self.assertRaises(PolicyError):
                validate_update(dict(fixture(), **patch))

    def test_unexpected_fields_are_not_silently_accepted(self):
        with self.assertRaises(PolicyError):
            validate_update(dict(fixture(), command='unexpected'))

    def test_account_byte_limits_and_duplicates(self):
        for credentials in [
            [dict(username='a:b', password='fixture-valid')],
            [dict(username='é' * 65, password='fixture-valid')],
            [dict(username='demo', password='é' * 37)],
            [dict(username='demo', password='fixture-valid')] * 2,
        ]:
            with self.assertRaises(PolicyError):
                validate_update(dict(fixture(), credentials=credentials))

    def test_exact_worktree_target_and_put_body(self):
        seen = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_PUT(self):
                data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                seen.append((self.path, data, self.headers.get('X-Lerd-Plugin-Token')))
                answer = fixture()
                answer.update(branch='agent/v3', revision=1)
                raw = json.dumps(answer).encode()
                self.send_response(200)
                self.end_headers()
                self.wfile.write(raw)
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            env = dict(LERD_API_URL='http://127.0.0.1:' + str(server.server_port),
                       LERD_API_TOKEN='fixture-token')
            update = dict(fixture(), branch='agent/v3')
            result = native_policy('demo', 'agent/v3', update, env)
            self.assertEqual(result['revision'], 1)
            self.assertEqual(seen[0][0], '/api/share-access?site=demo&branch=agent%2Fv3')
            self.assertEqual(seen[0][2], 'fixture-token')
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_remote_api_and_missing_token_refused(self):
        for env in [{}, dict(LERD_API_URL='https://example.invalid', LERD_API_TOKEN='fixture')]:
            with self.assertRaises(PolicyError):
                native_policy('demo', '', environ=env)

    def test_export_checks_contract_and_omits_hashes(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                self.server.seen = self.path
                policy = fixture()
                policy['users'] = [dict(username='demo', hash='sensible')]
                raw = json.dumps(dict(version=1, policies=[policy])).encode()
                self.send_response(200); self.end_headers(); self.wfile.write(raw)
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            env = dict(LERD_API_URL='http://127.0.0.1:' + str(server.server_port),
                       LERD_API_TOKEN='fixture-token')
            result = native_policy(None, environ=env)
            self.assertEqual(server.seen, '/api/share-access?export=1')
            self.assertEqual(result[0]['mode'], 'closed')
            self.assertNotIn('sensible', json.dumps(result))
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
