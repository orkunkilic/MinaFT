import { Field, SmartContract, state, State, method, prop, UInt64, Poseidon, PrivateKey, CircuitValue, PublicKey, Signature, UInt32, Permissions,  Circuit, isReady, Mina, shutdown, Party, Bool, Encoding, arrayProp, Body, call, callUnproved } from 'snarkyjs';


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


class ERC721 extends SmartContract {
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

  @method initialize(symbol: Field, totalSupply: Field, s: SignatureWithSigner, zkKey: PrivateKey) {
    /* console.log("call another contract")
    callUnproved(ERC721, this.self.publicKey, "symbol", undefined, zkKey).then(
      (symbol) => {
        console.log(symbol)
      }
    )
    console.log("call done") */
    s.signature.verify(s.signer, [totalSupply]).assertEquals(true);
    const signer: PublicKey = s.signer;
    const initialBalanceAsString = 0;
    const initialBalanceAsField = Field(initialBalanceAsString);
    this._balanceOf.set(Poseidon.hash([initialBalanceAsField]));
    this._symbol.set((symbol));
    this._totalSupply.set(totalSupply);
    this._owner.set(signer);
    this._idNonce.set(new UInt32(new Field(0)));
    this._allowances.set(Field(0));
    this._tokenURI.set(Field(0));
    return true;
  }

  @method mint(balances: Bytes, tokenURIs: Bytes, toAddress: PublicKey, metadata: Bytes, s: SignatureWithSigner) {
    const nonce: UInt32 = this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    //const res = axios.get('').then();

    signer.assertEquals(this._owner.get());

    const balancesHash = Poseidon.hash([Field(balances.value)]);
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
    const newBalancesAsField = Field(newBalances);
    const newBalancesHash = Poseidon.hash([newBalancesAsField]);
    this._balanceOf.set(newBalancesHash);

    const tokenURIsHash = Poseidon.hash([Field(tokenURIs.value)]);
    tokenURIsHash.assertEquals(this._tokenURI.get());
    const tokenURIsObj: Array<Metadatas> = JSON.parse(tokenURIs.value);
    tokenURIsObj.push({
      id: newIdNonce,
      uri: metadata.value
    });
    const newTokenURIs = JSON.stringify(tokenURIsObj);
    const newTokenURIsAsField = Field(newTokenURIs);
    const newTokenURIsHash = Poseidon.hash([newTokenURIsAsField]);
    this._tokenURI.set(newTokenURIsHash);


    this._idNonce.set(newIdNonce);

    return ([this._balanceOf.get(), this._tokenURI.get(), this._idNonce.get()]);
  }

  // work on this, this can confuse the network!
  @method batchMint(balances: Bytes, tokenURIs: Bytes, metadatas: BytesArray, toAddress: PublicKeyArray, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals( this._owner.get());

    const balancesHash = Poseidon.hash([Field(balances.value)]);
    balancesHash.assertEquals(( this._balanceOf.get()));

    const tokenURIsHash = Poseidon.hash([Field(tokenURIs.value)]);
    tokenURIsHash.assertEquals(( this._tokenURI.get()));

    Circuit.assertEqual(toAddress.value.length, metadatas.value.length);

    for(let i = 0; i < toAddress.value.length; i++) {
      const balancesObj: Array<Balances> = JSON.parse(balances.value);
      const index = balancesObj.findIndex(item => item.address.equals(toAddress[i]));
      const balancesOfUser = balancesObj[index];
      balancesOfUser.balance = balancesOfUser.balance.add(1);
      const idNonce =  this._idNonce.get();
      const newIdNonce = idNonce.add(1);
      balancesOfUser.ids.push(newIdNonce);

      balancesObj[index] = balancesOfUser;

      const newBalances = JSON.stringify(balancesObj);
      const newBalancesAsField = Field(newBalances);
      const newBalancesHash = Poseidon.hash([newBalancesAsField]);
      this._balanceOf.set(newBalancesHash);

      const tokenURIsObj: Array<Metadatas> = JSON.parse(tokenURIs.value);
      tokenURIsObj.push({
        id: newIdNonce,
        uri: metadatas[i].value
      });
      const newTokenURIs = JSON.stringify(tokenURIsObj);
      const newTokenURIsAsField = Field(newTokenURIs);
      const newTokenURIsHash = Poseidon.hash([newTokenURIsAsField]);
      this._tokenURI.set(newTokenURIsHash);
      this._idNonce.set(newIdNonce);

    }

    return ([ this._balanceOf.get(),  this._tokenURI.get(),  this._idNonce.get()]);
  }

