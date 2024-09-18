const { task } = require('hardhat/config')
const verify = require('./verify')
require('dotenv').config()

task('deploy:HashiManager')
  .addFlag('verify')
  .setAction(async (_taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners()
    let ProxyFactory = await hre.ethers.getContractFactory('EternalStorageProxy')
    let HashiManagerFactory = await hre.ethers.getContractFactory('HashiManager')
    let HashiManagerProxy = await ProxyFactory.deploy()
    let HashiManager = await HashiManagerFactory.deploy()
    await HashiManager.deploymentTransaction().wait()
    await HashiManagerProxy.deploymentTransaction().wait()

    await HashiManagerProxy.connect(owner).upgradeTo('1', await HashiManager.getAddress())
    HashiManager = HashiManager.attach(await HashiManagerProxy.getAddress())
    await HashiManager.connect(owner).initialize(owner.address)

    if (_taskArgs.verify) {
      await verify(hre, await HashiManager.getAddress(), [])
      await verify(hre, await HashiManagerProxy.getAddress(), [])
    }
  })
