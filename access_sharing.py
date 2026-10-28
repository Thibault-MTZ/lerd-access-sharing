"""Lecture des états natifs, sans accès aux fichiers internes de LERD."""
import ipaddress
import json
import os
import urllib.parse
import urllib.request

class ReadError(RuntimeError):
    """Erreur publique volontairement dépourvue de jeton ou de corps distant."""

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,message,headers,new_url):
        # Un jeton local ne doit jamais suivre une redirection, même locale.
        return None

def safe_url(value):
    if not isinstance(value,str) or not value:return None
    try:
        url=urllib.parse.urlsplit(value)
        if (url.scheme not in ('http','https') or not url.hostname
                or url.username is not None or url.password is not None
                or url.query or url.fragment):return None
        return urllib.parse.urlunsplit(url)
    except ValueError:return None

def port(value):
    if value in (None,0):return None
    if type(value) is not int or not 1<=value<=65535:
        raise ReadError('Port natif invalide dans la réponse LERD.')
    return value

def normalize(sites):
    if not isinstance(sites,list):raise ReadError('Format des sites LERD non reconnu.')
    rows=[]
    def add(site,node,kind):
        if not isinstance(node,dict):raise ReadError('Format de site ou de worktree non reconnu.')
        name=site.get('name')
        if not isinstance(name,str) or not name:raise ReadError('Nom de site absent.')
        public=node.get('public_shared',False)
        if type(public) is not bool:raise ReadError('État de partage public non reconnu.')
        lan=port(node.get('lan_port'))
        if public and lan:raise ReadError('États LAN et public simultanés : vérifiez LERD.')
        visibility='public' if public else 'private' if lan else 'closed'
        public_url=safe_url(node.get('public_share_url'))
        lan_url=safe_url(node.get('lan_share_url'))
        rows.append({'project':name,'kind':kind,'branch':node.get('branch') if kind=='worktree' else None,
            'git_branch':node.get('git_branch') if kind=='worktree' else None,
            'domain':node.get('domain'),'visibility':visibility,
            'url':public_url if public else lan_url if lan else None,
            'suggested_public_url':public_url,
            # L'API actuelle expose lan_port mais pas le port du proxy public.
            # Ne pas le déduire de l'ordre des sites ni de la base 9300.
            'port':port(node.get('public_port')) if public else lan,
            'port_reported':bool(node.get('public_port')) if public else bool(lan),
            'paused':bool(site.get('paused',False)),
            'access_policy_reported':False})
    for site in sites:
        if not isinstance(site,dict):raise ReadError('Format de site non reconnu.')
        add(site,site,'site')
        worktrees=site.get('worktrees') or []
        if not isinstance(worktrees,list):raise ReadError('Format des worktrees non reconnu.')
        for worktree in worktrees:add(site,worktree,'worktree')
    return {'schema_version':1,'read_only':True,'source':'LERD GET /api/sites',
            'shares':rows,'active_count':sum(row['visibility']!='closed' for row in rows),
            'limits':['Les contrôles IP, authentification et requêtes ne sont pas exposés par cette API.',
                      'Le port du proxy public n’est pas exposé par la version actuelle de cette API.',
                      'Les tunnels externes ne sont pas couverts par cette vue.']}

def read_native(environ=None):
    environ=os.environ if environ is None else environ
    base=environ.get('LERD_API_URL','').rstrip('/')
    token=environ.get('LERD_API_TOKEN','')
    try:
        url=urllib.parse.urlsplit(base)
        local=url.hostname=='localhost' or ipaddress.ip_address(url.hostname).is_loopback
    except (ValueError,TypeError):local=False
    if not local or url.scheme not in ('http','https') or url.username or url.password or url.query or url.fragment or not token:
        raise ReadError('Lancez cette lecture depuis LERD : API locale et jeton natif requis.')
    request=urllib.request.Request(base+'/api/sites',method='GET',
        headers={'X-Lerd-Plugin-Token':token,'Accept':'application/json'})
    try:
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        with opener.open(request,timeout=10) as response:
            raw=response.read(4*1024*1024+1)
        if len(raw)>4*1024*1024:raise ReadError('Réponse LERD trop volumineuse.')
        data=json.loads(raw)
    except (OSError,ValueError) as exc:
        raise ReadError('Impossible de lire les sites depuis l’API locale LERD.') from exc
    return normalize(data)