  @method transfer(balances: Bytes, toAddress: PublicKey, value: UInt32, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const balancesHash = Poseidon.hash([Field(balances.value)]);
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
    const newBalancesAsField = Field(newBalances);
    const newBalancesHash = Poseidon.hash([newBalancesAsField]);
    this._balanceOf.set(newBalancesHash);

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

    const allowanceHash = Poseidon.hash([Field(allowances.value)]);
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
      const newAllowancesAsField = Field(newAllowances);
      const newAllowancesHash = Poseidon.hash([newAllowancesAsField]);
      this._allowances.set(newAllowancesHash);

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
    const newAllowancesAsField = Field(newAllowances);
    const newAllowancesHash = Poseidon.hash([newAllowancesAsField]);
    this._allowances.set(newAllowancesHash);

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

    const allowanceHash = Poseidon.hash([Field(allowances.value)]);
    allowanceHash.assertEquals(( this._allowances.get()));
    const allowanceObj: Array<Allowances> = JSON.parse(allowances.value);
    const allowancesOfUser = allowanceObj.filter(item => item.owner.equals(fromAddress));
    const index = allowancesOfUser.findIndex(item => item.spenders.includes(signer));
    if(index == -1) {
      return false; // not allowed
    }

    const balancesHash = Poseidon.hash([Field(balances.value)]);
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
    const newBalancesAsField = Field(newBalances);
    const newBalancesHash = Poseidon.hash([newBalancesAsField]);
    this._balanceOf.set(newBalancesHash);

    return ( this._balanceOf.get());
  }

  @method transferOwnership(newOwner: PublicKey, s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals( this._owner.get());
    this._owner.set(newOwner);
    return ( this._owner.get());
  }

  @method isOwner(s: SignatureWithSigner) {
    const nonce: UInt32 =  this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    return signer.equals( this._owner.get());
  }
}


const main = async () => {


  console.log("wait for ready")
  await isReady;
  console.log("ready")

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const player1 = Local.testAccounts[0].privateKey;
  const player2 = Local.testAccounts[1].privateKey;

  console.log("p1 :>>", player1)
  const player1Public = player1.toPublicKey();
  const player2Public = player2.toPublicKey();

  const zkAppPrivkey = PrivateKey.random();
  const zkAppPubkey = zkAppPrivkey.toPublicKey();

  // Create a new instance of the contract
  console.log('\n\n====== DEPLOYING ======\n\n');

  let zkAppInstance = new ERC721(zkAppPubkey);
  try {
    await Mina.transaction(player1, () => {
      console.log("tx deploy started")
      const p = Party.createSigned(player1, { isSameAsFeePayer: true });
      p.balance.subInPlace(UInt64.fromNumber(initialBalance));
      zkAppInstance.deploy({verificationKey: undefined, zkappKey: zkAppPrivkey});
    })
    .send()
    .wait();

  } catch (error) {
    console.log("Error in deploy:>>" , error)
  }
  
  try {
    await Mina.transaction(player1, () => {
      console.log("tx init started")
      const signature = SignatureWithSigner.create(player1, [Field(5)]);
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
    console.log('initial state of the zkApp :>>', b.balance);
    for(const state of b.zkapp.appState){
      console.log('state :>>', state.toString());
    }
  
  } catch (error) {
    console.log("Error in get:>>" , error)
  }

  try {
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
    console.log("Error init :>>" , error)
  }

  try {

  shutdown();
  } catch (error) {
    console.log("Error in shutdown:>>" , error)
  }

}


main()
