import { Field, SmartContract, state, State, method, Poseidon, PublicKey, UInt32 } from 'snarkyjs';
import {  Balances, Metadatas, SignatureWithSigner, Bytes } from './lib';



class ERC721 extends SmartContract {
  // hash state
  @state(Field) _name = State<Field>();
  @state(Field) _symbol = State<Field>();
  @state(Field) _totalSupply = State<Field>();
  @state(Field) _balanceOf = State<Field>();
  @state(Field) _tokenURI = State<Field>();
  @state(Bytes) _baseURI = State<Bytes>();
  @state(PublicKey) _owner = State<PublicKey>();
  @state(UInt32) _idNonce = State<UInt32>();


  // initialization
  deploy(name: Field, symbol: Field, totalSupply: Field, baseURI: string, s: SignatureWithSigner) {
    s.signature.verify(s.signer, [name, symbol, totalSupply]).assertEquals(true);
    const signer: PublicKey = s.signer;

    super.deploy();
    const initialBalanceAsString = JSON.stringify({});
    const initialBalanceAsField = Field(initialBalanceAsString);
    this._balanceOf.set(Poseidon.hash([initialBalanceAsField]));
    this._name.set(name);
    this._symbol.set(symbol);
    this._totalSupply.set(totalSupply);
    this._owner.set(signer);
    this._baseURI.set(new Bytes(baseURI));
    this._idNonce.set(new UInt32(new Field(0)));
  }

  @method async mint(balances: string, tokenURIs: string, toAddress: PublicKey, metadata: string, s: SignatureWithSigner) {
    const nonce: UInt32 = await this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    signer.assertEquals(await this._owner.get());

    const balancesHash = Poseidon.hash([Field(balances)]);
    balancesHash.assertEquals((await this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances);
    const index = balancesObj.findIndex(item => item.address.equals(toAddress));
    const balancesOfUser = balancesObj[index];
    balancesOfUser.balance = balancesOfUser.balance.add(1);
    const idNonce = await this._idNonce.get();
    const newIdNonce = idNonce.add(1);
    balancesOfUser.ids.push(newIdNonce);


    balancesObj[index] = balancesOfUser;

    const newBalances = JSON.stringify(balancesObj);
    const newBalancesAsField = Field(newBalances);
    const newBalancesHash = Poseidon.hash([newBalancesAsField]);
    this._balanceOf.set(newBalancesHash);

    const tokenURIsHash = Poseidon.hash([Field(tokenURIs)]);
    tokenURIsHash.assertEquals((await this._tokenURI.get()));
    const tokenURIsObj: Array<Metadatas> = JSON.parse(tokenURIs);
    tokenURIsObj.push({
      id: newIdNonce,
      uri: metadata
    });
    const newTokenURIs = JSON.stringify(tokenURIsObj);
    const newTokenURIsAsField = Field(newTokenURIs);
    const newTokenURIsHash = Poseidon.hash([newTokenURIsAsField]);
    this._tokenURI.set(newTokenURIsHash);


    this._idNonce.set(newIdNonce);

    return ([await this._balanceOf.get(), await this._tokenURI.get(), await this._idNonce.get()]);
  }

  @method async transfer(balances: string, toAddress: PublicKey, value: UInt32, s: SignatureWithSigner) {
    const nonce: UInt32 = await this.nonce;
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);
    const signer: PublicKey = s.signer;

    const balancesHash = Poseidon.hash([Field(balances)]);
    balancesHash.assertEquals((await this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances);

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

    return (await this._balanceOf.get());
  }

  @method async balanceOf(balances: string, owner: PublicKey) {
    const balancesHash = Poseidon.hash([Field(balances)]);
    balancesHash.assertEquals((await this._balanceOf.get()));
    const balancesObj: Array<Balances> = JSON.parse(balances);
    const index = balancesObj.findIndex(item => item.address.equals(owner));
    return balancesObj[index].balance;
  }

  @method async name() {
    return this._name.get();
  }

  @method async symbol() {
    return this._symbol.get();
  }

  @method async totalSupply() {
    return this._totalSupply.get();
  }

  @method async tokenURI(id: Field) {
    return (await this._baseURI.get()).value + id.toString();
  }

}
