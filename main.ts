import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { MerkleTree } from "merkletreejs";
import { Contract } from "ethers"
// import { keccak256 } from "ethers"

const AlchemyProviderURL = "https://eth-mainnet.g.alchemy.com/v2/rvXrnLRbAO51B4pKbxypCnKDvdyHeyxa";
const MBRAAddress = "0x1000b3bdc7FAeBB1FFfF9CEB65e54b6360c2D99d";

const MBRAMintSignature = "0xae7c122e";
const OGPortalMintSignature = "0xcbb5e77b";

// алгоритм решения для MBRA
// 1) Получить все минты
// 2) Декодировать коллдату минтов
// 3) Получить пруф из контракта
// 4) Посмотреть колличество минтов, для которых пруф отработал
// 5) Посчитать кол-во минтов с пруфом и успешные ли они ======> это будет кол-во сминченных вайтлист токенов
// 6) Все остальные успешные минты =======> public минт
// 7) Средний газ по минтам всех видов
// 8) Время и транзакция, после которой начался public
async function OGPortal() {
	const alchemyProv = new ethers.providers.JsonRpcProvider(AlchemyProviderURL);
	const content = readFileSync("./ABIs/OGPortal.json", "utf-8");
	const iface = new ethers.utils.Interface(
		JSON.parse(content)
	)

	const mintTransactionsHashes: string[] = [
		"0x7bc7cafa77e9a204214b977cd4281ee27751bfebe4a46bcdd1c814ac60cb87f9",
		"0x7964304f0db31ff34b43e29cd99bd8a870541ca28aabcaf8278f00ba2d19b492",
		"0xe43919e2365319c67a2660886311a0483027df607812266a65e483131f07abed",
	]

	let publicMintsAmount = 0;
	let amountOfTokensBoughtThroughPublicMint: ethers.BigNumber = ethers.BigNumber.from(0);
	let publicMintsGasTotal: ethers.BigNumber = ethers.BigNumber.from(0);

	for (let i = 0; i < mintTransactionsHashes.length; i++) {
		const reciept = await alchemyProv.getTransactionReceipt(mintTransactionsHashes[i])
		const tx = await alchemyProv.getTransaction(mintTransactionsHashes[i])

		if (reciept.status != 0) {
			const args = iface.decodeFunctionData("mintAndTransfer", tx.data);
			publicMintsGasTotal = publicMintsGasTotal.add(reciept.gasUsed);

			for (let k = 0; k < args._qtyRecipients.length; k++) {
				amountOfTokensBoughtThroughPublicMint = amountOfTokensBoughtThroughPublicMint.add(args._qtyRecipients[k].qty)
			}

			publicMintsAmount++
		}
	}

	console.log(`gas total: ${publicMintsGasTotal.toNumber()}`)
	console.log(`gas average: ${publicMintsGasTotal.div(publicMintsAmount).toNumber()}`)
	console.log(`amount of minted nfts: ${amountOfTokensBoughtThroughPublicMint.toNumber()}`)
}


// console.log(`whitelisted mints amount: ${whitelistedMintsAmount}`)
// console.log(`public mints amount: ${publicMintsAmount}`)
// console.log()
// console.log(`total gas for whitelisted mints: ${whitelistedMintsGasTotal}`)
// console.log(`total gas for public mints: ${publicMintsGasTotal}`)
// console.log()
// console.log(`average gas for whitelisted mints: ${(whitelistedMintsGasTotal.div(whitelistedMintsAmount)).toString()}`)
// console.log(`average gas for public mints: ${(publicMintsGasTotal.div(publicMintsAmount)).toString()}`)
// console.log()
// console.log(`amount of tokens bought through whitelisted mint: ${amountOfTokensBoughtThroughWhitelistedMint}`)
// console.log(`amount of tokens bought through public: ${amountOfTokensBoughtThroughPublicMint}`)


// const content = `whitelisted mints amount: ${whitelistedMintsAmount}
// public mints amount: ${publicMintsAmount}

// total gas for whitelisted mints: ${whitelistedMintsGasTotal}
// total gas for public mints: ${publicMintsGasTotal}

// average gas for whitelisted mints: ${(whitelistedMintsGasTotal.div(whitelistedMintsAmount)).toString()}
// average gas for public mints: ${(publicMintsGasTotal.div(publicMintsAmount)).toString()}

// amount of tokens bought through whitelisted mint: ${amountOfTokensBoughtThroughWhitelistedMint.toString()}
// amount of tokens bought through publice: ${amountOfTokensBoughtThroughPublicMint.toString()}
// `


