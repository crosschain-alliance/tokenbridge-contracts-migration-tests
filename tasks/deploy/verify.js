// eslint-disable-next-line @typescript-eslint/no-explicit-any
const verify = async (hre, contract, constructorArguments) => {
    //   console.log('Waiting for 5 confirmations...')
    //   await contract.deployTransaction.wait(5)
    console.log('Verifying contract...', contract)
  
    try {
      await hre.run('verify:verify', {
        address: contract,
        constructorArguments,
      })
    } catch (e) {
      console.error(e)
    }
  }
  
  module.exports = verify
  