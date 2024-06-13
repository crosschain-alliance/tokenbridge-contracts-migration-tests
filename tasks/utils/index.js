const { append0 } = require("../../test/utils/index")

const MESSAGE_DISPATCHED_TOPIC = "0x218247aabc759e65b5bb92ccc074f9d62cd187259f2a0984c3c9cf91f67ff7cf"

module.exports.decodeHashiMessage = (_message, { abiCoder }) => {
  const [[nonce, targetChainId, threshold, sender, receiver, data, reporters, adapters]] = abiCoder.decode(
    ["(uint256,uint256,uint256,address,address,bytes,address[],address[])"],
    _message,
  )

  return [
    nonce,
    targetChainId,
    threshold,
    sender,
    receiver,
    data,
    reporters.map((_reporter) => _reporter),
    adapters.map((_adapter) => _adapter),
  ]
}

module.exports.getRelevantDataFromEvents = ({ receipt, abiCoder, topic, onlyHashiMessage = false }) => {
  const { data: hashiMessage } = receipt.logs.find((_log) => _log.topics[0] === MESSAGE_DISPATCHED_TOPIC)

  if (onlyHashiMessage) {
    return {
      hashiMessage,
    }
  }

  const { data: message } = receipt.logs.find((_log) => _log.topics[0] === topic)
  const [decodedMessage] = abiCoder.decode(["bytes"], message)
  const messageId = decodedMessage.slice(0, 66)
  return {
    decodedMessage,
    hashiMessage,
    message,
    messageId,
  }
}

module.exports.getValidatorsSignatures = ({ validators, message }) =>
  Promise.all(validators.map((_validator) => _validator.signMessage(append0(ethers.toBeArray(message)))))
