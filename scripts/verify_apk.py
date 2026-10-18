"""Inspect packaged Android binary XML without executing APK code or printing its API key."""
import argparse
import hashlib
import json
import struct
import zipfile


def manifest_elements(data):
    strings = []
    elements = []
    u16 = lambda p: struct.unpack_from('<H', data, p)[0]
    u32 = lambda p: struct.unpack_from('<I', data, p)[0]
    def length(p, utf8):
        if utf8:
            n, p = data[p], p + 1
            if n & 0x80:
                n, p = ((n & 0x7f) << 8) | data[p], p + 1
        else:
            n, p = u16(p), p + 2
            if n & 0x8000:
                n, p = ((n & 0x7fff) << 16) | u16(p), p + 2
        return n, p
    p = 8
    while p < len(data):
        kind, header, size = u16(p), u16(p + 2), u32(p + 4)
        if size < header or p + size > len(data):
            raise ValueError('Invalid manifest chunk')
        if kind == 1:
            count, utf8, start = u32(p + 8), bool(u32(p + 16) & 0x100), u32(p + 20)
            for i in range(count):
                q = p + start + u32(p + header + i * 4)
                n, q = length(q, utf8)
                if utf8:
                    n, q = length(q, True)
                strings.append(data[q:q + n * (1 if utf8 else 2)].decode('utf-8' if utf8 else 'utf-16le'))
        if kind == 0x102:
            ext = p + 16
            name = strings[u32(ext + 4)]
            start, step, count = u16(ext + 8), u16(ext + 10), u16(ext + 12)
            attrs = {}
            for i in range(count):
                q = ext + start + i * step
                key, raw, typ, value = strings[u32(q + 4)], u32(q + 8), data[q + 15], u32(q + 16)
                attrs[key] = strings[raw] if raw != 0xffffffff else strings[value] if typ == 3 else value
            elements.append((name, attrs))
        p += size
    return elements


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    parser.add_argument('--network-only', action='store_true')
    args = parser.parse_args()
    with zipfile.ZipFile(args.apk) as archive:
        elements = manifest_elements(archive.read('AndroidManifest.xml'))
    app = next(attrs for name, attrs in elements if name == 'application')
    package = next(attrs['package'] for name, attrs in elements if name == 'manifest')
    key = next(attrs['value'] for name, attrs in elements if name == 'meta-data' and attrs.get('name') == 'com.dji.sdk.API_KEY')
    assert app['name'] == 'com.sentinel.cop.dji.BridgeApplication', 'SDK Application missing'
    assert any(name == 'service' and attrs.get('name') == 'com.sentinel.cop.dji.BridgeService' for name, attrs in elements), 'Foreground bridge service missing'
    assert key and key != 'MISSING_API_KEY', 'Missing DJI key'
    assert (key == 'NETWORK_TEST_ONLY') == args.network_only, 'Wrong APK mode'
    assert package == ('com.sentinel.cop.dji.networktest' if args.network_only else 'com.sentinel.cop.dji'), 'Wrong package for DJI key'
    with open(args.apk, 'rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    print(json.dumps({'manifest_check': 'passed', 'package': package, 'network_only': args.network_only, 'sha256': digest}))


if __name__ == '__main__':
    main()
