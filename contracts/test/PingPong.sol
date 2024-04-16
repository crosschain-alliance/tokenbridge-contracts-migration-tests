pragma solidity ^0.8.20;

interface IAMB {
    function requireToPassMessage(address receiver, bytes calldata data, uint256 gas) external returns (bytes32);
}

contract PingPong {
    address public TARGET_PING_PONG;
    address public immutable AMB;

    uint256 public lastReceivedNonce;

    constructor(address amb) {
        AMB = amb;
    }

    function ping(uint256 nonce) external {
        IAMB(AMB).requireToPassMessage(TARGET_PING_PONG, abi.encodeWithSignature("pong(uint256)", nonce), 300000);
    }

    function pong(uint256 nonce) external {
        lastReceivedNonce = nonce;
    }

    function setTargetPingPong(address targetPingPong) external {
        TARGET_PING_PONG = targetPingPong;
    }
}
