import { Keypair } from "@stellar/stellar-sdk";

// `Account` (from @stellar/stellar-sdk, used inside useRegistrationFlow's
// submit()) validates its accountId via StrKey.decodeEd25519PublicKey —
// checksum and all — not just a "starts with G, 56 chars" format check.
// A hand-typed placeholder like "GABC123TESTWALLET" fails that validation
// and throws "accountId is invalid" before a test's mocked SDK call is ever
// reached. Keypair.random() produces a real, valid-checksum keypair, so
// this constant is a genuine (if arbitrary) Stellar public key rather than
// a fake string that merely looks like one. It's generated once at module
// load and reused everywhere so failures stay reproducible within a run.
export const TEST_WALLET_ADDRESS = Keypair.random().publicKey();
