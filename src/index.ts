import { Field, SmartContract, state, State, method, prop, UInt64, Poseidon, PrivateKey, CircuitValue, PublicKey, Signature, UInt32, Permissions,  Circuit, isReady, Mina, shutdown, Party, Bool, Encoding, arrayProp, Body, call, callUnproved } from 'snarkyjs';
import { NFTStorage, File, Blob } from 'nft.storage'

export interface Balances {
  address: PublicKey;
  balance: Field;
  ids: UInt32[];
} 

export interface Allowances {
  owner: PublicKey;
  spenders: PublicKey[];
} 

export interface Metadatas {
  id: UInt32;
  uri: string;
}

export class Event extends CircuitValue {
  value: Field[];

  constructor(value: Field[]) {
    super();
    this.value = value;
  }
}

export class BalanceEvent extends Event {
  type: Number = 0;

  constructor(value: Field[]) {
    super(value);
  }
}

export class AllowanceEvent extends Event {
  type: Number = 1;

  constructor(value: Field[]) {
    super(value);
  }
}

export class URIEvent extends Event {
  type: Number = 2;

  constructor(value: Field[]) {
    super(value);
  }
}

const uploadFile = async (file: any): Promise<string> => {
  const NFT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGZmQTUyZDVDMGNjMDk1RDA2NjQxRTU1NEZjNDUyOGZkRjIzYTUxMmIiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY1MDY3OTk1ODA3NiwibmFtZSI6InprLW5mdCJ9.q8nbrsFmMclciLfKh0x33hiFR50kY4BAm-bsdcK26a0'
  const client = new NFTStorage({ token: NFT_STORAGE_TOKEN })

  const someData = new Blob([JSON.stringify(
    file
  )]);
  const cid = await client.storeBlob(someData);
  console.log(cid)
  return cid;
}


export class Bytes extends CircuitValue {
  value: string;
  
  constructor(value: string) {
      super();
      this.value = value;
  }

  toFields(): Field[] {
    return Encoding.stringToFields(this.value);
  }
}

export class Bytes128 extends CircuitValue {
  value: Field[];
  
  constructor(value: Field[]) {
      super();
      this.value = value;
  }

  toFields(): Field[] {
    return this.value;
  }

  getValue(): string {
    return Encoding.stringFromFields(this.value);
  }
}

export class BytesArray extends CircuitValue {
  value: Bytes[];

  constructor(value: Bytes[]) {

      super();
      this.value = value;
  }
}

export class PublicKeyArray extends CircuitValue {
  value: PublicKey[];

  constructor(value: PublicKey[]) {
      super();
      this.value = value;
  }
}

export class SignatureWithSigner extends CircuitValue {
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

function encode(string: String) {
  var number = "";
  var length = string.length;
  for (var i = 0; i < length; i++)
      number += string.charCodeAt(i).toString(16);
  return new Field(number);
}

function decode(num: Number) {
  var number = num.toString();
  var string = "";
  number = number.slice(2);
  var length = number.length;
  for (var i = 0; i < length;) {
      var code = number.slice(i, i += 2);
      string += String.fromCharCode(parseInt(code, 16));
  }
  return string;
}

let initialBalance = 10_000_000_000;

const getDataFromContract = async () => {
}

export class ERC721 extends SmartContract {
  @state(Field) _symbol = State<Field>();
  @state(Field) _totalSupply = State<Field>();
  @state(Field) _allowances = State<Field>();
  @state(Field) _balanceOf = State<Field>();
  @state(Field) _tokenURI = State<Field>();
  @state(PublicKey) _owner = State<PublicKey>();
  @state(UInt32) _idNonce = State<UInt32>();


  // initialization
  //deploy(name: string, symbol: string, totalSupply: Field, baseURI: string, s: SignatureWithSigner) {
  deploy(args: any) {
    super.deploy(args);
    this.self.update.permissions.setValue({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature()
    });
    this.balance.addInPlace(UInt64.fromNumber(initialBalance));
    console.log("ok")
  }

  @method async initialize(symbol: Field, totalSupply: Field, s: SignatureWithSigner, zkKey: PrivateKey) {
    s.signature.verify(s.signer, [totalSupply]).assertEquals(true);
    const signer: PublicKey = s.signer;
    this._balanceOf.set(Field(0));
    this._symbol.set((symbol));
    this._totalSupply.set(totalSupply);
    this._owner.set(signer);
    this._idNonce.set(new UInt32(new Field(0)));
    this._allowances.set(Field(0));
    this._tokenURI.set(Field(0));
    this.emitEvent(new BalanceEvent([Field(0)]));
    this.emitEvent(new AllowanceEvent([Field(0)]));
    this.emitEvent(new URIEvent([Field(0)]));
    return true;
  }

  @method updateBalances(cid: Bytes, s: SignatureWithSigner) {
    s.signature.verify(s.signer, Encoding.stringToFields(cid.value)).assertEquals(true);
    const hashedCID = Poseidon.hash(Encoding.stringToFields(cid.value));
    this._balanceOf.set(hashedCID);
  }

