// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IWETHOmnibridgeRouter {
    receive() external payable;

    function WETH() external view returns (address);
    function bridge() external view returns (address);
    function claimTokens(address _token, address _to) external;
    function onTokenBridged(address _token, uint256 _value, bytes memory _data) external;
    function owner() external view returns (address);
    function transferOwnership(address _newOwner) external;
  
    function wrapAndRelayTokens(address _receiver) external payable;
}
