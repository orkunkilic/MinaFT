import {
  Field,
  SmartContract,
  state,
  State,
  method,
  prop,
  UInt64,
  Poseidon,
  PrivateKey,
  CircuitValue,
  PublicKey,
  Signature,
  UInt32,
  Permissions,
  isReady,
  Mina,
  shutdown,
  Party,
  Bool,
  Encoding,
} from 'snarkyjs';
import { NFTStorage, Blob } from 'nft.storage';

export { main, deploy, mint, transfer, getState };

interface Balances {
  address: string;
  balance: Field;
  ids: UInt32[];
}

interface Allowances {
  owner: string;
  spenders: string[];
}

class Event extends CircuitValue {
  value: Field[];

  constructor(value: Field[]) {
    super();
    this.value = value;
  }
}

class BalanceEvent extends Event {
  type: Number = 0;

  constructor(value: Field[]) {
    super(value);
  }
}

class AllowanceEvent extends Event {
  type: Number = 1;

  constructor(value: Field[]) {
    super(value);
  }
}

class Bytes extends CircuitValue {
  value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  toFields(): Field[] {
    return Encoding.stringToFields(this.value);
  }
}

class SignatureWithSigner extends CircuitValue {
  @prop signature: Signature;
  @prop signer: PublicKey;

  constructor(signature: Signature, signer: PublicKey) {
    super();
    this.signature = signature;
    this.signer = signer;
  }

  static create(signer: PrivateKey, message: Field[]): SignatureWithSigner {
    return new SignatureWithSigner(
      Signature.create(signer, message),
      signer.toPublicKey()
    );
  }
}

let toAddress: string;
let toAddress2: string;
// just mocking zkOracle for now
const getDataFromOracle = (cid: string, mockId: Number): Array<any> => {
  switch (mockId) {
    case 1:
      return [];
    case 2:
      return [
        {
          address: toAddress,
          balance: Field(1),
          ids: [new UInt32(Field(1))],
        },
      ];
    case 3:
      return [
        {
          address: toAddress,
          balance: Field(1),
          ids: [new UInt32(Field(1))],
        },
        {
          address: toAddress2,
          balance: Field(1),
          ids: [new UInt32(Field(2))],
        },
      ];
  }
  return [];
};

const uploadFile = async (file: any): Promise<string> => {
  const NFT_STORAGE_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGZmQTUyZDVDMGNjMDk1RDA2NjQxRTU1NEZjNDUyOGZkRjIzYTUxMmIiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY1MDY3OTk1ODA3NiwibmFtZSI6InprLW5mdCJ9.q8nbrsFmMclciLfKh0x33hiFR50kY4BAm-bsdcK26a0';
  const client = new NFTStorage({ token: NFT_STORAGE_TOKEN });

  const someData = new Blob([JSON.stringify(file)]);
  const cid = await client.storeBlob(someData);
  return cid;
};

let initialBalance = 10_000_000_000;
class ERC721 extends SmartContract {
  @state(Field) _allowances = State<Field>();
  @state(Field) _balanceOf = State<Field>();
  @state(PublicKey) _owner = State<PublicKey>();
  @state(UInt32) _idNonce = State<UInt32>();
  private _name: string = '';
  private _baseURI: string = '';
  private _baseExtension: string = '';
  private _symbol: string = '';
  private _totalSupply: UInt32 = new UInt32(Field(0));