async function MBRA() {
	const etherscanProvider = new ethers.providers.EtherscanProvider();
	const history = await etherscanProvider.getHistory(MBRAAddress);

	const iface = new ethers.utils.Interface([
		"function mintToken(uint256 numberOfTokens, bytes32[] merkleProof)"
	])

	const alchemyProv = new ethers.providers.JsonRpcProvider(AlchemyProviderURL);
	const merkleRoot = "0xa0339c7261ff2810d32a170030626514a9f1f5dcafa3c19a7c33ebb58a49eede";

	let whitelistedMintsAmount = 0;
	let publicMintsAmount = 0;

	let amountOfTokensBoughtThroughWhitelistedMint: ethers.BigNumber = ethers.BigNumber.from(0);
	let amountOfTokensBoughtThroughPublicMint: ethers.BigNumber = ethers.BigNumber.from(0);

	let whitelistedMintsGasTotal: ethers.BigNumber = ethers.BigNumber.from(0);
	let publicMintsGasTotal: ethers.BigNumber = ethers.BigNumber.from(0);

	let counter: number = 0;
	for (let i = 0; i < history.length; i++) {
		let tx = history[i];
		const methodSignature = tx.data.slice(0, 10);

		if (methodSignature == MBRAMintSignature) {
			let args = iface.decodeFunctionData("mintToken", tx.data);
			const reciept = await alchemyProv.getTransactionReceipt(tx.hash);

			if (reciept.status != 0) {
				if (args.merkleProof.length > 0) {
					const valid = isProofValid(args.merkleProof, tx.from, merkleRoot);
					counter++

					if (valid) {
						whitelistedMintsGasTotal = whitelistedMintsGasTotal.add(reciept.gasUsed);
						whitelistedMintsAmount++;
						amountOfTokensBoughtThroughWhitelistedMint = amountOfTokensBoughtThroughWhitelistedMint.add(args.numberOfTokens);
					} else {
						publicMintsGasTotal = publicMintsGasTotal.add(reciept.gasUsed);
						publicMintsAmount++;
						amountOfTokensBoughtThroughPublicMint = amountOfTokensBoughtThroughPublicMint.add(args.numberOfTokens);
					}
					console.log(counter)
				} else {
					counter++
					console.log(counter)
					publicMintsGasTotal = publicMintsGasTotal.add(reciept.gasUsed)

					publicMintsAmount++;
					amountOfTokensBoughtThroughPublicMint = amountOfTokensBoughtThroughPublicMint.add(args.numberOfTokens);
				}
			}
		}
	}

	console.log(`whitelisted mints amount: ${whitelistedMintsAmount}`)
	console.log(`public mints amount: ${publicMintsAmount}`)
	console.log()
	console.log(`total gas for whitelisted mints: ${whitelistedMintsGasTotal}`)
	console.log(`total gas for public mints: ${publicMintsGasTotal}`)
	console.log()
	console.log(`average gas for whitelisted mints: ${(whitelistedMintsGasTotal.div(whitelistedMintsAmount)).toString()}`)
	console.log(`average gas for public mints: ${(publicMintsGasTotal.div(publicMintsAmount)).toString()}`)
	console.log()
	console.log(`amount of tokens bought through whitelisted mint: ${amountOfTokensBoughtThroughWhitelistedMint}`)
	console.log(`amount of tokens bought through public: ${amountOfTokensBoughtThroughPublicMint}`)

	const content = `
	whitelisted mints amount: ${whitelistedMintsAmount}
	public mints amount: ${publicMintsAmount}

	total gas for whitelisted mints: ${whitelistedMintsGasTotal}
	total gas for public mints: ${publicMintsGasTotal}

	average gas for whitelisted mints: ${(whitelistedMintsGasTotal.div(whitelistedMintsAmount)).toString()}
	average gas for public mints: ${(publicMintsGasTotal.div(publicMintsAmount)).toString()}

	amount of tokens bought through whitelisted mint: ${amountOfTokensBoughtThroughWhitelistedMint.toString()}
	amount of tokens bought through publice: ${amountOfTokensBoughtThroughPublicMint.toString()}
	`

	writeFileSync("MBRAresult.txt", content)
}


function isProofValid(proof: string[], sender: string, root: string): boolean {
	const leaf = ethers.utils.keccak256(ethers.utils.solidityPack(
		["address"],
		[sender]
	))
	return (new MerkleTree([root], ethers.utils.keccak256, {
		sort: true,
	})).verify(proof, leaf, root)
}



async function main() {
	// await MBRA()
	await OGPortal()
}

main().catch(e => console.log(e))