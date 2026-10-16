import nacl from "tweetnacl";

const pair = (seed: Uint8Array) => nacl.sign.keyPair.fromSeed(seed);

export const ed25519 = {
  getPublicKey: (seed: Uint8Array) => pair(seed).publicKey,
  sign: (message: Uint8Array, seed: Uint8Array) => nacl.sign.detached(message, pair(seed).secretKey),
  verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => {
    try {
      return nacl.sign.detached.verify(message, signature, publicKey);
    } catch {
      return false;
    }
  },
};
