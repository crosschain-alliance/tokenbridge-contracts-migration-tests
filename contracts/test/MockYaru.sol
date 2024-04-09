pragma solidity ^0.8.20;

import "./MockYaho.sol";

interface IJushin {
    function onMessage(
        uint256 sourceChainId,
        uint256 messageId,
        address sender,
        bytes calldata data
    ) external returns (bytes memory);
}

contract MockYaru {
    uint256 public immutable SOURCE_CHAIN_ID;

    struct Message {
        uint256 nonce;
        uint256 targetChainId;
        uint256 threshold;
        address sender;
        address receiver;
        bytes data;
        IReporter[] reporters;
        IAdapter[] adapters;
    }

    constructor(uint256 sourceChainId) {
        SOURCE_CHAIN_ID = sourceChainId;
    }

    function executeMessages(Message[] calldata messages) external {
        for (uint256 i = 0; i < messages.length; i++) {
            Message memory message = messages[i];
            uint256 messageId = i; // NOTE: mock
            IJushin(message.receiver).onMessage(SOURCE_CHAIN_ID, messageId, message.sender, message.data);
        }
    }
}
