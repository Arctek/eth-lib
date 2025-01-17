let loaded;
let Bytes;
let Nat;
let elliptic;
let rlp;
let secp256k1;
let keccak256
let keccak256s;
let sign27;

function preload() {
  loaded = true;

  Bytes = require("./bytes");
  Nat = require("./nat");
  elliptic = require("elliptic");
  rlp = require("./rlp");
  secp256k1 = new (elliptic.ec)("secp256k1"); // eslint-disable-line
  const hash = require("./hash");
  keccak256 = hash.keccak256;
  keccak256s = hash.keccak256s;
}

const create = entropy => {
  if (!loaded) preload();
  const innerHex = keccak256(Bytes.concat(Bytes.random(32), entropy || Bytes.random(32)));
  const middleHex = Bytes.concat(Bytes.concat(Bytes.random(32), innerHex), Bytes.random(32));
  const outerHex = keccak256(middleHex);
  return fromPrivate(outerHex);
}

const toChecksum = address => {
  if (!loaded) preload();
  const addressHash = keccak256s(address.slice(2));
  let checksumAddress = "0x";
  for (let i = 0; i < 40; i++)
    checksumAddress += parseInt(addressHash[i + 2], 16) > 7
      ? address[i + 2].toUpperCase()
      : address[i + 2];
  return checksumAddress;
}

const fromPrivate = privateKey => {
  if (!loaded) preload();
  const buffer = new Buffer(privateKey.slice(2), "hex");
  const ecKey = secp256k1.keyFromPrivate(buffer);
  const publicKey = "0x" + ecKey.getPublic(false, 'hex').slice(2);
  const publicHash = keccak256(publicKey);
  const address = toChecksum("0x" + publicHash.slice(-40));
  return {
    address: address,
    privateKey: privateKey
  }
}

const encodeSignature = ([v, r, s]) => {
  if (!loaded) preload();
  return Bytes.flatten([r,s,v]);
}

const decodeSignature = (hex) => {
  if (!loaded) preload();
  return [ 
    Bytes.slice(64, Bytes.length(hex), hex),
    Bytes.slice(0, 32, hex),
    Bytes.slice(32, 64, hex)
  ];
}

const makeSigner = addToV => (hash, privateKey) => {
  if (!loaded) preload();
  const signature = secp256k1
    .keyFromPrivate(new Buffer(privateKey.slice(2), "hex"))
    .sign(new Buffer(hash.slice(2), "hex"), {canonical: true});
  return encodeSignature([
    Nat.fromString(Bytes.fromNumber(addToV + signature.recoveryParam)),
    Bytes.pad(32, Bytes.fromNat("0x" + signature.r.toString(16))),
    Bytes.pad(32, Bytes.fromNat("0x" + signature.s.toString(16)))]);
}

const sign = makeSigner(27); // v=27|28 instead of 0|1...

const recover = (hash, signature) => {
  if (!loaded) preload();
  const vals = decodeSignature(signature);
  const vrs = {v: Bytes.toNumber(vals[0]), r:vals[1].slice(2), s:vals[2].slice(2)};
  const ecPublicKey = secp256k1.recoverPubKey(new Buffer(hash.slice(2), "hex"), vrs, vrs.v < 2 ? vrs.v : 1 - (vrs.v % 2)); // because odd vals mean v=0... sadly that means v=0 means v=1... I hate that
  const publicKey = "0x" + ecPublicKey.encode("hex", false).slice(2);
  const publicHash = keccak256(publicKey);
  const address = toChecksum("0x" + publicHash.slice(-40));
  return address;
}

module.exports = { 
  create,
  toChecksum,
  fromPrivate,
  sign,
  makeSigner,
  recover,
  encodeSignature,
  decodeSignature
}
