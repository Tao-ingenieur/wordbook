"""Seal the existing signing identity to the repository key; never publish a plaintext keystore."""
import base64
import json
from pathlib import Path
from nacl.public import PublicKey, SealedBox

root = Path(__file__).resolve().parents[2]
public = json.loads((root / 'repo/platforms/android/signing-public-key.json').read_text())
key = Path.home() / '.android/debug.keystore'
encrypted = SealedBox(PublicKey(base64.b64decode(public['key']))).encrypt(base64.b64encode(key.read_bytes()))
out = root / 'dist/.cache/signing-recovery'
out.mkdir(parents=True, exist_ok=True)
(out / 'signing-secret.json').write_text(json.dumps({'key_id': public['key_id'], 'encrypted_value': base64.b64encode(encrypted).decode()}))
print('Signing identity sealed to repository Actions public key. Plaintext key stays on runner.')