  deploy(args: any) {
    super.deploy({
      verificationKey: args.verificationKey,
      zkappKey: args.zkappKey,
    });
    this._name = args.name;
    this._baseURI = args.baseURI;
    this._baseExtension = args.baseExtension;
    this._symbol = args.symbol;
    this._totalSupply = args.totalSupply;
    this.self.update.permissions.setValue({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.balance.addInPlace(UInt64.fromNumber(initialBalance));
    this._balanceOf.set(
      Poseidon.hash(
        Encoding.stringToFields(
          'bafkreicpkpg2ddblvigagvf3l6nd5s7f5ujkwtmocg5iopbpcelbeavziu'
        )
      )
    );
    this._owner.set(args.owner);
    this._idNonce.set(new UInt32(new Field(0)));
    this._allowances.set(
      Poseidon.hash(
        Encoding.stringToFields(
          'bafkreicpkpg2ddblvigagvf3l6nd5s7f5ujkwtmocg5iopbpcelbeavziu'
        )
      )
    );
    this.emitEvent(
      new BalanceEvent(Encoding.stringToFields(JSON.stringify([])))
    );
    this.emitEvent(
      new AllowanceEvent(Encoding.stringToFields(JSON.stringify([])))
    );
  }

  @method updateBalances(cid: Bytes, s: SignatureWithSigner) {
    s.signature
      .verify(s.signer, Encoding.stringToFields(cid.value))
      .assertEquals(true);
    const hashedCID = Poseidon.hash(Encoding.stringToFields(cid.value));
    this._balanceOf.set(hashedCID);
  }

  @method updateApprovals(cid: Bytes, s: SignatureWithSigner) {
    s.signature
      .verify(s.signer, Encoding.stringToFields(cid.value))
      .assertEquals(true);
    const hashedCID = Poseidon.hash(Encoding.stringToFields(cid.value));
    this._allowances.set(hashedCID);
  }

  @method mint(
    balancesCID: Bytes,
    toAddress: Bytes,
    s: SignatureWithSigner,
    mockId: Field
  ) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals(this._owner.get());

    const idNonce: UInt32 = this._idNonce.get();
    const newIdNonce: UInt32 = idNonce.add(new UInt32(new Field(1)));

    newIdNonce.assertLte(this.totalSupply());

    const balancesHash: Field = Poseidon.hash(
      Encoding.stringToFields(balancesCID.value)
    );
    balancesHash.assertEquals(this._balanceOf.get());

    const balancesObj: Array<Balances> = getDataFromOracle(
      balancesCID.value,
      Number(mockId.toString())
    );

    const index = balancesObj.findIndex(
      (item) => item.address === toAddress.value
    );
    if (index === -1) {
      balancesObj.push({
        address: toAddress.value,
        balance: Field(1),
        ids: [newIdNonce],
      });
      return [this._balanceOf.get(), this._idNonce.get()];
    }
    const balancesOfUser = balancesObj[index];
    balancesOfUser.balance = balancesOfUser.balance.add(1);
    balancesOfUser.ids.push(newIdNonce);
    balancesObj[index] = balancesOfUser;
    const newBalances = JSON.stringify(balancesObj);
    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)));

    this._idNonce.set(newIdNonce);

    return [this._balanceOf.get(), this._idNonce.get()];
  }

  @method transfer(
    balancesCID: Bytes,
    toAddress: Bytes,
    value: UInt32,
    s: SignatureWithSigner,
    mockId: Field
  ) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const balancesHash = Poseidon.hash(
      Encoding.stringToFields(balancesCID.value)
    );
    balancesHash.assertEquals(this._balanceOf.get());

    const balancesObj: Array<Balances> = getDataFromOracle(
      balancesCID.value,
      Number(mockId.toString())
    );

    const fromIndex = balancesObj.findIndex(
      (item) => item.address === signer.toBase58()
    );
    const toIndex = balancesObj.findIndex(
      (item) => item.address === toAddress.value
    );

    const from = balancesObj[fromIndex];
    const to = balancesObj[toIndex];

    from.balance = from.balance.sub(1);
    to.balance = to.balance.add(1);

    const newIds = from.ids.filter((item) => !item.equals(value));
    from.ids = newIds;
    to.ids.push(value);

    balancesObj[fromIndex] = from;
    balancesObj[toIndex] = to;

    const newBalances = JSON.stringify(balancesObj);

    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)));

    return this._balanceOf.get();
  }

  balanceOf(balancesCID: Bytes, owner: Bytes, mockId: Field) {
    const balancesHash: Field = Poseidon.hash(
      Encoding.stringToFields(balancesCID.value)
    );
    balancesHash.assertEquals(this._balanceOf.get());

    const balancesObj: Array<Balances> = getDataFromOracle(
      balancesCID.value,
      Number(mockId.toString())
    );

    const index = balancesObj.findIndex((item) => item.address === owner.value);
    return balancesObj[index].balance;
  }

  name() {
    return this._name;
  }

  symbol() {
    return this._symbol;
  }

  totalSupply() {
    return this._totalSupply;
  }

  baseURI() {
    return this._baseURI;
  }

  baseExtension() {
    return this._baseExtension;
  }

  tokenURI(id: UInt32) {
    return this.baseURI() + id.toString() + this.baseExtension();
  }

  // did not implemented cid verification for now, it just takes whole object as parameter
  @method approve(allowances: Bytes, spender: Bytes, s: SignatureWithSigner) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const allowanceHash = Poseidon.hash(
      Encoding.stringToFields(allowances.value)
    );
    allowanceHash.assertEquals(this._allowances.get());
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowanceIndex = allowanceObj.findIndex(
      (item) => item.owner === signer.toBase58()
    );
    if (allowanceIndex == -1) {
      const newAllowanceObj = {
        owner: signer.toBase58(),
        spenders: [spender.value],
      };
      allowanceObj.push(newAllowanceObj);

      const newAllowances = JSON.stringify(allowanceObj);

      this.emitEvent(
        new AllowanceEvent(Encoding.stringToFields(newAllowances))
      );
      return true; // owner created & spender added
    }
    const allowancesOfUser = allowanceObj[allowanceIndex];
    const isSpender = allowancesOfUser.spenders.findIndex(
      (item) => item === spender.value
    );
    if (isSpender != -1) {
      return true; // already approwed
    }

    allowancesOfUser.spenders.push(spender.value);
    allowanceObj[allowanceIndex] = allowancesOfUser;

    const newAllowances = JSON.stringify(allowanceObj);
    this.emitEvent(new AllowanceEvent(Encoding.stringToFields(newAllowances)));

    return this._allowances.get(); // ok
  }

  allowance(allowances: Bytes, owner: Bytes, spender: Bytes) {
    const allowanceHash = Poseidon.hash([Field(allowances.value)]);
    allowanceHash.assertEquals(this._allowances.get());
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowanceIndex = allowanceObj.findIndex(
      (item) => item.owner === owner.value
    );
    if (allowanceIndex == -1) {
      return 0;
    }
    const allowancesOfUser = allowanceObj[allowanceIndex];
    const isSpender = allowancesOfUser.spenders.findIndex(
      (item) => item === spender.value
    );
    if (isSpender == -1) {
      return 0;
    }
    return 1;
  }

  // did not implemented cid verification for now, it just takes whole object as parameter
  @method transferFrom(
    allowances: Bytes,
    balances: Bytes,
    fromAddress: Bytes,
    toAddress: Bytes,
    value: UInt32,
    s: SignatureWithSigner
  ) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const allowanceHash = Poseidon.hash(
      Encoding.stringToFields(allowances.value)
    );
    allowanceHash.assertEquals(this._allowances.get());
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowancesOfUser = allowanceObj.filter(
      (item) => item.owner === fromAddress.value
    );
    const index = allowancesOfUser.findIndex((item) =>
      item.spenders.includes(signer.toBase58())
    );
    if (index == -1) {
      return false; // not allowed
    }

    const balancesHash = Poseidon.hash(Encoding.stringToFields(balances.value));
    balancesHash.assertEquals(this._balanceOf.get());
    const balancesObj: Array<Balances> = JSON.parse(balances.value);

    const fromIndex = balancesObj.findIndex(
      (item) => item.address === fromAddress.value
    );
    const toIndex = balancesObj.findIndex(
      (item) => item.address === toAddress.value
    );

    const from = balancesObj[fromIndex];
    const to = balancesObj[toIndex];

    from.balance = from.balance.sub(1);
    to.balance = to.balance.add(1);

    const newIds = from.ids.filter((item) => !item.equals(value));
    from.ids = newIds;
    to.ids.push(value);

    balancesObj[fromIndex] = from;
    balancesObj[toIndex] = to;

    const newBalances = JSON.stringify(balancesObj);
    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)));

    return this._balanceOf.get();
  }

  @method transferOwnership(newOwner: Bytes, s: SignatureWithSigner) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals(this._owner.get());
    this._owner.set(PublicKey.fromBase58(newOwner.value));
    return this._owner.get();
  }

  isOwner(s: SignatureWithSigner) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    return signer.equals(this._owner.get());
  }
}