  @method updateApprovals(cid: Bytes, s: SignatureWithSigner) {
    s.signature.verify(s.signer, Encoding.stringToFields(cid.value)).assertEquals(true);
    const hashedCID = Poseidon.hash(Encoding.stringToFields(cid.value));
    this._allowances.set(hashedCID);
  }

  @method updateURI(cid: Bytes, s: SignatureWithSigner) {
    s.signature.verify(s.signer, Encoding.stringToFields(cid.value)).assertEquals(true);
    const hashedCID = Poseidon.hash(Encoding.stringToFields(cid.value));
    this._tokenURI.set(hashedCID);
  }

  @method mint(balances: Bytes, tokenURIs: Bytes, toAddress: PublicKey, metadata: Bytes, s: SignatureWithSigner) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals(this._owner.get());

    const balancesHash = Poseidon.hash(Encoding.stringToFields(balances.value));
    balancesHash.assertEquals((this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances.value);
    const index = balancesObj.findIndex(item => item.address.equals(toAddress));
    const balancesOfUser = balancesObj[index];
    balancesOfUser.balance = balancesOfUser.balance.add(1);
    const idNonce = this._idNonce.get();
    const newIdNonce = idNonce.add(1);
    balancesOfUser.ids.push(newIdNonce);
    balancesObj[index] = balancesOfUser;
    const newBalances = JSON.stringify(balancesObj);
    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)));

    const tokenURIsHash = Poseidon.hash(Encoding.stringToFields(tokenURIs.value));
    tokenURIsHash.assertEquals(this._tokenURI.get());
    const tokenURIsObj: Array<Metadatas> = JSON.parse(tokenURIs.value);
    tokenURIsObj.push({
      id: newIdNonce,
      uri: metadata.value
    });
    const newTokenURIs = JSON.stringify(tokenURIsObj);
    this.emitEvent(new URIEvent(Encoding.stringToFields(newTokenURIs)));


    this._idNonce.set(newIdNonce);

    return ([this._balanceOf.get(), this._tokenURI.get(), this._idNonce.get()]);
  }

  @method transfer(balances: Bytes, toAddress: PublicKey, value: UInt32, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const balancesHash = Poseidon.hash(Encoding.stringToFields(balances.value));
    balancesHash.assertEquals(( this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances.value);

    const fromIndex = balancesObj.findIndex(item => item.address.equals(signer));
    const toIndex = balancesObj.findIndex(item => item.address.equals(toAddress));

    const from = balancesObj[fromIndex];
    const to = balancesObj[toIndex];

    from.balance = from.balance.sub(1);
    to.balance = to.balance.add(1);

    const newIds = from.ids.filter(item => !item.equals(value));
    from.ids = newIds;
    to.ids.push(value);

    balancesObj[fromIndex] = from;
    balancesObj[toIndex] = to;

    const newBalances = JSON.stringify(balancesObj);
    
    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)))

    return (this._balanceOf.get());
  }

  @method balanceOf(balances: Bytes, owner: PublicKey) {
    const balancesHash = Poseidon.hash([Field(balances.value)]);
    balancesHash.assertEquals((this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances.value);
    const index = balancesObj.findIndex(item => item.address.equals(owner));
    return balancesObj[index].balance;
  }


  @method symbol() {
    return this._symbol.get();
  }

  @method totalSupply() {
    return this._totalSupply.get();
  }

  @method tokenURI(id: Field) {
    return this._tokenURI.get();
  }

  @method approve(allowances: Bytes, spender: PublicKey, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const allowanceHash = Poseidon.hash(Encoding.stringToFields(allowances.value));
    allowanceHash.assertEquals(( this._allowances.get()));
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowanceIndex = allowanceObj.findIndex(item => item.owner.equals(signer));
    if(allowanceIndex == -1) {
      const newAllowanceObj = {
        owner: signer,
        spenders: [spender]
      }
      allowanceObj.push(newAllowanceObj);

      const newAllowances = JSON.stringify(allowanceObj);
      
      this.emitEvent(new AllowanceEvent(Encoding.stringToFields(newAllowances)))
      return true; // owner created & spender added
    }
    const allowancesOfUser = allowanceObj[allowanceIndex];
    const isSpender = allowancesOfUser.spenders.findIndex(item => item.equals(spender));
    if(isSpender != -1) {
      return true; // already approwed
    }
  
    allowancesOfUser.spenders.push(spender);
    allowanceObj[allowanceIndex] = allowancesOfUser;

    const newAllowances = JSON.stringify(allowanceObj);
    this.emitEvent(new AllowanceEvent(Encoding.stringToFields(newAllowances)))

    return ( this._allowances.get()); // ok
  }

  @method allowance(allowances: Bytes, owner: PublicKey, spender: PublicKey) {
    const allowanceHash = Poseidon.hash([Field(allowances.value)]);
    allowanceHash.assertEquals(( this._allowances.get()));
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowanceIndex = allowanceObj.findIndex(item => item.owner.equals(owner));
    if(allowanceIndex == -1) {
      return 0;
    }
    const allowancesOfUser = allowanceObj[allowanceIndex];
    const isSpender = allowancesOfUser.spenders.findIndex(item => item.equals(spender));
    if(isSpender == -1) {
      return 0;
    }
    return 1;
  }

  @method transferFrom(allowances: Bytes, balances: Bytes, fromAddress: PublicKey, toAddress: PublicKey, value: UInt32, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const allowanceHash = Poseidon.hash(Encoding.stringToFields(allowances.value));
    allowanceHash.assertEquals(( this._allowances.get()));
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowancesOfUser = allowanceObj.filter(item => item.owner.equals(fromAddress));
    const index = allowancesOfUser.findIndex(item => item.spenders.includes(signer));
    if(index == -1) {
      return false; // not allowed
    }

    const balancesHash = Poseidon.hash(Encoding.stringToFields(balances.value));
    balancesHash.assertEquals(( this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances.value);
    
    const fromIndex = balancesObj.findIndex(item => item.address.equals(fromAddress));
    const toIndex = balancesObj.findIndex(item => item.address.equals(toAddress));

    const from = balancesObj[fromIndex];
    const to = balancesObj[toIndex];

    from.balance = from.balance.sub(1);
    to.balance = to.balance.add(1);

    const newIds = from.ids.filter(item => !item.equals(value));
    from.ids = newIds;
    to.ids.push(value);

    balancesObj[fromIndex] = from;
    balancesObj[toIndex] = to;

    const newBalances = JSON.stringify(balancesObj);
    this.emitEvent(new BalanceEvent(Encoding.stringToFields(newBalances)))

    return ( this._balanceOf.get());
  }

  @method transferOwnership(newOwner: PublicKey, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals( this._owner.get());
    this._owner.set(newOwner);
    return ( this._owner.get())
  }

  @method isOwner(s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    return signer.equals( this._owner.get());
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

  const zkAppPrivkey = PrivateKey.random();
  const zkAppPubkey = zkAppPrivkey.toPublicKey();

  // Create a new instance of the contract
  console.log('\n\n====== DEPLOYING ======\n\n');

  let zkAppInstance = new ERC721(zkAppPubkey);
  
  try {
    await Mina.transaction(owner, () => {
      const p = Party.createSigned(owner, { isSameAsFeePayer: true });
      p.balance.subInPlace(UInt64.fromNumber(initialBalance));
      zkAppInstance.deploy({verificationKey: undefined, zkappKey: zkAppPrivkey});
    })
    .send()
    .wait();

  } catch (error) {
    console.log("Error in deploy:>>" , error)
  }
  
  try {
    await Mina.transaction(owner, () => {
      console.log("tx init started")
      const signature = SignatureWithSigner.create(owner, [Field(5)]);
      zkAppInstance.initialize(Field(123), Field(5), signature, zkAppPrivkey);
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
    .send()
    .wait();

  } catch (error) {
    console.log("Error init :>>" , error)
  }

  try {
    let b = Mina.getAccount(zkAppPubkey);
    console.log('initial state of the zkApp :>>');
    for(const state of b.zkapp.appState){
      console.log('state :>>', state.toString());
    }
  
  } catch (error) {
    console.log("Error in get:>>" , error)
  }

  const file = [
    {
      "address":  player2Public.toBase58(),
      "balances": 1,
      "ids": [1]
    }
  ]
  //mock listening
  const cid = await uploadFile(file);

  try {
    await Mina.transaction(owner, () => {
      console.log("tx update started")
      zkAppInstance.updateBalances(new Bytes(cid), SignatureWithSigner.create(owner, Encoding.stringToFields(cid)))
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
    .send()
    .wait();

  } catch (error) {
    console.log("Error update :>>" , error)
  }

  try {
    let b = Mina.getAccount(zkAppPubkey);
    console.log('last state of the zkApp :>>');
    for(const state of b.zkapp.appState){
      console.log('state :>>', state.toString());
    }
  
  } catch (error) {
    console.log("Error in get:>>" , error)
  }

 /*  try {
    await Mina.transaction(player2, () => {
      console.log("tx init started")
      const signature = SignatureWithSigner.create(player2, zkAppInstance.nonce.toFields());
      zkAppInstance.mint(new Bytes("123"), new Bytes("23"), player2Public, new Bytes("31"), signature);
      zkAppInstance.self.sign(zkAppPrivkey);
      zkAppInstance.self.body.incrementNonce = Bool(true);
    })
    .send()
    .wait();

  } catch (error) {
    console.log("Error in false sign :>>" , error)
  } */

  try {

  shutdown();
  } catch (error) {
    console.log("Error in shutdown:>>" , error)
  }

}


main()
