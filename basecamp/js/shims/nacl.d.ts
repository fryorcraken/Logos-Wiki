declare module "tweetnacl" {
  const nacl: {
    sign: {
      keyPair: { fromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array } };
      detached: ((message: Uint8Array, secretKey: Uint8Array) => Uint8Array) & {
        verify: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean;
      };
    };
  };
  export default nacl;
}
