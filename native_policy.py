"""Contrat de configuration des protections du proxy natif LERD."""
import ipaddress
import json
import math
import os
import urllib.error
import urllib.parse
import urllib.request

from access_sharing import NoRedirect

MODES = {'closed', 'public', 'ip', 'password', 'ip_and_password', 'ip_or_password'}


class PolicyError(RuntimeError):
    """Message public sans contenu distant ni identifiant secret."""


def identity(value, label, optional=False):
    if not isinstance(value, str) or len(value) > 256 or (not value and not optional):
        raise PolicyError(label + ' invalide.')
    if any(ord(char) < 32 for char in value):
        raise PolicyError(label + ' invalide.')
    return value


def rate_config(value):
    if not isinstance(value, dict) or set(value) != {'requests_per_second', 'burst'}:
        raise PolicyError('Limite de requêtes invalide.')
    speed, burst = value['requests_per_second'], value['burst']
    if type(speed) not in (int, float) or not math.isfinite(speed) or not 0 <= speed <= 100000:
        raise PolicyError('Limite de requêtes invalide.')
    if type(burst) is not int or not 1 <= burst <= 10000:
        raise PolicyError('Tolérance de rafale invalide.')
    return dict(requests_per_second=speed, burst=burst)


def validate_update(data):
    known = {'version', 'site', 'branch', 'mode', 'networks', 'users', 'revision',
             'enforcement', 'rate', 'credentials', 'remove_users'}
    if not isinstance(data, dict) or set(data) - known:
        raise PolicyError('Champ de configuration non reconnu.')
    mode = data.get('mode')
    revision = data.get('revision')
    if mode not in MODES or type(revision) is not int or revision < 0:
        raise PolicyError('Mode ou révision invalide.')
    networks = data.get('networks')
    if not isinstance(networks, list) or len(networks) > 256:
        raise PolicyError('Liste des IP invalide.')
    try:
        if any(not isinstance(net, str) for net in networks):
            raise ValueError()
        networks = list(dict.fromkeys(str(ipaddress.ip_network(net, strict=False))
                                     for net in networks))
    except (TypeError, ValueError):
        raise PolicyError('Adresse IP ou plage CIDR invalide.') from None
    if mode in ('ip', 'ip_and_password', 'ip_or_password') and not networks:
        raise PolicyError('Ce mode nécessite au moins une IP autorisée.')
    credentials, removed = data.get('credentials', []), data.get('remove_users', [])
    if not isinstance(credentials, list) or not isinstance(removed, list) or len(credentials) > 64 or len(removed) > 64:
        raise PolicyError('Liste des comptes invalide.')
    accounts = []
    names = set()
    for account in credentials:
        if not isinstance(account, dict) or set(account) != {'username', 'password'}:
            raise PolicyError('Compte invalide.')
        name = identity(account['username'], 'Identifiant')
        password = account['password']
        if ':' in name or len(name.encode('utf-8')) > 128 or name in names:
            raise PolicyError('Identifiant invalide ou ajouté plusieurs fois.')
        if not isinstance(password, str) or not 8 <= len(password.encode('utf-8')) <= 72:
            raise PolicyError('Le mot de passe doit contenir entre 8 et 72 octets.')
        names.add(name)
        accounts.append(dict(username=name, password=password))
    return dict(site=identity(data.get('site'), 'Projet'),
                branch=identity(data.get('branch', ''), 'Branche', True),
                mode=mode, networks=networks, revision=revision,
                credentials=accounts,
                remove_users=[identity(name, 'Identifiant') for name in removed],
                rate=rate_config(data.get('rate')))


def clean_response(data):
    if not isinstance(data, dict) or data.get('version') != 1 or data.get('enforcement') != 'native':
        raise PolicyError('Cette version de LERD ne fournit pas les protections natives attendues.')
    try:
        fields = ('site', 'branch', 'mode', 'networks', 'revision', 'rate')
        base = validate_update({**{key: data[key] for key in fields},
                                'credentials': [], 'remove_users': []})
        users = [dict(username=identity(user['username'], 'Identifiant')) for user in data['users']]
    except (KeyError, TypeError):
        raise PolicyError('Réponse des protections natives invalide.') from None
    return dict(version=1, enforcement='native', users=users,
                **{key: value for key, value in base.items() if key not in ('credentials', 'remove_users')})


def native_policy(site, branch='', update=None, environ=None):
    environ = os.environ if environ is None else environ
    base, token = environ.get('LERD_API_URL', '').rstrip('/'), environ.get('LERD_API_TOKEN', '')
    try:
        url = urllib.parse.urlsplit(base)
        local = url.hostname == 'localhost' or ipaddress.ip_address(url.hostname).is_loopback
    except (ValueError, TypeError):
        local = False
    if not local or not token or url.scheme not in ('http', 'https') or url.username or url.password or url.query or url.fragment:
        raise PolicyError('API locale et jeton natif LERD requis.')
    exporting = site is None
    if not exporting:
        site, branch = identity(site, 'Projet'), identity(branch, 'Branche', True)
    payload = None
    if update is not None:
        if exporting:
            raise PolicyError('Un export ne peut pas modifier les règles.')
        payload = validate_update(update)
        if payload['site'] != site or payload['branch'] != branch:
            raise PolicyError('La cible du formulaire a changé. Rechargez ses règles.')
    query = {'export': '1'} if exporting else dict(site=site, branch=branch)
    endpoint = base + '/api/share-access?' + urllib.parse.urlencode(query)
    request = urllib.request.Request(endpoint, method='GET' if payload is None else 'PUT',
        data=None if payload is None else json.dumps(payload, allow_nan=False).encode(),
        headers={'X-Lerd-Plugin-Token': token, 'Accept': 'application/json', 'Content-Type': 'application/json'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=15) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise PolicyError('Réponse native trop volumineuse.')
        decoded = json.loads(raw)
        if exporting:
            if not isinstance(decoded, dict) or decoded.get('version') != 1 or not isinstance(decoded.get('policies'), list):
                raise PolicyError('Inventaire des protections natives non reconnu.')
            return [clean_response(item) for item in decoded['policies']]
        result = clean_response(decoded)
        if result['site'] != site or result['branch'] != branch:
            raise PolicyError('La réponse native concerne une autre cible.')
        return result
    except urllib.error.HTTPError as error:
        messages = {404: 'Protections natives indisponibles ou cible inconnue. Vérifiez la version de LERD.',
                    409: 'Les règles ont changé ailleurs. Rechargez avant de réessayer.',
                    400: 'Configuration refusée par LERD. Vérifiez les IP, comptes et limites.',
                    403: 'LERD refuse cette modification depuis ce contexte.'}
        raise PolicyError(messages.get(error.code, 'Requête native refusée. Aucune confirmation d’application.')) from None
    except (OSError, ValueError):
        raise PolicyError('Impossible de lire ou appliquer les protections natives.') from None
