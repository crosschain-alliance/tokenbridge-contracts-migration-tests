pragma solidity ^0.8.20;

import "./MockYaho.sol";
import "./IMessage.sol";

interface IJushin {
    function onMessage(
        uint256 messageId,
        uint256 sourceChainId,
        address sender,
        uint256 threshold,
        address[] calldata adapters,
        bytes calldata data
    ) external returns (bytes memory);
}

contract MockYaru {
    uint256 public immutable SOURCE_CHAIN_ID;

    constructor(uint256 sourceChainId) {
        SOURCE_CHAIN_ID = sourceChainId;
    }

    function executeMessages(Message[] calldata messages) external {
        for (uint256 i = 0; i < messages.length; i++) {
            Message memory message = messages[i];
            uint256 messageId = i; // NOTE: mock
            IJushin(message.receiver).onMessage(
                messageId,
                SOURCE_CHAIN_ID,
                message.sender,
                message.threshold,
                message.adapters,
                message.data
            );
        }
    }
}
