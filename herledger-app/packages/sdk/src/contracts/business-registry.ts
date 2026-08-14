import {
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  rpc as StellarRpc,
} from "@stellar/stellar-sdk";
import type { Business, StellarNetworkConfig, ContractConfig, TransactionResult } from "../types/index.js";
import { RpcError, ContractError } from "../errors/index.js";
import { getSorobanRpcServer } from "../rpc/client.js";
import { simulateAndPrepare, submitAndWait } from "../rpc/transactions.js";
import { signTransactionWithFreighter } from "../wallet/freighter.js";
import {
  encodeBytes32,
  encodeAddress,
  decodeBytes32,
  decodeAddress,
  decodeBool,
} from "./encoding.js";

// ---------------------------------------------------------------------------
// BusinessRegistry contract client
// ---------------------------------------------------------------------------

function decodeBusiness(val: xdr.ScVal): Business {
  // The contract returns a struct ScVal (SCV_MAP)
  const map = val.map();
  if (!map) throw new ContractError("Expected struct map for Business");

  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym();
    fields[key] = entry.val();
  }

  const id = fields["id"] ? decodeBytes32(fields["id"]) : "";
  const owner = fields["owner"] ? decodeAddress(fields["owner"]) : "";
  const wallet = fields["wallet"] ? decodeAddress(fields["wallet"]) : "";
  const metadataHash = fields["metadata_hash"] ? decodeBytes32(fields["metadata_hash"]) : "";
  const active = fields["active"] ? decodeBool(fields["active"]) : false;

  return { id, owner, wallet, metadataHash, active };
}

/**
 * Read: get_business(business_id) -> Option<Business>
 */
export async function getBusiness(
  businessId: string,
  config: StellarNetworkConfig,
  contracts: ContractConfig
): Promise<Business | null> {
  const server = getSorobanRpcServer(config);
  const contract = new Contract(contracts.businessRegistryId);

  const tx = new TransactionBuilder(
    new Account("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", "0"),
    { fee: "100", networkPassphrase: config.networkPassphrase }
  )
    .addOperation(
      contract.call("get_business", encodeBytes32(businessId))
    )
    .setTimeout(30)
    .build();

  let simResult: StellarRpc.Api.SimulateTransactionResponse;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (cause) {
    throw new RpcError("get_business simulation failed", cause);
  }

  if (StellarRpc.Api.isSimulationError(simResult)) {
    throw new ContractError(`get_business error: ${simResult.error}`);
  }

  const returnVal = simResult.result?.retval;
  if (!returnVal || returnVal.switch() === xdr.ScValType.scvVoid()) return null;

  return decodeBusiness(returnVal);
}

/**
 * Read: get_business_by_wallet(wallet) -> Option<Business>
 */
export async function getBusinessByWallet(
  wallet: string,
  config: StellarNetworkConfig,
  contracts: ContractConfig
): Promise<Business | null> {
  const server = getSorobanRpcServer(config);
  const contract = new Contract(contracts.businessRegistryId);

  const tx = new TransactionBuilder(
    new Account("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", "0"),
    { fee: "100", networkPassphrase: config.networkPassphrase }
  )
    .addOperation(
      contract.call("get_business_by_wallet", encodeAddress(wallet))
    )
    .setTimeout(30)
    .build();

  let simResult: StellarRpc.Api.SimulateTransactionResponse;
  try {
    simResult = await server.simulateTransaction(tx);
  } catch (cause) {
    throw new RpcError("get_business_by_wallet simulation failed", cause);
  }

  if (StellarRpc.Api.isSimulationError(simResult)) {
    throw new ContractError(`get_business_by_wallet error: ${simResult.error}`);
  }

  const returnVal = simResult.result?.retval;
  if (!returnVal || returnVal.switch() === xdr.ScValType.scvVoid()) return null;

  return decodeBusiness(returnVal);
}

/**
 * Write: register_business(business_id, owner, wallet, metadata_hash)
 */
export async function registerBusiness(
  params: {
    businessId: string;
    owner: string;
    wallet: string;
    metadataHash: string;
    sourceAccount: Account;
  },
  config: StellarNetworkConfig,
  contracts: ContractConfig
): Promise<TransactionResult> {
  const contract = new Contract(contracts.businessRegistryId);

  const tx = new TransactionBuilder(params.sourceAccount, {
    fee: "1000000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "register_business",
        encodeBytes32(params.businessId),
        encodeAddress(params.owner),
        encodeAddress(params.wallet),
        encodeBytes32(params.metadataHash)
      )
    )
    .setTimeout(300)
    .build();

  const prepared = await simulateAndPrepare(tx, config);
  const signedXdr = await signTransactionWithFreighter(
    prepared.toXDR(),
    config.networkPassphrase,
    params.owner
  );
  return submitAndWait(signedXdr, config);
}

/**
 * Write: update_metadata(business_id, metadata_hash)
 */
export async function updateBusinessMetadata(
  params: {
    businessId: string;
    metadataHash: string;
    owner: string;
    sourceAccount: Account;
  },
  config: StellarNetworkConfig,
  contracts: ContractConfig
): Promise<TransactionResult> {
  const contract = new Contract(contracts.businessRegistryId);

  const tx = new TransactionBuilder(params.sourceAccount, {
    fee: "1000000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "update_metadata",
        encodeBytes32(params.businessId),
        encodeBytes32(params.metadataHash)
      )
    )
    .setTimeout(300)
    .build();

  const prepared = await simulateAndPrepare(tx, config);
  const signedXdr = await signTransactionWithFreighter(
    prepared.toXDR(),
    config.networkPassphrase,
    params.owner
  );
  return submitAndWait(signedXdr, config);
}

/**
 * Write: deactivate_business(business_id)
 */
export async function deactivateBusiness(
  params: {
    businessId: string;
    owner: string;
    sourceAccount: Account;
  },
  config: StellarNetworkConfig,
  contracts: ContractConfig
): Promise<TransactionResult> {
  const contract = new Contract(contracts.businessRegistryId);

  const tx = new TransactionBuilder(params.sourceAccount, {
    fee: "1000000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call("deactivate_business", encodeBytes32(params.businessId))
    )
    .setTimeout(300)
    .build();

  const prepared = await simulateAndPrepare(tx, config);
  const signedXdr = await signTransactionWithFreighter(
    prepared.toXDR(),
    config.networkPassphrase,
    params.owner
  );
  return submitAndWait(signedXdr, config);
}
