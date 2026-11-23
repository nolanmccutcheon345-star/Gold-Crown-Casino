#!/usr/bin/env python3
"""Bounded-memory pattern screening of current tracked files. Never prints values.

The Step5N run used these patterns in an inline script. This reusable form fixes
only its verbose presentation of zero counts; it does not infer archive safety.
"""
import collections
import json
import pathlib
import re
import subprocess
import sys
import time

PATTERNS = {
    'github_token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b',
    'openai_key': rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b',
    'aws_access_key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'private_key': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    'authorization_bearer': rb'(?i)(?:authorization\s*[:=]|"(?:access_token|refresh_token|api_key|token)"\s*:)\s*["\x27]?(?:Bearer\s+)?[A-Za-z0-9_.-]{32,}',
    'credential_url': rb'https?://[^\s/<>"\x27]{1,80}:[^\s/<>"\x27]{10,}@',
}
MATCHERS = {name: re.compile(pattern) for name, pattern in PATTERNS.items()}


def matches(stream):
    counts, tail = collections.Counter(), b''
    while chunk := stream.read(1024 * 1024):
        data = tail + chunk
        for name, matcher in MATCHERS.items():
            counts[name] += sum(1 for m in matcher.finditer(data) if m.end() > len(tail))
        tail = data[-256:]
    return {name: count for name, count in counts.items() if count}


def self_test():
    import io
    samples = {
        'github_token': b'gh' + b'p_' + b'a' * 36,
        'openai_key': b'sk-' + b'a' * 40,
        'aws_access_key': b'AKIA' + b'A' * 16,
        'private_key': b'-----BEGIN ' + b'PRIVATE KEY-----',
        'authorization_bearer': b'Authorization: Bearer ' + b'a' * 40,
        'credential_url': b'https://name:' + b'a' * 15 + b'@example.test',
    }
    for name, value in samples.items():
        assert matches(io.BytesIO(value)).get(name) == 1, name
        # A credential straddling the 1 MiB read boundary must be observed once.
        padded = b' ' * (1024 * 1024 - 8) + value
        assert matches(io.BytesIO(padded)).get(name) == 1, name
    assert not matches(io.BytesIO(b'Ordinary poker fixtures and public hashes'))
    print(json.dumps({'status': 'PASS', 'checks': 13, 'scope': 'pattern and read-boundary controls'}))


def main(output):
    root = pathlib.Path.cwd()
    names = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
    names = [p for p in names if p]
    findings, sizes, groups, metadata = [], [], collections.Counter(), []
    started = time.monotonic()
    for name in names:
        path = root / name
        if not path.is_file():
            continue
        size = path.stat().st_size
        sizes.append((size, name))
        groups[name.split('/')[0]] += size
        if any(x in name.lower() for x in ['.env', 'credentials', 'token', 'secret', 'bankroll', 'snapshot', 'session']):
            metadata.append({'path': name, 'bytes': size})
        with path.open('rb') as stream:
            counts = matches(stream)
        if counts:
            findings.append({'path': name, 'patterns': counts})
    report = {
        'format': 'step5n-tracked-safety-audit',
        'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
        'trackedFiles': len(names), 'logicalTrackedBytes': sum(s for s, _ in sizes),
        'bytesByRoot': dict(groups),
        'largeFilesOver5MiB': [{'path': n, 'bytes': s} for s, n in sorted(sizes, reverse=True) if s > 5 * 1024 * 1024],
        'candidateFindings': findings, 'candidateFindingCount': len(findings),
        'sensitiveNamedFiles': metadata, 'durationSeconds': time.monotonic() - started,
        'status': 'REVIEW_REQUIRED' if findings else 'NO_PATTERN_MATCHES',
        'scope': 'Tracked checkout bytes only. Pattern screening is not proof of absence. Compressed archives and historical Git objects need separate review. No secret values retained.',
    }
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['sourceCommit', 'status', 'trackedFiles', 'logicalTrackedBytes', 'candidateFindingCount']}))


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
    elif len(sys.argv) == 2:
        main(pathlib.Path(sys.argv[1]))
    else:
        raise SystemExit('Usage: audit-tracked.py OUTPUT.json | --self-test')