const main = async () => {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const owner = Local.testAccounts[0].privateKey;
  const player2 = Local.testAccounts[1].privateKey;

  const ownerPublic = owner.toPublicKey();
  const player2Public = player2.toPublicKey();

  console.log('owner privKey :>>', owner.toBase58());
  console.log('owner pubKey :>>', ownerPublic.toBase58());

  toAddress = player2Public.toBase58();
  toAddress2 = ownerPublic.toBase58();

  const zkAppPrivkey = PrivateKey.random();
  const zkAppPubkey = zkAppPrivkey.toPublicKey();

  let zkAppInstance = new ERC721(zkAppPubkey);

  const getStatus = () => {
    try {
      let b = Mina.getAccount(zkAppPubkey);
      console.log('state of the zkApp :>>');
      for (const state of b.zkapp.appState) {
        console.log(':>>', state.toString());
      }
    } catch (error) {
      console.log('Error in get:>>', error);
    }
  };

  let cid: string;

  try {
    console.log('\n====== DEPLOYING ======\n');
    await Mina.transaction(owner, () => {
      const p = Party.createSigned(owner, { isSameAsFeePayer: true });
      p.balance.subInPlace(UInt64.fromNumber(initialBalance));
      zkAppInstance.deploy({
        verificationKey: undefined,
        zkappKey: zkAppPrivkey,
        owner: ownerPublic,
        name: 'zkNFT',
        symbol: 'ZNFT',
        totalSupply: new UInt32(Field(5)),
        baseURI: 'https://zk-nft.com/',
        baseExtension: '.json',
      });
    })
      .send()
      .wait();

    try {
      console.log('\n====== DEPLOY EVENT EMMITED ======\n');
      // get this from frontend & mock like it came from event
      const file: any = [];
      cid = await uploadFile(file);
      await Mina.transaction(owner, () => {
        const signature = SignatureWithSigner.create(
          owner,
          Encoding.stringToFields(cid)
        );
        zkAppInstance.updateBalances(new Bytes(cid), signature);
        zkAppInstance.updateApprovals(new Bytes(cid), signature);
        zkAppInstance.self.sign(zkAppPrivkey);
        zkAppInstance.self.body.incrementNonce = Bool(true);
      })
        .send()
        .wait();
    } catch (error) {
      console.log('Error update :>>', error);
    }
  } catch (error) {
    console.log('Error in deploy:>>', error);
  }

  console.log('Contract name :>>', zkAppInstance.name());
  console.log('Contract symbol :>>', zkAppInstance.symbol());

  console.log('\n====== STATE AFTER DEPLOY ======\n');
  getStatus();

  let cid1: string;

  try {
    await Mina.transaction(owner, () => {
      console.log('\n====== MINT TOKEN 1======\n');
      console.log('tx mint started');
      const signature = SignatureWithSigner.create(
        owner,
        zkAppInstance.nonce.toFields()
      );
      zkAppInstance.mint(
        new Bytes(cid),
        new Bytes(player2Public.toBase58()),
        signature,
        Field(1)
      );
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
      .send()
      .wait();

    try {
      // get this from frontend & mock like it came from event
      const balances = [
        {
          address: player2Public.toBase58(),
          balance: Field(1),
          ids: [new UInt32(Field(1))],
        },
      ];

      cid1 = await uploadFile(balances);
      await Mina.transaction(owner, () => {
        console.log('\n====== MINT 1 EVENT EMMITED ======\n');
        let signature = SignatureWithSigner.create(
          owner,
          Encoding.stringToFields(cid1)
        );
        zkAppInstance.updateBalances(new Bytes(cid1), signature);
        zkAppInstance.self.sign(zkAppPrivkey);
        zkAppInstance.self.body.incrementNonce = Bool(true);
      })
        .send()
        .wait();
    } catch (error) {
      console.log('Error update2 :>>', error);
    }
  } catch (error) {
    console.log(error);
  }

  console.log('\n====== STATE AFTER MINTING 1 ======\n');
  getStatus();

  let cid2: string;

  try {
    await Mina.transaction(owner, () => {
      console.log('\n====== MINT TOKEN 2 ======\n');
      console.log('tx mint started');
      const signature = SignatureWithSigner.create(
        owner,
        zkAppInstance.nonce.toFields()
      );
      zkAppInstance.mint(
        new Bytes(cid1),
        new Bytes(player2Public.toBase58()),
        signature,
        Field(2)
      );
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
      .send()
      .wait();

    try {
      // get this from frontend & mock like it came from event
      const balances = [
        {
          address: player2Public.toBase58(),
          balance: Field(2),
          ids: [new UInt32(Field(1)), new UInt32(Field(2))],
        },
      ];

      cid2 = await uploadFile(balances);
      await Mina.transaction(owner, () => {
        console.log('\n====== MINT 2 EVENT EMMITED ======\n');
        let signature = SignatureWithSigner.create(
          owner,
          Encoding.stringToFields(cid2)
        );
        zkAppInstance.updateBalances(new Bytes(cid2), signature);
        zkAppInstance.self.sign(zkAppPrivkey);
        zkAppInstance.self.body.incrementNonce = Bool(true);
      })
        .send()
        .wait();
    } catch (error) {
      console.log('Error update2 :>>', error);
    }
  } catch (error) {
    console.log(error);
  }

  console.log('\n====== STATE AFTER MINTING 2 ======\n');
  getStatus();

  let cid3: string;

  try {
    await Mina.transaction(owner, () => {
      console.log('\n====== TRANSFER TOKEN 1 ======\n');
      console.log('tx transfer started');
      const signature = SignatureWithSigner.create(
        owner,
        zkAppInstance.nonce.toFields()
      );
      zkAppInstance.transfer(
        new Bytes(cid2),
        new Bytes(ownerPublic.toBase58()),
        new UInt32(Field(1)),
        signature,
        Field(3)
      );
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
      .send()
      .wait();

    try {
      // get this from frontend & mock like it came from event
      const balances = [
        {
          address: player2Public.toBase58(),
          balance: Field(1),
          ids: [new UInt32(Field(2))],
        },
        {
          address: ownerPublic.toBase58(),
          balance: Field(1),
          ids: [new UInt32(Field(1))],
        },
      ];

      cid3 = await uploadFile(balances);
      await Mina.transaction(owner, () => {
        console.log('\n====== TRANSFER 1 EVENT EMMITED ======\n');
        let signature = SignatureWithSigner.create(
          owner,
          Encoding.stringToFields(cid3)
        );
        zkAppInstance.updateBalances(new Bytes(cid3), signature);
        zkAppInstance.self.sign(zkAppPrivkey);
        zkAppInstance.self.body.incrementNonce = Bool(true);
      })
        .send()
        .wait();
    } catch (error) {
      console.log('Error update2 :>>', error);
    }
  } catch (error) {
    console.log(error);
  }

  console.log('\n====== STATE AFTER TRANSFER 1 ======\n');
  getStatus();

  try {
    shutdown();
  } catch (error) {
    console.log('Error in shutdown:>>', error);
  }
};

main(); // mints 2 token and transfer the other one

// uncomment for using inside dApp
/* await isReady;
const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local); */

async function deploy(
  name: string,
  symbol: string,
  totalSupply: number,
  baseURI: string,
  baseExtension: string,
  account: PrivateKey
) {
  const zkAppPrivKey = PrivateKey.random();
  let zkAppAddress = zkAppPrivKey.toPublicKey();
  let zkAppInterface = {
    mint(
      cid: string,
      toAddress: string,
      mockId: Field,
      zkAppAddress: PublicKey,
      zkAppPrivKey: PrivateKey,
      privKey: PrivateKey
    ) {
      return mint(cid, toAddress, mockId, zkAppAddress, zkAppPrivKey, privKey);
    },
    transfer(
      cid: string,
      toAddress: string,
      mockId: Field,
      zkAppAddress: PublicKey,
      zkAppPrivKey: PrivateKey,
      privKey: PrivateKey
    ) {
      return transfer(
        cid,
        toAddress,
        mockId,
        zkAppAddress,
        zkAppPrivKey,
        privKey
      );
    },
    getState(zkAppAddress: PublicKey) {
      return getState(zkAppAddress);
    },
  };

  let zkApp = new ERC721(zkAppAddress);
  await Mina.transaction(account, () => {
    const p = Party.createSigned(account, { isSameAsFeePayer: true });
    p.balance.subInPlace(UInt64.fromNumber(initialBalance));
    zkApp.deploy({
      verificationKey: undefined,
      zkappKey: zkAppPrivKey,
      owner: account.toBase58(),
      name,
      symbol,
      totalSupply: new UInt32(Field(totalSupply)),
      baseURI,
      baseExtension,
    });
  })
    .send()
    .wait();

  return zkAppInterface;
}

async function getState(zkAppAddress: PublicKey) {
  try {
    let b = Mina.getAccount(zkAppAddress);
    return b.zkapp.appState;
  } catch (error) {
    console.log('Error in get:>>', error);
  }
}

async function transfer(
  cid: string,
  toAddress: string,
  mockId: Field,
  zkAppAddress: PublicKey,
  zkAppPrivKey: PrivateKey,
  privKey: PrivateKey
) {
  let zkApp = new ERC721(zkAppAddress);
  let tx = Mina.transaction(privKey, async () => {
    zkApp.transfer(
      new Bytes(cid),
      new Bytes(toAddress),
      new UInt32(Field(1)),
      createSignature(zkAppAddress, privKey),
      mockId
    );
    zkApp.self.sign(zkAppPrivKey);
    zkApp.self.body.incrementNonce = Bool(true);
  });
  try {
    await tx.send().wait();
  } catch (err) {
    console.log('Error!');
  }
}

async function mint(
  cid: string,
  toAddress: string,
  mockId: Field,
  zkAppAddress: PublicKey,
  zkAppPrivKey: PrivateKey,
  privKey: PrivateKey
) {
  let zkApp = new ERC721(zkAppAddress);
  let tx = Mina.transaction(privKey, async () => {
    zkApp.mint(
      new Bytes(cid),
      new Bytes(toAddress),
      createSignature(zkAppAddress, privKey),
      mockId
    );
    zkApp.self.sign(zkAppPrivKey);
    zkApp.self.body.incrementNonce = Bool(true);
  });
  try {
    await tx.send().wait();
  } catch (err) {
    console.log('Error!');
  }
}
function createSignature(zkAppAddress: PublicKey, signer: PrivateKey) {
  let zkApp = new ERC721(zkAppAddress);
  return SignatureWithSigner.create(signer, zkApp.nonce.toFields());
}
