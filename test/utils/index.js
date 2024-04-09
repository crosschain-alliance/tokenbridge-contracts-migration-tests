const concatTypedArrays = (a, b) => {
  var c = new a.constructor(a.length + b.length)
  c.set(a, 0)
  c.set(b, a.length)
  return c
}
module.exports.concatTypedArrays = concatTypedArrays

const strip0x = (_input) => _input.replace(/^0x/, "")
module.exports.strip0x = strip0x

const signatureToVrs = (_rawSignature) => {
  const signature = strip0x(_rawSignature)
  const v = signature.substr(64 * 2)
  const r = signature.substr(0, 32 * 2)
  const s = signature.substr(32 * 2, 32 * 2)
  return { v, r, s }
}
module.exports.signatureToVrs = signatureToVrs

const packSignatures = (_signatures) => {
  const length = Number(_signatures.length).toString(16)
  const msgLength = length.length === 1 ? `0${length}` : length
  let v = ""
  let r = ""
  let s = ""
  _signatures.forEach((e) => {
    v = v.concat(e.v)
    r = r.concat(e.r)
    s = s.concat(e.s)
  })
  return `0x${msgLength}${v}${r}${s}`
}
module.exports.packSignatures = packSignatures

const append0 = (_arr) => {
  const a = new Uint8Array(1)
  a[0] = 0
  return concatTypedArrays(a, _arr)
}
module.exports.append0 = append0
